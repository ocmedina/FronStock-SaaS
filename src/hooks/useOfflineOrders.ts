"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { offlineDB, PendingOrder } from "@/lib/offline/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface CreateOrderPayload {
  p_org_id: string;
  p_customer_id: string;
  p_payment_method: string;
  p_items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
  p_delivery_address?: string | null;
  p_delivery_notes?: string | null;
  p_estimated_mins?: number;
  p_delivery_fee?: number;
  p_discount?: number;
  p_payment_amount?: number | null;
  p_client_reference?: string;
}

export function useOfflineOrders(organizationId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [ordersSyncError, setOrdersSyncError] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  const loadPendingOrdersCount = useCallback(async () => {
    if (!organizationId) return;

    const count = await offlineDB.pendingOrders
      .where("organization_id")
      .equals(organizationId)
      .and((order) => order.status === "pending_sync" || order.status === "error")
      .count();

    setPendingOrdersCount(count);
  }, [organizationId]);

  const saveOrderOffline = useCallback(
    async (payload: CreateOrderPayload) => {
      if (!organizationId) throw new Error("No organization ID");

      const pendingOrder: PendingOrder = {
        local_id: `offline_order_${nanoid()}`,
        organization_id: organizationId,
        payload: {
          ...payload,
          p_client_reference: payload.p_client_reference || `offline_order_${nanoid()}`,
        },
        status: "pending_sync",
        created_at: Date.now(),
        retry_count: 0,
      };

      pendingOrder.payload.p_client_reference = pendingOrder.local_id;

      await offlineDB.pendingOrders.add(pendingOrder);
      await loadPendingOrdersCount();

      return pendingOrder.local_id;
    },
    [organizationId, loadPendingOrdersCount]
  );

  const syncPendingOrders = useCallback(async () => {
    if (!organizationId || !isOnline || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncingOrders(true);
    setOrdersSyncError(null);

    try {
      const pendingOrders = await offlineDB.pendingOrders
        .where("organization_id")
        .equals(organizationId)
        .and((order) => order.status === "pending_sync" || order.status === "error")
        .toArray();

      for (const pendingOrder of pendingOrders) {
        try {
          await offlineDB.pendingOrders.update(pendingOrder.local_id, { status: "syncing" });

          let { data, error } = await supabase.rpc("create_order", pendingOrder.payload);

          const shouldTryLegacy = !!error && (
            error.code === "PGRST202" ||
            error.code === "42883" ||
            error.message?.toLowerCase().includes("function") ||
            error.message?.includes("p_client_reference")
          );

          if (shouldTryLegacy) {
            const { p_client_reference, ...legacyPayload } = pendingOrder.payload;
            const legacyResult = await supabase.rpc("create_order", legacyPayload);
            data = legacyResult.data;
            error = legacyResult.error;
          }

          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Error al sincronizar pedido");

          await offlineDB.pendingOrders.update(pendingOrder.local_id, {
            status: "synced",
            synced_at: Date.now(),
            error_message: undefined,
          });

          await offlineDB.syncLogs.add({
            type: "order",
            action: "upload",
            status: "success",
            message: `Pedido ${pendingOrder.local_id} sincronizado`,
            timestamp: Date.now(),
          });
        } catch (error: any) {
          await offlineDB.pendingOrders.update(pendingOrder.local_id, {
            status: "error",
            retry_count: pendingOrder.retry_count + 1,
            error_message: error?.message || "Error de sincronización",
          });

          await offlineDB.syncLogs.add({
            type: "order",
            action: "upload",
            status: "error",
            message: error?.message || "Error de sincronización",
            timestamp: Date.now(),
          });

          setOrdersSyncError(error?.message || "Error al sincronizar pedidos");
        }
      }

      await loadPendingOrdersCount();
    } finally {
      isSyncingRef.current = false;
      setIsSyncingOrders(false);
    }
  }, [organizationId, isOnline, loadPendingOrdersCount, supabase]);

  useEffect(() => {
    loadPendingOrdersCount();
  }, [loadPendingOrdersCount]);

  useEffect(() => {
    if (organizationId && isOnline && wasOffline) {
      const timer = setTimeout(() => {
        syncPendingOrders();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [organizationId, isOnline, wasOffline, syncPendingOrders]);

  return {
    pendingOrdersCount,
    isSyncingOrders,
    ordersSyncError,
    saveOrderOffline,
    syncPendingOrders,
  };
}
