"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { offlineDB, PendingSale } from '@/lib/offline/db';
import { createClient } from '@/lib/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { nanoid } from 'nanoid';

function normalizeErrorMessage(error: any): string {
  if (!error) return 'Error desconocido';

  const parts = [
    error.message,
    error.details,
    error.hint,
    error.code ? `[${error.code}]` : null,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Error no serializable';
  }
}

export function useOfflineSales(organizationId: string | null | undefined) {
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCancellingSync, setIsCancellingSync] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { isOnline, wasOffline, browserOnline, isSupabaseReachable, networkStatus } = useOnlineStatus();
  const supabase = useMemo(() => createClient(), []);
  const isSyncingRef = useRef(false);
  const cancelSyncRef = useRef(false);

  console.log('[DEBUG] useOfflineSales - isOnline:', isOnline, 'wasOffline:', wasOffline, 'pendingSalesCount:', pendingSalesCount);

  // Load pending sales count
  const loadPendingCount = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const count = await offlineDB.pendingSales
        .where('organization_id')
        .equals(organizationId)
        .and(sale => sale.status === 'pending_sync' || sale.status === 'error')
        .count();
      
      setPendingSalesCount(count);
    } catch (error) {
      console.error('Error loading pending sales:', error);
    }
  }, [organizationId]);

  const resetSyncingSalesToPending = useCallback(async () => {
    if (!organizationId) return;

    const syncingSales = await offlineDB.pendingSales
      .where('organization_id')
      .equals(organizationId)
      .and((sale) => sale.status === 'syncing')
      .toArray();

    if (syncingSales.length === 0) return;

    await Promise.all(
      syncingSales.map((sale) =>
        offlineDB.pendingSales.update(sale.local_id, { status: 'pending_sync' })
      )
    );
  }, [organizationId]);

  const discardPendingSalesSync = useCallback(async (): Promise<number> => {
    if (!organizationId) return 0;

    cancelSyncRef.current = true;
    isSyncingRef.current = false;
    setIsSyncing(false);
    setIsCancellingSync(false);

    const salesToDelete = await offlineDB.pendingSales
      .where('organization_id')
      .equals(organizationId)
      .and((sale) => sale.status === 'pending_sync' || sale.status === 'error' || sale.status === 'syncing')
      .toArray();

    if (salesToDelete.length > 0) {
      await offlineDB.pendingSales.bulkDelete(salesToDelete.map((sale) => sale.local_id));

      await offlineDB.syncLogs.add({
        type: 'sale',
        action: 'upload',
        status: 'success',
        message: `Se descartaron ${salesToDelete.length} ventas pendientes de sincronización`,
        timestamp: Date.now(),
      });
    }

    setSyncError(null);
    await loadPendingCount();

    return salesToDelete.length;
  }, [organizationId, loadPendingCount]);

  // Cache products from Supabase
  const cacheProducts = useCallback(async () => {
    if (!organizationId || !isOnline) {
      console.log('[SKIP] Skipping cache: organizationId or offline');
      return;
    }

    try {
      setIsCaching(true);
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode, plu, price, wholesale_price, stock, organization_id')
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Supabase error caching products:', error);
        throw error;
      }

      if (products && products.length > 0) {
        // Clear old products and insert new ones
        await offlineDB.products
          .where('organization_id')
          .equals(organizationId)
          .delete();

        const productsWithSync = products.map((p: any) => ({
          ...p,
          last_synced: Date.now()
        }));

        await offlineDB.products.bulkAdd(productsWithSync);
        
        console.log(`[OK] Cached ${products.length} products offline`);
      } else {
        console.warn('No products found to cache');
      }
    } catch (error: any) {
      console.error('Error caching products:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error
      });
      // Don't throw - allow app to continue
    } finally {
      setIsCaching(false);
    }
  }, [organizationId, isOnline, supabase]);

  // Cache customers from Supabase
  const cacheCustomers = useCallback(async () => {
    if (!organizationId || !isOnline) {
      console.log('[SKIP] Skipping cache: organizationId or offline');
      return;
    }

    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, phone, email, organization_id')
        .eq('organization_id', organizationId)
        .limit(100); // Top 100 customers

      if (error) {
        console.error('Supabase error caching customers:', error);
        throw error;
      }

      if (customers && customers.length > 0) {
        await offlineDB.customers
          .where('organization_id')
          .equals(organizationId)
          .delete();

        const customersWithSync = customers.map((c: any) => ({
          ...c,
          last_synced: Date.now()
        }));

        await offlineDB.customers.bulkAdd(customersWithSync);
        
        console.log(`[OK] Cached ${customers.length} customers offline`);
      } else {
        console.warn('No customers found to cache');
      }
    } catch (error: any) {
      console.error('Error caching customers:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        error
      });
      // Don't throw - allow app to continue
    }
  }, [organizationId, isOnline, supabase]);

  // Cache invoices from Supabase
  const cacheInvoices = useCallback(async () => {
    if (!organizationId || !isOnline) {
      console.log('[SKIP] Skipping invoice cache: organizationId or offline');
      return;
    }

    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, organization_id, sale_id, customer_id, invoice_number, type, total, status, cae, cae_expiration, afip_status, afip_error, created_at, customer:customers(id, name, cuit)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200); // Cache last 200 invoices

      if (error) {
        console.error('Supabase error caching invoices:', error);
        throw error;
      }

      if (invoices && invoices.length > 0) {
        await offlineDB.invoices
          .where('organization_id')
          .equals(organizationId)
          .delete();

        const invoicesWithSync = invoices.map((inv: any) => ({
          ...inv,
          last_synced: Date.now()
        }));

        await offlineDB.invoices.bulkAdd(invoicesWithSync);
        
        console.log(`[OK] Cached ${invoices.length} invoices offline`);
      } else {
        console.warn('No invoices found to cache');
      }
    } catch (error: any) {
      console.error('Error caching invoices:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        error
      });
      // Don't throw - allow app to continue
    }
  }, [organizationId, isOnline, supabase]);

  // Save sale offline
  const saveSaleOffline = useCallback(async (saleData: Omit<PendingSale, 'local_id' | 'organization_id' | 'status' | 'created_at' | 'retry_count'>) => {
    if (!organizationId) throw new Error('No organization ID');

    try {
      const pendingSale: PendingSale = {
        ...saleData,
        local_id: `offline_${nanoid()}`,
        organization_id: organizationId,
        status: 'pending_sync',
        created_at: Date.now(),
        retry_count: 0
      };

      await offlineDB.pendingSales.add(pendingSale);
      await loadPendingCount();

      // Update local stock optimistically (only if product exists in cache)
      for (const item of saleData.items) {
        try {
          const product = await offlineDB.products.get(item.product_id);
          if (product && product.stock !== undefined) {
            await offlineDB.products.update(item.product_id, {
              stock: Math.max(0, product.stock - item.quantity)
            });
          }
        } catch (stockError) {
          console.warn(`Could not update stock for product ${item.product_id}:`, stockError);
          // Continue anyway - stock will be corrected on sync
        }
      }

      return pendingSale.local_id;
    } catch (error) {
      console.error('Error saving sale offline:', error);
      throw error;
    }
  }, [organizationId, loadPendingCount]);

  // Sync pending sales to Supabase
  const syncPendingSales = useCallback(async () => {
    if (!organizationId || isSyncingRef.current) {
      console.log('[SKIP] Sync skipped:', { organizationId, isSyncing: isSyncingRef.current });
      return;
    }

    if (!browserOnline) {
      setSyncError('Sin conexión a internet. Se reintentará cuando vuelva la conexión.');
      return;
    }

    if (!isOnline) {
      if (networkStatus === 'blocked') {
        setSyncError('Sincronización pausada: conexión a Supabase bloqueada por navegador/extensión.');
      } else if (networkStatus === 'degraded') {
        setSyncError('Sincronización pausada: servidor temporalmente no disponible.');
      }
      return;
    }

    console.log('[SYNC] Starting sync process...');
    cancelSyncRef.current = false;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setIsCancellingSync(false);
    setSyncError(null);

    try {
      const pending = await offlineDB.pendingSales
        .where('organization_id')
        .equals(organizationId)
        .and(sale => sale.status === 'pending_sync' || sale.status === 'error')
        .toArray();

      console.log(`[SYNC] Found ${pending.length} pending sales`);

      if (pending.length === 0) {
        setLastSyncTime(new Date());
        setIsSyncing(false);
        return;
      }

      console.log(`[SYNC] Syncing ${pending.length} pending sales...`);
      console.log('[SYNC] Pending sales:', pending.map(s => ({ id: s.local_id, status: s.status, total: s.total })));

      let successCount = 0;
      let errorCount = 0;
      let cancelledByUser = false;

      for (const sale of pending) {
        if (cancelSyncRef.current) {
          cancelledByUser = true;
          break;
        }

        try {
          console.log(`[SYNC] Syncing sale ${sale.local_id}...`);
          // Update status to syncing
          await offlineDB.pendingSales.update(sale.local_id, { status: 'syncing' });

          // Prepare payment array (new format)
          const payments = [{
            method: sale.payment_method,
            amount: sale.total
          }];

          console.log(`[RPC] Calling process_sale for ${sale.local_id} with:`, {
            p_org_id: organizationId,
            p_customer_id: sale.customer_id || null,
            items_count: sale.items.length,
            items: sale.items,
            total: sale.total,
            payments: payments
          });

          // Retry logic with exponential backoff + jitter
          const maxAttempts = 4;
          let attempt = 1;
          let lastError: any = null;

          while (attempt <= maxAttempts) {
            if (cancelSyncRef.current) {
              cancelledByUser = true;
              break;
            }

            try {
              console.log(`[RETRY] Attempt ${attempt}/${maxAttempts} for sale ${sale.local_id}...`);
              
              // Create fresh Supabase client for each attempt
              const freshSupabase = createClient();

              // Call Supabase RPC to process sale (new signature first)
              let { data, error } = await freshSupabase.rpc('process_sale', {
                p_org_id: organizationId,
                p_customer_id: sale.customer_id || null,
                p_payments: payments,
                p_items: sale.items,
                p_discount: sale.discount || 0,
                p_surcharge: 0,
                p_client_reference: sale.local_id,
              });

              // Fallback for older DB function signature (p_payment_method)
              const shouldTryLegacy = !!error && (
                error.code === 'PGRST202' ||
                error.code === '42883' ||
                error.message?.toLowerCase().includes('function') ||
                error.message?.includes('p_payments')
              );

              if (shouldTryLegacy) {
                console.warn('process_sale new signature not found, trying legacy signature');
                const legacyResult = await freshSupabase.rpc('process_sale', {
                  p_org_id: organizationId,
                  p_customer_id: sale.customer_id || null,
                  p_payment_method: sale.payment_method,
                  p_items: sale.items,
                  p_discount: sale.discount || 0,
                });
                data = legacyResult.data;
                error = legacyResult.error;
              }

              if (error) {
                console.warn(`Supabase RPC warning for sale ${sale.local_id}:`, error);
                throw error;
              }

              // Some versions return success:false in payload without throwing
              const rpcReturnedFailure = !!data && typeof data === 'object' && ('success' in data) && data.success === false;
              if (rpcReturnedFailure) {
                throw new Error(data.error || 'process_sale devolvió success=false');
              }

              // Mark origin as offline when possible (non-blocking if column/function version differs)
              const createdSaleId = data?.sale_id || data?.id;
              if (createdSaleId) {
                const normalizedMethod = String(sale.payment_method || '').toLowerCase();
                const isCredit = ['credit', 'fiado', 'current_account', 'cuenta_corriente'].includes(normalizedMethod);
                const { error: originUpdateError } = await freshSupabase
                  .from('sales')
                  .update({
                    channel: 'offline',
                    payment_method: normalizedMethod || 'cash',
                    payment_status: isCredit ? 'pending' : 'paid',
                  })
                  .eq('id', createdSaleId)
                  .eq('organization_id', organizationId);

                if (originUpdateError) {
                  console.warn('Could not tag sale origin as offline:', originUpdateError);
                }
              }

              console.log(`[OK] Sale ${sale.local_id} synced successfully to Supabase`, data);
              lastError = null;
              break; // Success, exit retry loop
            } catch (err: any) {
              lastError = err;

              if (attempt < maxAttempts) {
                const baseDelay = 1200;
                const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.floor(Math.random() * 700);
                const waitTime = exponentialDelay + jitter;

                const normalizedAttemptError = normalizeErrorMessage(err);
                console.warn(`[WARN] Sync attempt failed: ${normalizedAttemptError}, retrying in ${(waitTime / 1000).toFixed(1)}s... (${maxAttempts - attempt} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                console.warn(`All retry attempts exhausted for sale ${sale.local_id}`);
              }

              attempt++;
            }
          }

          if (cancelledByUser) {
            break;
          }
          
          if (lastError) {
            throw lastError;
          }

          // Mark as synced
          await offlineDB.pendingSales.update(sale.local_id, {
            status: 'synced',
            synced_at: Date.now()
          });

          // Log success
          await offlineDB.syncLogs.add({
            type: 'sale',
            action: 'upload',
            status: 'success',
            message: `Sale ${sale.local_id} synced successfully`,
            timestamp: Date.now()
          });

          successCount++;
        } catch (error: any) {
          const normalizedError = normalizeErrorMessage(error);
          console.warn(`Error syncing sale ${sale.local_id}:`, normalizedError);
          
          // Update retry count and status
          await offlineDB.pendingSales.update(sale.local_id, {
            status: 'error',
            error_message: normalizedError,
            retry_count: sale.retry_count + 1
          });

          // Log error
          await offlineDB.syncLogs.add({
            type: 'sale',
            action: 'upload',
            status: 'error',
            message: normalizedError,
            timestamp: Date.now()
          });

          errorCount++;
        }
      }

      if (cancelledByUser) {
        setSyncError('Sincronización cancelada por el usuario.');
      }

      console.log(`[OK] Sync complete: ${successCount} success, ${errorCount} errors`);
      
      setLastSyncTime(new Date());
      
      // Reload count after sync
      const newCount = await offlineDB.pendingSales
        .where('organization_id')
        .equals(organizationId)
        .and(sale => sale.status === 'pending_sync' || sale.status === 'error')
        .count();
      setPendingSalesCount(newCount);

      if (successCount > 0) {
        console.log(`[OK] ${successCount} ventas sincronizadas exitosamente!`);
      }

      if (errorCount > 0) {
        setSyncError(`${errorCount} ventas no se pudieron sincronizar`);
        console.warn(`${errorCount} ventas fallaron en la sincronización`);
      }
    } catch (error: any) {
      console.warn('Sync process warning:', error);
      setSyncError(error?.message || 'Error de sincronización');
    } finally {
      if (cancelSyncRef.current) {
        await resetSyncingSalesToPending();
      }

      await loadPendingCount();

      cancelSyncRef.current = false;
      isSyncingRef.current = false;
      setIsCancellingSync(false);
      setIsSyncing(false);
    }
  }, [organizationId, isOnline, browserOnline, networkStatus, loadPendingCount, resetSyncingSalesToPending]);

  const cancelSyncPendingSales = useCallback(() => {
    if (!isSyncingRef.current) return;

    cancelSyncRef.current = true;
    setIsCancellingSync(true);
    setSyncError('Cancelando sincronización...');
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!organizationId || !isOnline) return;

    console.log('[SYNC] Auto-sync check:', { organizationId, isOnline, wasOffline, isSyncing: isSyncingRef.current });

    // Trigger sync when we detect reconnection
    if (wasOffline && !isSyncingRef.current) {
      console.log('[NET] Connection restored! Waiting 5 seconds for network to stabilize...');
      // Wait longer for browser/Supabase to be ready (5 seconds)
      const timer = setTimeout(() => {
        console.log('[NET] Network should be stable now, starting sync...');
        syncPendingSales();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [organizationId, isOnline, wasOffline, syncPendingSales]);

  // Initial cache load (with delay to avoid race conditions)
  useEffect(() => {
    if (!organizationId || !isOnline) return;

    console.log('[INIT] Mounting useOfflineSales - will cache in 2 seconds...');

    // Wait a bit after mount to ensure Supabase client is ready
    const timer = setTimeout(() => {
      console.log('[CACHE] Starting initial cache load...');
      cacheProducts();
      cacheCustomers();
      cacheInvoices();
    }, 2000);

    return () => {
      console.log('[CLEANUP] Cleaning up initial cache timer');
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, isOnline]);

  // Load pending count on mount and when org changes
  useEffect(() => {
    console.log('[INIT] Loading pending count for org:', organizationId);
    loadPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Periodic cache refresh (every 5 minutes when online)
  useEffect(() => {
    if (!organizationId || !isOnline) return;

    console.log('[TIMER] Setting up periodic cache refresh (every 5 minutes)');

    const interval = setInterval(() => {
      console.log('[CACHE] Periodic cache refresh triggered');
      cacheProducts();
      cacheCustomers();
      cacheInvoices();
    }, 5 * 60 * 1000);

    return () => {
      console.log('[CLEANUP] Cleaning up periodic refresh');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, isOnline]);

  return {
    isOnline,
    wasOffline,
    browserOnline,
    isSupabaseReachable,
    networkStatus,
    pendingSalesCount,
    isSyncing,
    isCancellingSync,
    isCaching,
    syncError,
    lastSyncTime,
    saveSaleOffline,
    syncPendingSales,
    cancelSyncPendingSales,
    discardPendingSalesSync,
    cacheProducts,
    cacheCustomers,
    cacheInvoices
  };
}
