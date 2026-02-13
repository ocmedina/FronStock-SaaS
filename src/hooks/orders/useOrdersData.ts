import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { calculateOrderStats } from "@/lib/orders/filters";
import { offlineDB } from "@/lib/offline/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineOrders } from "@/hooks/useOfflineOrders";

export const useOrdersData = (organizationId: string | null, dateFilter: string) => {
    const supabase = useMemo(() => createClient(), []);
    const { isOnline } = useOnlineStatus();
    const { pendingOrdersCount, syncPendingOrders, isSyncingOrders, ordersSyncError } = useOfflineOrders(organizationId);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        preparing: 0,
        ready: 0,
        shipping: 0,
        delivered: 0,
        totalRevenue: 0,
    });

    const fetchOrders = async () => {
        if (!organizationId) return;

        setLoading(true);
        try {
            // Cache first
            const cachedOrders = await offlineDB.orders
                .where("organization_id")
                .equals(organizationId)
                .toArray();

            const pendingOrders = await offlineDB.pendingOrders
                .where("organization_id")
                .equals(organizationId)
                .and((order) => order.status === "pending_sync" || order.status === "error" || order.status === "syncing")
                .toArray();

            const customersCache = await offlineDB.customers
                .where("organization_id")
                .equals(organizationId)
                .toArray();

            const customerById = new Map(customersCache.map((customer: any) => [customer.id, customer]));

            const pendingOrdersMapped = pendingOrders.map((pendingOrder) => {
                const customer = pendingOrder.payload.p_customer_id
                    ? customerById.get(pendingOrder.payload.p_customer_id)
                    : null;

                return {
                    id: pendingOrder.local_id,
                    organization_id: pendingOrder.organization_id,
                    customer_id: pendingOrder.payload.p_customer_id || null,
                    customer: customer || null,
                    service_type: "delivery",
                    status: pendingOrder.status,
                    delivery_status: "pending",
                    total:
                        pendingOrder.payload.p_items?.reduce(
                            (sum, item) => sum + item.quantity * item.unit_price,
                            0
                        ) + (pendingOrder.payload.p_delivery_fee || 0) - (pendingOrder.payload.p_discount || 0),
                    created_at: new Date(pendingOrder.created_at).toISOString(),
                    order_items: pendingOrder.payload.p_items?.map((item) => ({
                        id: `${pendingOrder.local_id}_${item.product_id}`,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.quantity * item.unit_price,
                    })) || [],
                    is_offline_pending: true,
                };
            });

            let filteredCachedOrders = cachedOrders;
            if (dateFilter === "today") {
                const today = new Date().toISOString().split("T")[0];
                filteredCachedOrders = cachedOrders.filter((order) =>
                    String(order.created_at || "").startsWith(today)
                );
            } else if (dateFilter === "week") {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredCachedOrders = cachedOrders.filter((order) => {
                    const createdAt = order.created_at ? new Date(order.created_at) : null;
                    return createdAt ? createdAt >= weekAgo : false;
                });
            }

            let filteredPendingOrders = pendingOrdersMapped;
            if (dateFilter === "today") {
                const today = new Date().toISOString().split("T")[0];
                filteredPendingOrders = pendingOrdersMapped.filter((order) =>
                    String(order.created_at || "").startsWith(today)
                );
            } else if (dateFilter === "week") {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredPendingOrders = pendingOrdersMapped.filter((order) => {
                    const createdAt = order.created_at ? new Date(order.created_at) : null;
                    return createdAt ? createdAt >= weekAgo : false;
                });
            }

            const cachedWithPending = [...filteredPendingOrders, ...filteredCachedOrders].sort(
                (a: any, b: any) =>
                    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );

            if (cachedWithPending.length > 0) {
                setOrders(cachedWithPending);
                setStats(calculateOrderStats(cachedWithPending));
            }

            if (!isOnline) {
                return;
            }

            let query = supabase
                .from("orders")
                .select(
                    `*,
                    customer:customers(id, name, phone, address, zone, service_type),
                    order_items(id, product_name, quantity, unit_price, total),
                    routes(id, name, status)`
                )
                .eq("organization_id", organizationId)
                .order("created_at", { ascending: false });

            if (dateFilter === "today") {
                const today = new Date().toISOString().split("T")[0];
                query = query.gte("created_at", `${today}T00:00:00`);
            } else if (dateFilter === "week") {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                query = query.gte("created_at", weekAgo.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;

            setOrders(data || []);
            setStats(calculateOrderStats(data || []));

            if (data) {
                const withSyncTimestamp = data.map((order: any) => ({
                    ...order,
                    last_synced: Date.now(),
                }));

                await offlineDB.orders
                    .where("organization_id")
                    .equals(organizationId)
                    .delete();

                if (withSyncTimestamp.length > 0) {
                    await offlineDB.orders.bulkPut(withSyncTimestamp);
                }
            }
        } catch (error: any) {
            console.error("Error fetching orders:", error);
            if (orders.length === 0) {
                toast.error("Error al cargar pedidos");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (organizationId) {
            if (isOnline && pendingOrdersCount > 0) {
                syncPendingOrders().finally(() => {
                    fetchOrders();
                });
            }

            fetchOrders();

            if (!isOnline) {
                return;
            }

            const channel = supabase
                .channel("orders-realtime")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "orders",
                        filter: `organization_id=eq.${organizationId}`,
                    },
                    () => {
                        fetchOrders();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [organizationId, dateFilter, isOnline, pendingOrdersCount, syncPendingOrders]);

    return {
        orders,
        loading,
        stats,
        pendingOrdersCount,
        isSyncingOrders,
        ordersSyncError,
        refetch: fetchOrders,
        setOrders,
    };
};
