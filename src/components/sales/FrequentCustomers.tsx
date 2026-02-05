'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Star, TrendingUp } from 'lucide-react';
import type { Customer } from '@/components/sales/types';

interface FrequentCustomersProps {
    onSelectCustomer: (customerId: string) => void;
    selectedCustomerId?: string | null;
}

interface CustomerWithStats extends Customer {
    purchase_count?: number;
    total_spent?: number;
    last_purchase?: string;
}

export function FrequentCustomers({
    onSelectCustomer,
    selectedCustomerId,
}: FrequentCustomersProps) {
    const { organization } = useOrganization();
    const [frequentCustomers, setFrequentCustomers] = useState<CustomerWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!organization?.id) return;

        const loadFrequentCustomers = async () => {
            setIsLoading(true);
            const supabase = createClient();

            // Get customers with their sales count
            const { data, error } = await supabase
                .from('customers')
                .select(`
          *,
          sales:sales(count)
        `)
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!error && data) {
                // Sort by sales count
                const sorted = data
                    .map((customer: any) => ({
                        ...customer,
                        purchase_count: customer.sales?.[0]?.count || 0,
                    }))
                    .filter((c: any) => c.purchase_count > 0)
                    .sort((a: any, b: any) => b.purchase_count - a.purchase_count)
                    .slice(0, 8);

                setFrequentCustomers(sorted);
            }

            setIsLoading(false);
        };

        loadFrequentCustomers();
    }, [organization?.id]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Clientes Frecuentes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-sm text-muted-foreground">
                        Cargando...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (frequentCustomers.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Clientes Frecuentes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-sm text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p>No hay clientes frecuentes aún</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Clientes Frecuentes
                    <Badge variant="secondary" className="ml-auto">
                        {frequentCustomers.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2">
                    {frequentCustomers.map((customer) => (
                        <Button
                            key={customer.id}
                            variant={selectedCustomerId === customer.id ? 'default' : 'outline'}
                            onClick={() => onSelectCustomer(customer.id)}
                            className="h-auto flex-col items-start p-3 relative group"
                        >
                            <div className="flex items-center gap-2 w-full">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-primary">
                                        {customer.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium truncate">
                                        {customer.name}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <TrendingUp className="h-3 w-3" />
                                        <span>{customer.purchase_count} compras</span>
                                    </div>
                                </div>
                            </div>
                            {customer.customer_type === 'wholesale' && (
                                <Badge
                                    variant="secondary"
                                    className="absolute top-1 right-1 text-[10px] h-4 px-1"
                                >
                                    Mayorista
                                </Badge>
                            )}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
