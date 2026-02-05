'use client';

import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
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
            <Button
                variant="outline"
                className="w-full h-12 justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">
                    {selectedCustomer?.name || 'Consumidor Final'}
                    {selectedCustomer?.customer_type === 'wholesale' && ' (Mayorista)'}
                </span>
                <Search className="h-4 w-4 ml-2 shrink-0" />
            </Button>

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
                            filteredCustomers.map((customer) => (
                                <button
                                    key={customer.id}
                                    onClick={() => handleSelect(customer.id)}
                                    className={cn(
                                        'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0',
                                        selectedCustomerId === customer.id && 'bg-accent font-semibold'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="truncate">{customer.name}</span>
                                        {customer.customer_type === 'wholesale' && (
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2 shrink-0">
                                                Mayorista
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
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
