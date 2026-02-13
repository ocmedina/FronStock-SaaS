'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Building2, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdvanceCalculation {
    requires_advance: boolean;
    total_amount: number;
    advance_amount?: number;
    balance_amount?: number;
    advance_percentage?: number;
    payment_days: number;
    due_date: string;
    supplier_info: {
        name: string;
        legal_name?: string;
        tax_id?: string;
    };
    bank_info: {
        bank_name?: string;
        account_number?: string;
        cbu_alias?: string;
    };
}

interface AdvancePaymentCalculatorProps {
    supplierId: string;
    invoiceAmount: number;
    invoiceDate: string;
    onCalculationComplete?: (calculation: AdvanceCalculation) => void;
}

export function AdvancePaymentCalculator({
    supplierId,
    invoiceAmount,
    invoiceDate,
    onCalculationComplete
}: AdvancePaymentCalculatorProps) {
    const [calculation, setCalculation] = useState<AdvanceCalculation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        calculateAdvance();
    }, [supplierId, invoiceAmount, invoiceDate]);

    const calculateAdvance = async () => {
        setLoading(true);
        setError(null);

        try {
            // Obtener información del proveedor
            const { data: supplier, error: supplierError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', supplierId)
                .single();

            if (supplierError) throw supplierError;

            // Calcular fecha de vencimiento
            const invoiceDateObj = new Date(invoiceDate);
            const paymentDays = supplier.payment_days || 30;
            const dueDate = new Date(invoiceDateObj);
            dueDate.setDate(dueDate.getDate() + paymentDays);

            // Calcular anticipo si es requerido
            let calc: AdvanceCalculation;

            if (supplier.requires_advance) {
                const advanceAmount = Math.round((invoiceAmount * (supplier.advance_percentage / 100)) * 100) / 100;
                const balanceAmount = invoiceAmount - advanceAmount;

                calc = {
                    requires_advance: true,
                    total_amount: invoiceAmount,
                    advance_amount: advanceAmount,
                    balance_amount: balanceAmount,
                    advance_percentage: supplier.advance_percentage,
                    payment_days: paymentDays,
                    due_date: dueDate.toISOString().split('T')[0],
                    supplier_info: {
                        name: supplier.name,
                        legal_name: supplier.legal_name,
                        tax_id: supplier.tax_id
                    },
                    bank_info: {
                        bank_name: supplier.bank_name,
                        account_number: supplier.bank_account_number,
                        cbu_alias: supplier.bank_cbu_alias
                    }
                };
            } else {
                calc = {
                    requires_advance: false,
                    total_amount: invoiceAmount,
                    payment_days: paymentDays,
                    due_date: dueDate.toISOString().split('T')[0],
                    supplier_info: {
                        name: supplier.name,
                        legal_name: supplier.legal_name,
                        tax_id: supplier.tax_id
                    },
                    bank_info: {
                        bank_name: supplier.bank_name,
                        account_number: supplier.bank_account_number,
                        cbu_alias: supplier.bank_cbu_alias
                    }
                };
            }

            setCalculation(calc);
            onCalculationComplete?.(calc);
        } catch (err: any) {
            console.error('Error calculating advance:', err);
            setError(err.message || 'Error al calcular anticipo');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!calculation) return null;

    return (
        <div className="space-y-4">
            {/* Información del Proveedor */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">Información del Proveedor</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Proveedor:</span>
                        <span className="text-sm font-medium">{calculation.supplier_info.name}</span>
                    </div>
                    {calculation.supplier_info.legal_name && (
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Razón Social:</span>
                            <span className="text-sm font-medium">{calculation.supplier_info.legal_name}</span>
                        </div>
                    )}
                    {calculation.supplier_info.tax_id && (
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">CUIT/RUT:</span>
                            <span className="text-sm font-mono">{calculation.supplier_info.tax_id}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Cálculo de Pagos */}
            <Card className={calculation.requires_advance ? 'border-amber-500' : ''}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">Condiciones de Pago</CardTitle>
                        </div>
                        {calculation.requires_advance && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                Requiere Anticipo
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total de la Factura:</span>
                        <span className="text-lg font-bold">${calculation.total_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {calculation.requires_advance && (
                        <>
                            <div className="border-t pt-3 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Anticipo ({calculation.advance_percentage}%):</span>
                                        <Badge variant="secondary" className="text-xs">Pago Inmediato</Badge>
                                    </div>
                                    <span className="text-lg font-bold text-amber-600">
                                        ${calculation.advance_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Saldo:</span>
                                        <Badge variant="outline" className="text-xs">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {calculation.payment_days} días
                                        </Badge>
                                    </div>
                                    <span className="text-lg font-bold text-primary">
                                        ${calculation.balance_amount?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Fecha de Vencimiento:</span>
                        <span className="font-medium">
                            {new Date(calculation.due_date).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            })}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Datos Bancarios */}
            {(calculation.bank_info.bank_name || calculation.bank_info.cbu_alias) && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">Datos para Transferencia</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {calculation.bank_info.bank_name && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Banco:</span>
                                <span className="text-sm font-medium">{calculation.bank_info.bank_name}</span>
                            </div>
                        )}
                        {calculation.bank_info.account_number && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Cuenta:</span>
                                <span className="text-sm font-mono">{calculation.bank_info.account_number}</span>
                            </div>
                        )}
                        {calculation.bank_info.cbu_alias && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">CBU/Alias:</span>
                                <span className="text-sm font-mono font-medium">{calculation.bank_info.cbu_alias}</span>
                            </div>
                        )}
                        {calculation.requires_advance && calculation.advance_amount && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-amber-900">Transferir Anticipo</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            Monto: ${calculation.advance_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Resumen */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">
                    {calculation.requires_advance
                        ? `Se crearán 2 pagos: Anticipo de $${calculation.advance_amount?.toLocaleString('es-AR')} (inmediato) y saldo de $${calculation.balance_amount?.toLocaleString('es-AR')} (${calculation.payment_days} días)`
                        : `Pago único de $${calculation.total_amount.toLocaleString('es-AR')} con vencimiento en ${calculation.payment_days} días`
                    }
                </p>
            </div>
        </div>
    );
}
