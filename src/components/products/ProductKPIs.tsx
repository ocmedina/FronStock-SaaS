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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                        <h3 className="text-2xl font-bold mt-1">{totalProducts}</h3>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Package className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Valor Inventario</p>
                        <h3 className="text-2xl font-bold mt-1">${inventoryValue.toLocaleString()}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Potencial Venta: <span className="text-emerald-500 font-medium">${salesValue.toLocaleString()}</span>
                        </p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
                        <h3 className="text-2xl font-bold mt-1">{lowStockCount}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Productos requieren atención</p>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
