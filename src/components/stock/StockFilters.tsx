import { BarChart3, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Product } from "./types";

interface StockFiltersProps {
    filter: { type: string; productId: string };
    onFilterChange: (updates: Partial<{ type: string; productId: string }>) => void;
    products: Product[];
}

export function StockFilters({ filter, onFilterChange, products }: StockFiltersProps) {
    return (
        <div className="flex flex-wrap gap-4">
            <div className="w-40">
                <Select
                    value={filter.type}
                    onValueChange={(v) => onFilterChange({ type: v })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Todos
                            </div>
                        </SelectItem>
                        <SelectItem value="entry">
                            <div className="flex items-center gap-2">
                                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                                Entradas
                            </div>
                        </SelectItem>
                        <SelectItem value="exit">
                            <div className="flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4 text-red-600" />
                                Salidas
                            </div>
                        </SelectItem>
                        <SelectItem value="adjustment">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-blue-600" />
                                Ajustes
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="w-60">
                <Select
                    value={filter.productId || "all"}
                    onValueChange={(v) =>
                        onFilterChange({ productId: v === "all" ? "" : v })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Todos los productos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los productos</SelectItem>
                        {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
