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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="bg-card border p-4">
                <div className="flex items-center justify-between mb-2">
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.pending}
                </div>
                <div className="text-xs text-yellow-600/70 dark:text-yellow-400/70">Nuevos</div>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <ChefHat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.preparing}
                </div>
                <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
                    Preparando
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border-cyan-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {stats.ready}
                </div>
                <div className="text-xs text-cyan-600/70 dark:text-cyan-400/70">Listos</div>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {stats.shipping}
                </div>
                <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
                    En Camino
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.delivered}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                    Completados
                </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 p-4">
                <div className="flex items-center justify-between mb-2">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    ${stats.totalRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                    Ingresos
                </div>
            </Card>
        </div>
    );
}
