"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { InvoiceType, AfipStatus } from "./types";

interface InvoiceFiltersProps {
    onFilterChange: (filters: InvoiceFilterValues) => void;
}

export interface InvoiceFilterValues {
    type?: InvoiceType;
    afipStatus?: AfipStatus;
    dateFrom?: Date;
    dateTo?: Date;
    searchTerm?: string;
}

export function InvoiceFilters({ onFilterChange }: InvoiceFiltersProps) {
    const [filters, setFilters] = useState<InvoiceFilterValues>({});
    const [showFilters, setShowFilters] = useState(false);

    const handleFilterChange = (key: keyof InvoiceFilterValues, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const clearFilters = () => {
        setFilters({});
        onFilterChange({});
    };

    const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

    return (
        <div className="space-y-4">
            <div className="flex gap-2 items-center">
                <Input
                    placeholder="Buscar por número de factura..."
                    value={filters.searchTerm || ""}
                    onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                    className="max-w-xs"
                />
                <Button
                    variant={showFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filtros
                </Button>
                {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters} className="gap-2">
                        <X className="h-4 w-4" />
                        Limpiar
                    </Button>
                )}
            </div>

            {showFilters && (
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Tipo de Factura */}
                            <div className="space-y-2">
                                <Label>Tipo de Factura</Label>
                                <Select
                                    value={filters.type || "all"}
                                    onValueChange={(v) =>
                                        handleFilterChange("type", v === "all" ? undefined : v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="A">Factura A</SelectItem>
                                        <SelectItem value="B">Factura B</SelectItem>
                                        <SelectItem value="C">Factura C</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Estado AFIP */}
                            <div className="space-y-2">
                                <Label>Estado AFIP</Label>
                                <Select
                                    value={filters.afipStatus || "all"}
                                    onValueChange={(v) =>
                                        handleFilterChange("afipStatus", v === "all" ? undefined : v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="pending">Pendiente</SelectItem>
                                        <SelectItem value="authorised">Autorizado</SelectItem>
                                        <SelectItem value="rejected">Rechazado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Fecha Desde */}
                            <div className="space-y-2">
                                <Label>Fecha Desde</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.dateFrom ? (
                                                format(filters.dateFrom, "PPP", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filters.dateFrom}
                                            onSelect={(date) => handleFilterChange("dateFrom", date)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Fecha Hasta */}
                            <div className="space-y-2">
                                <Label>Fecha Hasta</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.dateTo ? (
                                                format(filters.dateTo, "PPP", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filters.dateTo}
                                            onSelect={(date) => handleFilterChange("dateTo", date)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
