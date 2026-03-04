import { Card } from "@/components/ui/card";
import {
    LayoutGrid,
    TrendingUp,
    AlertCircle,
    ChefHat,
    Package,
    Truck,
    CheckCircle,
    DollarSign,
} from "lucide-react";

interface OrderStatsProps {
    stats: {
        total: number;
        pending: number;
        preparing: number;
        ready: number;
        shipping: number;
        delivered: number;
        totalRevenue: number;
    };
}

export function OrderStats({ stats }: OrderStatsProps) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-2 md:gap-3">
            <Card className="bg-card/80 border p-3">
                <div className="flex items-center justify-between mb-1">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 p-3">
                <div className="flex items-center justify-between mb-1">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400 leading-none">
                    {stats.pending}
                </div>
                <div className="text-xs text-yellow-600/70 dark:text-yellow-400/70">Nuevos</div>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 p-3">
                <div className="flex items-center justify-between mb-1">
                    <ChefHat className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400 leading-none">
                    {stats.preparing}
                </div>
                <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
                    Preparando
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border-cyan-500/20 p-3">
                <div className="flex items-center justify-between mb-1">
                    <Package className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-cyan-600 dark:text-cyan-400 leading-none">
                    {stats.ready}
                </div>
                <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70">Listos</div>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 p-3">
                <div className="flex items-center justify-between mb-1">
                    <Truck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                    {stats.shipping}
                </div>
                <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
                    En Camino
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20 p-3">
                <div className="flex items-center justify-between mb-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                    {stats.delivered}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                    Completados
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 p-3 col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                    ${stats.totalRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                    Ingresos
                </div>
            </Card>
        </div>
    );
}
