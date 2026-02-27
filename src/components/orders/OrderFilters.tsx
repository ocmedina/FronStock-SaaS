import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface OrderFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    serviceTypeFilter: string;
    setServiceTypeFilter: (value: string) => void;
    dateFilter: string;
    setDateFilter: (value: string) => void;
}

export function OrderFilters({
    searchTerm,
    setSearchTerm,
    serviceTypeFilter,
    setServiceTypeFilter,
    dateFilter,
    setDateFilter,
}: OrderFiltersProps) {
    return (
        <Card className="bg-card border p-4">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, teléfono, dirección o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={serviceTypeFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setServiceTypeFilter("all")}
                        className={
                            serviceTypeFilter === "all"
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : ""
                        }
                    >
                        Todos
                    </Button>
                    <Button
                        variant={serviceTypeFilter === "counter" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setServiceTypeFilter("counter")}
                        className={
                            serviceTypeFilter === "counter"
                                ? "bg-purple-600 hover:bg-purple-500 text-white"
                                : ""
                        }
                    >
                        🏪 Mostrador
                    </Button>
                    <Button
                        variant={serviceTypeFilter === "delivery" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setServiceTypeFilter("delivery")}
                        className={
                            serviceTypeFilter === "delivery"
                                ? "bg-blue-600 hover:bg-blue-500 text-white"
                                : ""
                        }
                    >
                        🚚 Reparto
                    </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <span className="w-full text-xs text-muted-foreground mb-1">Rango de fechas</span>
                    <Button
                        variant={dateFilter === "today" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateFilter("today")}
                        className={
                            dateFilter === "today"
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : ""
                        }
                    >
                        Hoy
                    </Button>
                    <Button
                        variant={dateFilter === "week" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateFilter("week")}
                        className={
                            dateFilter === "week"
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : ""
                        }
                    >
                        7 días
                    </Button>
                    <Button
                        variant={dateFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateFilter("all")}
                        className={
                            dateFilter === "all"
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : ""
                        }
                    >
                        Todo el historial
                    </Button>
                </div>
            </div>
        </Card>
    );
}
