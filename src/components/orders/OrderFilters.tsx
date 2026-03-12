import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Store, Truck } from "lucide-react";

interface OrderFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    serviceTypeFilter: string;
    setServiceTypeFilter: (value: string) => void;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    dateFilter: string;
    setDateFilter: (value: string) => void;
}

const STATUS_OPTIONS = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Nuevos" },
    { value: "confirmed", label: "Confirmados" },
    { value: "preparing", label: "Preparando" },
    { value: "ready", label: "Listos" },
    { value: "shipping", label: "En camino" },
    { value: "delivered", label: "Completados" },
    { value: "not_delivered", label: "No entregados" },
];

export function OrderFilters({
    searchTerm,
    setSearchTerm,
    serviceTypeFilter,
    setServiceTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
}: OrderFiltersProps) {
    return (
        <Card className="bg-card border p-4">
            <div className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, teléfono, dirección o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="text-xs text-muted-foreground">Tipo de servicio</span>
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
                        <Store className="h-4 w-4 inline mr-1" />Mostrador
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
                        <Truck className="h-4 w-4 inline mr-1" />Reparto
                    </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="text-xs text-muted-foreground">Estado</span>
                    {STATUS_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            variant={statusFilter === option.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(option.value)}
                            className={
                                statusFilter === option.value
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : ""
                            }
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="text-xs text-muted-foreground">Rango de fechas</span>
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
