"use client";

import { Package, DollarSign, AlertTriangle } from "lucide-react";

interface ProductKPIsProps {
    totalProducts: number;
    inventoryValue: number;
    salesValue: number;
    lowStockCount: number;
}

export function ProductKPIs({
    totalProducts,
    inventoryValue,
    salesValue,
    lowStockCount,
}: ProductKPIsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-card p-5 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Productos activos</p>
                        <h3 className="mt-2 text-3xl font-bold tracking-tight">{totalProducts}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">En tu catálogo actual</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Package className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-5 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Valor de inventario</p>
                        <h3 className="mt-2 text-3xl font-bold tracking-tight">${inventoryValue.toLocaleString()}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Potencial Venta: <span className="text-emerald-500 font-medium">${salesValue.toLocaleString()}</span>
                        </p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-2.5">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-card p-5 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Stock bajo</p>
                        <h3 className="mt-2 text-3xl font-bold tracking-tight">{lowStockCount}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Productos que requieren atención</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 p-2.5">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
