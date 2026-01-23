import { ArrowDownLeft, ArrowUpRight, RefreshCw, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StockStats {
    entries: number;
    exits: number;
    adjustments: number;
    totalEntryQty: number;
    totalExitQty: number;
}

interface StockKPIsProps {
    stats: StockStats;
    productsCount: number;
}

export function StockKPIs({ stats, productsCount }: StockKPIsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm">Entradas</p>
                            <p className="text-2xl font-bold mt-1">+{stats.totalEntryQty}</p>
                            <p className="text-emerald-100 text-xs mt-1">
                                {stats.entries} movimientos
                            </p>
                        </div>
                        <ArrowDownLeft className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0 shadow-lg shadow-red-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-red-100 text-sm">Salidas</p>
                            <p className="text-2xl font-bold mt-1">-{stats.totalExitQty}</p>
                            <p className="text-red-100 text-xs mt-1">
                                {stats.exits} movimientos
                            </p>
                        </div>
                        <ArrowUpRight className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Ajustes</p>
                            <p className="text-2xl font-bold mt-1">{stats.adjustments}</p>
                            <p className="text-blue-100 text-xs mt-1">correcciones</p>
                        </div>
                        <RefreshCw className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Productos</p>
                            <p className="text-2xl font-bold mt-1">{productsCount}</p>
                            <p className="text-muted-foreground text-xs mt-1">en inventario</p>
                        </div>
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
