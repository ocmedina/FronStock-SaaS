"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
    CalendarIcon,
    Filter,
    X,
    Banknote,
    CreditCard,
    Building,
    User,
    Truck,
    Store,
    ShoppingBag,
    Users,
    DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    ReportFilters,
    paymentMethodOptions,
    salesChannelOptions,
    customerTypeOptions,
    PaymentMethodFilter,
    SalesChannelFilter,
    CustomerTypeFilter,
} from "./types";

interface ReportsFiltersProps {
    filters: ReportFilters;
    onFiltersChange: (filters: ReportFilters) => void;
    onApplyFilters: () => void;
}

const iconMap: Record<string, any> = {
    Banknote,
    CreditCard,
    Building,
    User,
    Truck,
    Store,
    ShoppingBag,
    Users,
};

export function ReportsFilters({
    filters,
    onFiltersChange,
    onApplyFilters,
}: ReportsFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    const updateFilters = (updates: Partial<ReportFilters>) => {
        onFiltersChange({ ...filters, ...updates });
    };

    const togglePaymentMethod = (method: PaymentMethodFilter) => {
        const current = filters.paymentMethods;
        const updated = current.includes(method)
            ? current.filter((m) => m !== method)
            : [...current, method];
        updateFilters({ paymentMethods: updated });
    };

    const toggleSalesChannel = (channel: SalesChannelFilter) => {
        const current = filters.salesChannels;
        const updated = current.includes(channel)
            ? current.filter((c) => c !== channel)
            : [...current, channel];
        updateFilters({ salesChannels: updated });
    };

    const toggleCustomerType = (type: CustomerTypeFilter) => {
        const current = filters.customerTypes;
        const updated = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        updateFilters({ customerTypes: updated });
    };

    const clearAllFilters = () => {
        onFiltersChange({
            startDate: null,
            endDate: null,
            paymentMethods: [],
            salesChannels: [],
            customerTypes: [],
            minAmount: null,
            maxAmount: null,
            quickPeriod: "month",
        });
        onApplyFilters();
    };

    const getActiveFilterCount = () => {
        let count = 0;
        if (filters.paymentMethods.length > 0) count++;
        if (filters.salesChannels.length > 0) count++;
        if (filters.customerTypes.length > 0) count++;
        if (filters.minAmount !== null || filters.maxAmount !== null) count++;
        if (filters.startDate || filters.endDate) count++;
        return count;
    };

    const activeCount = getActiveFilterCount();

    return (
        <div className="space-y-4">
            {/* Filter Toggle Button */}
            <div className="flex items-center gap-3">
                <Button
                    variant={showFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros Avanzados
                    {activeCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                        >
                            {activeCount}
                        </Badge>
                    )}
                </Button>

                {activeCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar filtros
                    </Button>
                )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <Card className="border-2 border-primary/20">
                    <CardContent className="p-6 space-y-6">
                        {/* Date Range */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                Rango de Fechas
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Fecha Inicio
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !filters.startDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.startDate ? (
                                                    format(filters.startDate, "PPP", { locale: es })
                                                ) : (
                                                    <span>Seleccionar fecha</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filters.startDate || undefined}
                                                onSelect={(date) =>
                                                    updateFilters({ startDate: date || null })
                                                }
                                                initialFocus
                                                locale={es}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Fecha Fin
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !filters.endDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.endDate ? (
                                                    format(filters.endDate, "PPP", { locale: es })
                                                ) : (
                                                    <span>Seleccionar fecha</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filters.endDate || undefined}
                                                onSelect={(date) =>
                                                    updateFilters({ endDate: date || null })
                                                }
                                                initialFocus
                                                locale={es}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Métodos de Pago
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {paymentMethodOptions.map((option) => {
                                    const Icon = iconMap[option.icon || ""];
                                    const isActive = filters.paymentMethods.includes(
                                        option.value as PaymentMethodFilter
                                    );
                                    return (
                                        <Button
                                            key={option.value}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() =>
                                                togglePaymentMethod(option.value as PaymentMethodFilter)
                                            }
                                            className="gap-2"
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sales Channels */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Canales de Venta
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {salesChannelOptions.map((option) => {
                                    const Icon = iconMap[option.icon || ""];
                                    const isActive = filters.salesChannels.includes(
                                        option.value as SalesChannelFilter
                                    );
                                    return (
                                        <Button
                                            key={option.value}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() =>
                                                toggleSalesChannel(option.value as SalesChannelFilter)
                                            }
                                            className="gap-2"
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Customer Types */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Tipo de Cliente
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {customerTypeOptions.map((option) => {
                                    const Icon = iconMap[option.icon || ""];
                                    const isActive = filters.customerTypes.includes(
                                        option.value as CustomerTypeFilter
                                    );
                                    return (
                                        <Button
                                            key={option.value}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() =>
                                                toggleCustomerType(option.value as CustomerTypeFilter)
                                            }
                                            className="gap-2"
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {option.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Amount Range */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Rango de Montos
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Monto Mínimo
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="$0"
                                        value={filters.minAmount || ""}
                                        onChange={(e) =>
                                            updateFilters({
                                                minAmount: e.target.value
                                                    ? parseFloat(e.target.value)
                                                    : null,
                                            })
                                        }
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Monto Máximo
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="Sin límite"
                                        value={filters.maxAmount || ""}
                                        onChange={(e) =>
                                            updateFilters({
                                                maxAmount: e.target.value
                                                    ? parseFloat(e.target.value)
                                                    : null,
                                            })
                                        }
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Apply Button */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => setShowFilters(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    onApplyFilters();
                                    setShowFilters(false);
                                }}
                                className="gap-2"
                            >
                                <Filter className="h-4 w-4" />
                                Aplicar Filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Active Filters Summary */}
            {activeCount > 0 && !showFilters && (
                <div className="flex flex-wrap gap-2">
                    {filters.paymentMethods.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                            <CreditCard className="h-3 w-3" />
                            {filters.paymentMethods.length} método(s) de pago
                        </Badge>
                    )}
                    {filters.salesChannels.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                            <Truck className="h-3 w-3" />
                            {filters.salesChannels.length} canal(es)
                        </Badge>
                    )}
                    {filters.customerTypes.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {filters.customerTypes.length} tipo(s) de cliente
                        </Badge>
                    )}
                    {(filters.minAmount !== null || filters.maxAmount !== null) && (
                        <Badge variant="secondary" className="gap-1">
                            <DollarSign className="h-3 w-3" />
                            Rango de montos
                        </Badge>
                    )}
                    {(filters.startDate || filters.endDate) && (
                        <Badge variant="secondary" className="gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Rango personalizado
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
