'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import Link from 'next/link';

interface InvoiceDue {
    id: string;
    supplier_name: string;
    supplier_legal_name: string;
    invoice_number: string;
    due_date: string;
    pending_amount: number;
    urgency_status: 'overdue' | 'due_soon' | 'upcoming' | 'pending';
    days_overdue: number;
    days_until_due: number;
}

export function PaymentAlertsWidget() {
    const [invoices, setInvoices] = useState<InvoiceDue[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        overdue: 0,
        dueSoon: 0,
        totalPending: 0
    });
    const { organizationId } = useOrganization();
    const supabase = createClient();

    useEffect(() => {
        if (organizationId) {
            fetchDueInvoices();
        }
    }, [organizationId]);

    const fetchDueInvoices = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_invoices_due')
                .select('*')
                .eq('organization_id', organizationId)
                .limit(5);

            if (error) throw error;

            setInvoices(data || []);

            // Calcular estadísticas
            const overdue = data?.filter(inv => inv.urgency_status === 'overdue').length || 0;
            const dueSoon = data?.filter(inv => inv.urgency_status === 'due_soon').length || 0;
            const totalPending = data?.reduce((sum, inv) => sum + (inv.pending_amount || 0), 0) || 0;

            setStats({ overdue, dueSoon, totalPending });
        } catch (error) {
            console.error('Error fetching due invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUrgencyBadge = (status: string) => {
        switch (status) {
            case 'overdue':
                return <Badge variant="destructive" className="text-xs">Vencida</Badge>;
            case 'due_soon':
                return <Badge variant="default" className="bg-amber-500 text-xs">Próxima</Badge>;
            case 'upcoming':
                return <Badge variant="outline" className="text-xs">Esta Semana</Badge>;
            default:
                return <Badge variant="secondary" className="text-xs">Pendiente</Badge>;
        }
    };

    const getUrgencyIcon = (status: string) => {
        switch (status) {
            case 'overdue':
                return <AlertCircle className="h-4 w-4 text-destructive" />;
            case 'due_soon':
                return <Clock className="h-4 w-4 text-amber-500" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getDaysText = (invoice: InvoiceDue) => {
        if (invoice.urgency_status === 'overdue') {
            return `Vencida hace ${Math.abs(invoice.days_overdue)} día${Math.abs(invoice.days_overdue) !== 1 ? 's' : ''}`;
        } else {
            return `Vence en ${invoice.days_until_due} día${invoice.days_until_due !== 1 ? 's' : ''}`;
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Pagos Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pagos a Proveedores</CardTitle>
                    <Link href="/dashboard/suppliers/payments">
                        <Button variant="ghost" size="sm" className="h-8">
                            Ver Todos
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-destructive/10 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs font-medium text-destructive">Vencidas</span>
                        </div>
                        <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700">Próximas</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-700">{stats.dueSoon}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Total</span>
                        </div>
                        <p className="text-lg font-bold">
                            ${(stats.totalPending / 1000).toFixed(0)}k
                        </p>
                    </div>
                </div>

                {/* Lista de Facturas */}
                {invoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay pagos pendientes</p>
                        <p className="text-xs mt-1">¡Excelente gestión!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {invoices.map((invoice) => (
                            <div
                                key={invoice.id}
                                className={`p-3 rounded-lg border transition-colors hover:bg-muted/50 ${invoice.urgency_status === 'overdue' ? 'border-l-4 border-l-destructive bg-destructive/5' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getUrgencyIcon(invoice.urgency_status)}
                                            <span className="font-medium text-sm truncate">
                                                {invoice.supplier_name}
                                            </span>
                                            {getUrgencyBadge(invoice.urgency_status)}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-mono">{invoice.invoice_number}</span>
                                            <span>•</span>
                                            <span>{getDaysText(invoice)}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-sm ${invoice.urgency_status === 'overdue' ? 'text-destructive' : ''
                                            }`}>
                                            ${invoice.pending_amount.toLocaleString('es-AR')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(invoice.due_date).toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: 'short'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {invoices.length > 0 && (
                    <Link href="/dashboard/suppliers/payments">
                        <Button variant="outline" className="w-full" size="sm">
                            Ver Todos los Pagos Pendientes
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
