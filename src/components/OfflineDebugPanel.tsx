"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { offlineDB } from '@/lib/offline/db';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOfflineSales } from '@/hooks/useOfflineSales';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  XCircle,
  Clock,
  HardDrive,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

export function OfflineDebugPanel() {
  const { organizationId } = useOrganization();
  const { 
    isOnline,
    networkStatus,
    pendingSalesCount, 
    isSyncing,
    isCaching,
    syncPendingSales,
    cacheProducts,
    cacheCustomers 
  } = useOfflineSales(organizationId || undefined);

  const [stats, setStats] = useState({
    products: 0,
    customers: 0,
    pendingSales: 0,
    syncedSales: 0,
    totalStorage: 0
  });

  const [pendingSales, setPendingSales] = useState<any[]>([]);

  const loadStats = async () => {
    if (!organizationId) return;

    try {
      const [products, customers, pending, synced] = await Promise.all([
        offlineDB.products.where('organization_id').equals(organizationId).count(),
        offlineDB.customers.where('organization_id').equals(organizationId).count(),
        offlineDB.pendingSales
          .where('organization_id')
          .equals(organizationId)
          .and(s => s.status === 'pending_sync' || s.status === 'error')
          .count(),
        offlineDB.pendingSales
          .where('organization_id')
          .equals(organizationId)
          .and(s => s.status === 'synced')
          .count()
      ]);

      // Estimate storage size (rough)
      const totalStorage = (products * 500 + customers * 300 + pending * 2000) / 1024; // KB

      setStats({ products, customers, pendingSales: pending, syncedSales: synced, totalStorage });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPendingSales = async () => {
    if (!organizationId) return;

    try {
      const sales = await offlineDB.pendingSales
        .where('organization_id')
        .equals(organizationId)
        .and(s => s.status === 'pending_sync' || s.status === 'error')
        .toArray();

      setPendingSales(sales);
    } catch (error) {
      console.error('Error loading pending sales:', error);
    }
  };

  const clearCache = async () => {
    if (!organizationId) return;

    try {
      await offlineDB.products.where('organization_id').equals(organizationId).delete();
      await offlineDB.customers.where('organization_id').equals(organizationId).delete();
      
      toast.success('Caché limpiada correctamente');
      loadStats();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const clearSyncedSales = async () => {
    if (!organizationId) return;

    try {
      await offlineDB.pendingSales
        .where('organization_id')
        .equals(organizationId)
        .and(s => s.status === 'synced')
        .delete();
      
      toast.success('Ventas sincronizadas eliminadas');
      loadStats();
      loadPendingSales();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const forceSync = async () => {
    await syncPendingSales();
    await loadStats();
    await loadPendingSales();
  };

  const forceCache = async () => {
    toast.info('Actualizando caché...');
    await cacheProducts();
    await cacheCustomers();
    await loadStats();
    toast.success('Caché actualizada');
  };

  useEffect(() => {
    loadStats();
    loadPendingSales();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      loadStats();
      loadPendingSales();
    }, 10000);

    return () => clearInterval(interval);
  }, [organizationId]);

  if (!organizationId) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Panel de Depuración Offline
            </CardTitle>
            <CardDescription>
              Estado de IndexedDB y sincronización
            </CardDescription>
          </div>
          <Badge variant={isOnline ? "default" : "destructive"} className="gap-2">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'Online' : networkStatus === 'blocked' ? 'Blocked' : networkStatus === 'degraded' ? 'Degraded' : 'Offline'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.products}</div>
            <div className="text-xs text-muted-foreground">Productos Cache</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.customers}</div>
            <div className="text-xs text-muted-foreground">Clientes Cache</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingSales}</div>
            <div className="text-xs text-muted-foreground">Ventas Pendientes</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.syncedSales}</div>
            <div className="text-xs text-muted-foreground">Ventas Sync</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {stats.totalStorage.toFixed(0)}KB
            </div>
            <div className="text-xs text-muted-foreground">Almacenamiento</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={forceSync} 
            disabled={!isOnline || isSyncing || pendingSalesCount === 0}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar Ahora
          </Button>
          <Button 
            onClick={forceCache} 
            disabled={!isOnline || isCaching}
            variant="secondary"
            size="sm"
          >
            <Download className={`h-4 w-4 mr-2 ${isCaching ? 'animate-spin' : ''}`} />
            {isCaching ? 'Cacheando...' : 'Actualizar Caché'}
          </Button>
          <Button 
            onClick={clearCache} 
            variant="outline"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar Caché
          </Button>
          <Button 
            onClick={clearSyncedSales} 
            variant="outline"
            size="sm"
            disabled={stats.syncedSales === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar Ventas Sync
          </Button>
        </div>

        {/* Pending Sales List */}
        {pendingSales.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ventas Pendientes de Sincronización
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingSales.map(sale => (
                <div 
                  key={sale.local_id}
                  className="border rounded-lg p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {sale.customer_name || 'Sin cliente'}
                    </span>
                    <Badge 
                      variant={sale.status === 'error' ? 'destructive' : 'secondary'}
                      className="gap-1"
                    >
                      {sale.status === 'error' ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {sale.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sale.items.length} items</span>
                    <span className="font-medium">${sale.total.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sale.created_at).toLocaleString('es-AR')}
                  </div>
                  {sale.error_message && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {sale.error_message}
                    </div>
                  )}
                  {sale.retry_count > 0 && (
                    <div className="text-xs text-yellow-600">
                      Reintentos: {sale.retry_count}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingSales.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No hay ventas pendientes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
