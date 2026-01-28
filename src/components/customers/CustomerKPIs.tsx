import { Users, User, DollarSign } from "lucide-react";

interface CustomerKPIsProps {
    stats: {
        totalDebt: number;
        customersWithDebt: number;
        totalCustomers: number;
    };
}

export function CustomerKPIs({ stats }: CustomerKPIsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                        <h3 className="text-2xl font-bold mt-1">{stats.totalCustomers}</h3>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>
            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Clientes Deudores</p>
                        <h3 className="text-2xl font-bold mt-1 text-amber-500">{stats.customersWithDebt}</h3>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <User className="h-5 w-5 text-amber-500" />
                    </div>
                </div>
            </div>
            <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Deuda Total</p>
                        <h3 className="text-2xl font-bold mt-1 text-rose-500">${stats.totalDebt.toLocaleString()}</h3>
                    </div>
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-rose-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
