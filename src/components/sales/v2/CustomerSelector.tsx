'use client';

import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Building2, User, AlertTriangle, CreditCard } from 'lucide-react';
import type { Customer } from '../types';
import { cn } from '@/lib/utils';

interface CustomerSelectorProps {
    customers: Customer[];
    selectedCustomerId: string | null;
    onCustomerChange: (customerId: string | null) => void;
}

export function CustomerSelector({
    customers,
    selectedCustomerId,
    onCustomerChange,
}: CustomerSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const selectedCustomerBalance = selectedCustomer?.balance ?? 0;

    const filteredCustomers = useMemo(() => {
        if (!searchQuery.trim()) return customers;

        const query = searchQuery.toLowerCase();
        return customers.filter((c) =>
            c.name.toLowerCase().includes(query)
        );
    }, [customers, searchQuery]);

    const handleSelect = (customerId: string | null) => {
        onCustomerChange(customerId);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">Cliente</Label>

            {/* Selected Customer Display */}
            <div className="space-y-2">
                <Button
                    variant="outline"
                    className="w-full h-12 justify-between"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedCustomer?.business_type ? (
                            <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                        ) : selectedCustomer ? (
                            <User className="h-4 w-4 text-gray-500 shrink-0" />
                        ) : null}
                        <span className="truncate">
                            {selectedCustomer?.name || 'Consumidor Final'}
                            {selectedCustomer?.customer_type === 'wholesale' && ' (Mayorista)'}
                        </span>
                    </div>
                    <Search className="h-4 w-4 ml-2 shrink-0" />
                </Button>
                
                {/* Customer Info Badge */}
                {selectedCustomer?.business_type && (
                    <div className="flex items-center gap-2 text-sm">
                        {selectedCustomerBalance > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Debe ${Math.abs(selectedCustomerBalance).toLocaleString()}
                            </Badge>
                        ) : selectedCustomerBalance < 0 ? (
                            <Badge variant="secondary" className="gap-1">
                                A favor ${selectedCustomerBalance.toLocaleString()}
                            </Badge>
                        ) : null}
                        {(selectedCustomer.credit_limit || 0) > 0 && (
                            <Badge variant="outline" className="gap-1">
                                <CreditCard className="h-3 w-3" />
                                Crédito: ${(selectedCustomer.credit_limit || 0).toLocaleString()}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-[calc(100%-2rem)] max-w-md bg-popover border-2 border-border rounded-lg shadow-lg">
                    {/* Search Input */}
                    <div className="p-3 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="pl-10 pr-10"
                                autoFocus
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Customer List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {/* Default Option */}
                        <button
                            onClick={() => handleSelect(null)}
                            className={cn(
                                'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border',
                                !selectedCustomerId && 'bg-accent font-semibold'
                            )}
                        >
                            Consumidor Final
                        </button>

                        {/* Filtered Customers */}
                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((customer) => {
                                const hasDebt = (customer.balance || 0) > 0;
                                const creditLimit = Number(customer.credit_limit || 0);
                                const availableCredit = creditLimit > 0
                                    ? creditLimit - Number(customer.balance || 0)
                                    : null;
                                
                                return (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelect(customer.id)}
                                        className={cn(
                                            'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0',
                                            selectedCustomerId === customer.id && 'bg-accent font-semibold'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 min-w-0 flex-1">
                                                {customer.business_type ? (
                                                    <Building2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                ) : (
                                                    <User className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{customer.name}</div>
                                                    {customer.business_type && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {customer.business_type}
                                                        </div>
                                                    )}
                                                    {hasDebt && (
                                                        <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Debe: ${Math.abs(customer.balance || 0).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 shrink-0">
                                                {customer.customer_type === 'wholesale' && (
                                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                        Mayorista
                                                    </span>
                                                )}
                                                {(customer.credit_limit || 0) > 0 && (
                                                    <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">
                                                        💳 ${Math.max(0, Number(availableCredit || 0)).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                No se encontraron clientes
                            </div>
                        )}
                    </div>

                    {/* Close Button */}
                    <div className="p-2 border-t border-border">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                setIsOpen(false);
                                setSearchQuery('');
                            }}
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
