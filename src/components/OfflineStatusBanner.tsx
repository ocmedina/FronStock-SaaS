"use client";

import { useCallback, useEffect } from 'react';
import { useOfflineSales } from '@/hooks/useOfflineSales';
import { useOfflineOrders } from '@/hooks/useOfflineOrders';
import { useOrganization } from '@/contexts/OrganizationContext';
import { WifiOff, CloudUpload, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineStatusBanner() {
  const { organizationId } = useOrganization();
  const { 
    isOnline,
    wasOffline,
    browserOnline,
    networkStatus,
    pendingSalesCount, 
    isSyncing,
    isCancellingSync,
    isCaching,
    syncError, 
    lastSyncTime,
    syncPendingSales,
    cancelSyncPendingSales,
    discardPendingSalesSync,
  } = useOfflineSales(organizationId || undefined);

  const {
    pendingOrdersCount,
    isSyncingOrders,
    ordersSyncError,
    syncPendingOrders,
  } = useOfflineOrders(organizationId || undefined);

  const pendingTotal = pendingSalesCount + pendingOrdersCount;
  const isSyncingAny = isSyncing || isSyncingOrders;
  const combinedSyncError = syncError || ordersSyncError;

  const syncAllNow = useCallback(async () => {
    await Promise.all([
      syncPendingSales(),
      syncPendingOrders(),
    ]);
  }, [syncPendingSales, syncPendingOrders]);

  useEffect(() => {
    if (!organizationId || !isOnline || !wasOffline) return;
    if (pendingTotal === 0 || isSyncingAny) return;

    const timer = setTimeout(() => {
      syncAllNow();
    }, 5000);

    return () => clearTimeout(timer);
  }, [organizationId, isOnline, wasOffline, pendingTotal, isSyncingAny, syncAllNow]);

  // Don't show if no organization (e.g., login page)
  if (!organizationId) {
    return null;
  }

  // Don't show if everything is OK and not caching
  if (isOnline && pendingTotal === 0 && !wasOffline && !combinedSyncError && !isCaching) {
    return null;
  }

  const isBlocked = browserOnline && !isOnline && networkStatus === 'blocked';
  const isDegraded = browserOnline && !isOnline && networkStatus === 'degraded';

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-2">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white rounded-lg p-3 flex items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-3 flex-1">
            <WifiOff className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {isBlocked ? 'Conexión bloqueada a Supabase' : isDegraded ? 'Conexión degradada al servidor' : 'Sin conexión a Internet'}
              </p>
              <p className="text-xs text-white/90">
                {isBlocked
                  ? 'Revisa DevTools/Extensiones: las solicitudes al servidor están siendo bloqueadas.'
                  : isDegraded
                    ? 'Servidor no disponible temporalmente. Se mantiene modo offline.'
                    : 'Modo offline activo - Las ventas se guardarán localmente'}
              </p>
            </div>
          </div>
          {pendingTotal > 0 && (
            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
              {pendingTotal} pendientes
            </div>
          )}
        </div>
      )}

      {/* Syncing Banner */}
      {isOnline && isSyncingAny && (
        <div className="bg-blue-500 text-white rounded-lg p-3 flex items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-3 flex-1">
          <RefreshCw className="h-5 w-5 animate-spin flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Sincronizando...</p>
            <p className="text-xs text-white/90">
              {isCancellingSync
                ? 'Cancelando sincronización...'
                : `Sincronizando ${pendingTotal} pendientes (${pendingSalesCount} ventas, ${pendingOrdersCount} pedidos)`}
            </p>
          </div>
          </div>
          {isSyncing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => cancelSyncPendingSales()}
              disabled={isCancellingSync}
              className="flex-shrink-0"
            >
              {isCancellingSync ? 'Cancelando...' : 'Cancelar'}
            </Button>
          )}
        </div>
      )}

      {/* Caching Banner */}
      {isOnline && isCaching && !isSyncing && (
        <div className="bg-indigo-500 text-white rounded-lg p-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-top">
          <RefreshCw className="h-5 w-5 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Actualizando caché...</p>
            <p className="text-xs text-white/90">
              Descargando productos y clientes para uso offline
            </p>
          </div>
        </div>
      )}

      {/* Back Online Banner */}
      {isOnline && wasOffline && !isSyncing && !isCaching && (
        <div className="bg-amber-500 text-white rounded-lg p-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-top">
          <RefreshCw className="h-5 w-5 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Conexión restaurada - Estabilizando red...</p>
            <p className="text-xs text-white/90">
              {pendingTotal > 0 
                ? `Preparando sincronización de ${pendingTotal} pendientes...` 
                : 'Reconectando con el servidor...'}
            </p>
          </div>
        </div>
      )}

      {/* Pending Sales (Online but not syncing) */}
      {isOnline && !isSyncingAny && pendingTotal > 0 && !wasOffline && !combinedSyncError && (
        <div className="bg-yellow-500 text-white rounded-lg p-3 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 flex-1">
            <CloudUpload className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Pendientes de sincronización</p>
              <p className="text-xs text-white/90">
                {pendingTotal} pendientes ({pendingSalesCount} ventas, {pendingOrdersCount} pedidos)
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => syncAllNow()}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar todo
          </Button>
        </div>
      )}

      {/* Sync Error */}
      {combinedSyncError && (
        <div className="bg-red-500 text-white rounded-lg p-3 flex items-center justify-between gap-4 shadow-lg mt-2">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Error de sincronización</p>
              <p className="text-xs text-white/90">{combinedSyncError}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => syncAllNow()}
            className="flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar todo
          </Button>
          {pendingSalesCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const confirmed = window.confirm('¿Descartar ventas pendientes de sincronización? Esta acción no se puede deshacer.');
                if (!confirmed) return;
                await discardPendingSalesSync();
              }}
              className="flex-shrink-0"
            >
              Descartar ventas
            </Button>
          )}
        </div>
      )}

      {/* Sync Success */}
      {isOnline && !isSyncingAny && pendingTotal === 0 && lastSyncTime && (
        <div className="bg-emerald-500 text-white rounded-lg p-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-top">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">Todo sincronizado</p>
            <p className="text-xs text-white/90">
              Última sincronización: {lastSyncTime.toLocaleTimeString('es-AR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
