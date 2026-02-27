export const filterOrders = (
    orders: any[],
    searchTerm: string,
    serviceTypeFilter: string
) => {
    let filtered = [...orders];

    if (searchTerm) {
        filtered = filtered.filter(
            (o) =>
                o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.customer?.phone?.includes(searchTerm) ||
                o.customer?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (serviceTypeFilter !== "all") {
        filtered = filtered.filter((o) => o.service_type === serviceTypeFilter);
    }

    return filtered;
};

export const getOrderStatus = (order: any): string => {
    const lifecycle = String(order?.lifecycle_status || "").toLowerCase();
    if (lifecycle) return lifecycle;

    const legacy = String(order?.delivery_status || "").toLowerCase();
    if (legacy === "out_for_delivery") return "in_delivery";
    if (legacy === "assigned_to_route") return "assigned";
    if (legacy === "cancelled") return "not_delivered";
    return legacy || "draft";
};

export const filterOrdersByStatus = (
    orders: any[],
    statuses: string[]
) => {
    return orders.filter((o) =>
        statuses.includes(getOrderStatus(o))
    );
};

export const calculateOrderStats = (orders: any[]) => {
    const total = orders.length;
    const pending = orders.filter((o) =>
        ["pending", "draft"].includes(getOrderStatus(o))
    ).length;
    const preparing = orders.filter((o) =>
        ["preparing", "packed", "confirmed"].includes(getOrderStatus(o))
    ).length;
    const ready = orders.filter((o) =>
        ["ready", "assigned_to_route", "assigned"].includes(getOrderStatus(o))
    ).length;
    const shipping = orders.filter(
        (o) => ["out_for_delivery", "in_delivery"].includes(getOrderStatus(o))
    ).length;
    const delivered = orders.filter(
        (o) => getOrderStatus(o) === "delivered"
    ).length;
    const totalRevenue = orders
        .filter((o) => getOrderStatus(o) === "delivered")
        .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
        total,
        pending,
        preparing,
        ready,
        shipping,
        delivered,
        totalRevenue,
    };
};
