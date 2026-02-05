import { useState, useCallback } from 'react';
import type { SaleTab } from '@/components/sales/types';

export interface SuspendedSale {
    id: string;
    tab: SaleTab;
    timestamp: Date;
    note?: string;
}

export function useSuspendedSales() {
    const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([]);

    const suspendSale = useCallback((tab: SaleTab, note?: string) => {
        const suspended: SuspendedSale = {
            id: `suspended-${Date.now()}`,
            tab: { ...tab },
            timestamp: new Date(),
            note,
        };

        setSuspendedSales(prev => [...prev, suspended]);
        return suspended.id;
    }, []);

    const resumeSale = useCallback((id: string): SaleTab | null => {
        const sale = suspendedSales.find(s => s.id === id);
        if (!sale) return null;

        setSuspendedSales(prev => prev.filter(s => s.id !== id));
        return sale.tab;
    }, [suspendedSales]);

    const deleteSuspendedSale = useCallback((id: string) => {
        setSuspendedSales(prev => prev.filter(s => s.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setSuspendedSales([]);
    }, []);

    return {
        suspendedSales,
        suspendSale,
        resumeSale,
        deleteSuspendedSale,
        clearAll,
    };
}
