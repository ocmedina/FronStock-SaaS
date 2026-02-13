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

export const filterOrdersByStatus = (
    orders: any[],
    statuses: string[]
) => {
    return orders.filter((o) =>
        statuses.includes(o.delivery_status || "pending")
    );
};

export const calculateOrderStats = (orders: any[]) => {
    const total = orders.length;
    const pending = orders.filter((o) =>
        ["pending", "draft"].includes(o.delivery_status)
    ).length;
    const preparing = orders.filter((o) =>
        ["preparing", "packed", "confirmed"].includes(o.delivery_status)
    ).length;
    const ready = orders.filter((o) =>
        ["ready", "assigned_to_route"].includes(o.delivery_status)
    ).length;
    const shipping = orders.filter(
        (o) => o.delivery_status === "out_for_delivery"
    ).length;
    const delivered = orders.filter(
        (o) => o.delivery_status === "delivered"
    ).length;
    const totalRevenue = orders
        .filter((o) => o.delivery_status === "delivered")
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
