'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DollarSign, CreditCard, Wallet, Calculator, Plus, X, ArrowLeftRight } from 'lucide-react';
import type { Customer, PaymentMethod } from '../types';
import { cn } from '@/lib/utils';
import { CustomerSelector } from './CustomerSelector';

interface PaymentPanelProps {
    customers: Customer[];
    suppliers?: Array<{ id: string; name: string; current_balance?: number | null }>;
    canSettleSupplierDebt?: boolean;
    selectedCustomerId: string | null;
    subtotal: number;
    discount?: number;
    surcharge?: number;
    total: number;
    onCustomerChange: (customerId: string | null) => void;
    onProcessSale: (
        payments: Array<{ method: PaymentMethod; amount: number }>,
        options?: { supplierSettlement?: { supplierId: string; amount: number } }
    ) => void;
    processing?: boolean;
}

interface Payment {
    method: PaymentMethod;
    amount: number;
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];
const BILLS = [10000, 5000, 2000, 1000, 500, 200, 100, 50];

export function PaymentPanel({
    customers,
    suppliers = [],
    canSettleSupplierDebt = false,
    selectedCustomerId,
    subtotal,
    discount = 0,
    surcharge = 0,
    total,
    onCustomerChange,
    onProcessSale,
    processing = false,
}: PaymentPanelProps) {
    const [paymentMode, setPaymentMode] = useState<'simple' | 'mixed'>('simple');
    const [simpleMethod, setSimpleMethod] = useState<PaymentMethod>('cash');
    const [cashReceived, setCashReceived] = useState<string>('');
    
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const creditLimit = Number(selectedCustomer?.credit_limit || 0);
    const hasConfiguredLimit = creditLimit > 0;
    const currentBalance = selectedCustomer?.balance || 0;
    const availableCredit = hasConfiguredLimit ? (creditLimit - currentBalance) : Number.POSITIVE_INFINITY;
    const canUseCredit = Boolean(selectedCustomerId) && availableCredit >= total;

    // Mixed payments
    const [payments, setPayments] = useState<Payment[]>([]);
    const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>('cash');
    const [newPaymentAmount, setNewPaymentAmount] = useState<string>('');
    const [applySupplierSettlement, setApplySupplierSettlement] = useState(false);
    const [supplierToSettleId, setSupplierToSettleId] = useState<string>('');
    const [supplierSettlementAmount, setSupplierSettlementAmount] = useState<string>('');

    const change = cashReceived ? parseFloat(cashReceived) - total : 0;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = total - totalPaid;
    const suppliersWithDebt = suppliers.filter((s) => Number(s.current_balance || 0) > 0);
    const selectedSupplier = suppliersWithDebt.find((s) => s.id === supplierToSettleId);
    const selectedSupplierDebt = Number(selectedSupplier?.current_balance || 0);
    const maxSupplierSettlement = Math.min(total, selectedSupplierDebt);
    const parsedSupplierSettlementAmount = Number(supplierSettlementAmount || 0);
    const hasValidSupplierSettlement =
        applySupplierSettlement &&
        Boolean(supplierToSettleId) &&
        parsedSupplierSettlementAmount > 0 &&
        parsedSupplierSettlementAmount <= maxSupplierSettlement;

    useEffect(() => {
        if (!applySupplierSettlement) {
            setSupplierSettlementAmount('');
        }
    }, [applySupplierSettlement]);

    useEffect(() => {
        setSupplierSettlementAmount('');
    }, [supplierToSettleId]);

    const calculateBillBreakdown = (amount: number) => {
        const breakdown: { bill: number; count: number }[] = [];
        let rem = amount;

        for (const bill of BILLS) {
            if (rem >= bill) {
                const count = Math.floor(rem / bill);
                breakdown.push({ bill, count });
                rem -= bill * count;
            }
        }

        return breakdown;
    };

    const billBreakdown = change > 0 ? calculateBillBreakdown(change) : [];

    const addPayment = () => {
        const amount = parseFloat(newPaymentAmount);
        if (!amount || amount <= 0) return;
        if (amount > remaining) {
            return;
        }

        setPayments([...payments, { method: newPaymentMethod, amount }]);
        setNewPaymentAmount('');
    };

    const removePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleProcessSale = () => {
        const settlementOptions = hasValidSupplierSettlement
            ? { supplierSettlement: { supplierId: supplierToSettleId, amount: parsedSupplierSettlementAmount } }
            : undefined;

        if (paymentMode === 'simple') {
            onProcessSale([{ method: simpleMethod, amount: total }], settlementOptions);
        } else {
            onProcessSale(payments, settlementOptions);
        }
    };

    const canProcess =
        (paymentMode === 'simple'
            ? simpleMethod === 'cash'
                ? change >= 0
                : true
            : remaining <= 0) &&
        (!applySupplierSettlement || hasValidSupplierSettlement);

    const getPaymentLabel = (method: PaymentMethod) => {
        const labels = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            transfer: 'Transferencia',
            credit: 'Fiado'
        };
        return labels[method] || method;
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-border bg-muted/20">
                <h2 className="text-lg md:text-xl font-bold">💳 Panel de Pago</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
                {/* Customer Selection */}
                <CustomerSelector
                    customers={customers}
                    selectedCustomerId={selectedCustomerId}
                    onCustomerChange={onCustomerChange}
                />

                {/* Payment Mode Toggle */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Modo de Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={paymentMode === 'simple' ? 'default' : 'outline'}
                            onClick={() => setPaymentMode('simple')}
                            className="h-10"
                        >
                            Simple
                        </Button>
                        <Button
                            variant={paymentMode === 'mixed' ? 'default' : 'outline'}
                            onClick={() => setPaymentMode('mixed')}
                            className="h-10"
                        >
                            Mixto
                        </Button>
                    </div>
                </div>

                {/* SIMPLE PAYMENT MODE */}
                {paymentMode === 'simple' && (
                    <>
                        {/* Payment Method */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Método de Pago</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button
                                    variant={simpleMethod === 'cash' ? 'default' : 'outline'}
                                    className="h-12"
                                    onClick={() => setSimpleMethod('cash')}
                                >
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Efectivo
                                </Button>
                                <Button
                                    variant={simpleMethod === 'card' ? 'default' : 'outline'}
                                    className="h-12"
                                    onClick={() => setSimpleMethod('card')}
                                >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Tarjeta
                                </Button>
                                <Button
                                    variant={simpleMethod === 'transfer' ? 'default' : 'outline'}
                                    className="h-12"
                                    onClick={() => setSimpleMethod('transfer')}
                                >
                                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                                    Transfer.
                                </Button>
                                <Button
                                    variant={simpleMethod === 'credit' ? 'default' : 'outline'}
                                    className="h-12"
                                    onClick={() => setSimpleMethod('credit')}
                                    disabled={!selectedCustomerId || !canUseCredit}
                                    title={!selectedCustomerId ? 'Selecciona un cliente' : !canUseCredit ? 'Excede límite de crédito disponible' : ''}
                                >
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Fiado
                                </Button>
                            </div>
                        </div>

                        {/* Credit Info Alert */}
                        {simpleMethod === 'credit' && selectedCustomer && (
                            <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                                    <Wallet className="h-4 w-4" />
                                    Información de Crédito
                                </div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Cliente:</span>
                                        <span className="font-medium">{selectedCustomer.name}</span>
                                    </div>
                                    {selectedCustomer.business_type && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tipo:</span>
                                            <span className="font-medium">{selectedCustomer.business_type}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Límite de Crédito:</span>
                                        <span className="font-medium">
                                            {hasConfiguredLimit ? `$${creditLimit.toLocaleString()}` : 'Sin límite'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Balance Actual:</span>
                                        <span className={cn(
                                            "font-medium",
                                            currentBalance > 0 ? "text-red-500" : "text-green-500"
                                        )}>
                                            ${Math.abs(currentBalance).toLocaleString()} {currentBalance > 0 ? '(Debe)' : currentBalance < 0 ? '(A favor)' : ''}
                                        </span>
                                    </div>
                                    {hasConfiguredLimit ? (
                                        <>
                                            <div className="flex justify-between pt-2 border-t border-blue-500/20">
                                                <span className="font-medium">Crédito Disponible:</span>
                                                <span className="font-bold text-lg">${availableCredit.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Después de esta venta:</span>
                                                <span className={cn(
                                                    "font-medium",
                                                    (availableCredit - total) >= 0 ? "text-green-600" : "text-red-600"
                                                )}>
                                                    ${(availableCredit - total).toLocaleString()}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="pt-2 border-t border-blue-500/20 text-xs text-muted-foreground">
                                            Fiado habilitado sin límite máximo configurado.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Cash Payment */}
                        {simpleMethod === 'cash' && (
                            <div className="space-y-3">
                                <Label htmlFor="received" className="text-sm font-medium">
                                    Efectivo Recibido
                                </Label>
                                <Input
                                    id="received"
                                    type="number"
                                    inputMode="decimal"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    placeholder="$0"
                                    className="h-12 md:h-14 text-xl md:text-2xl font-bold text-center"
                                />

                                {/* Quick Amount Buttons */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCashReceived(total.toString())}
                                    >
                                        Exacto
                                    </Button>
                                    {QUICK_AMOUNTS.map((amount) => (
                                        <Button
                                            key={amount}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCashReceived(amount.toString())}
                                        >
                                            ${amount.toLocaleString()}
                                        </Button>
                                    ))}
                                </div>

                                {/* Change Display */}
                                {cashReceived && (
                                    <div
                                        className={cn(
                                            'p-4 rounded-xl border-2',
                                            change >= 0
                                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                                : 'bg-destructive/10 border-destructive/20'
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Calculator className="h-4 w-4" />
                                                Cambio:
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-2xl md:text-3xl font-bold',
                                                    change >= 0 ? 'text-emerald-600' : 'text-destructive'
                                                )}
                                            >
                                                ${Math.abs(change).toLocaleString('es-AR')}
                                            </span>
                                        </div>

                                        {change < 0 && (
                                            <p className="text-xs text-destructive">
                                                ⚠️ Falta: ${Math.abs(change).toLocaleString('es-AR')}
                                            </p>
                                        )}

                                        {/* Bill Breakdown */}
                                        {change > 0 && billBreakdown.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-emerald-500/20">
                                                <p className="text-xs text-muted-foreground mb-2">
                                                    💡 Sugerencia de billetes:
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {billBreakdown.map(({ bill, count }) => (
                                                        <span
                                                            key={bill}
                                                            className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                        >
                                                            {count}x ${bill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* MIXED PAYMENT MODE */}
                {paymentMode === 'mixed' && (
                    <div className="space-y-3">
                        {/* Payments List */}
                        {payments.length > 0 && (
                            <div className="space-y-2">
                                {payments.map((payment, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            {payment.method === 'cash' && <DollarSign className="h-4 w-4" />}
                                            {payment.method === 'card' && <CreditCard className="h-4 w-4" />}
                                            {payment.method === 'transfer' && <ArrowLeftRight className="h-4 w-4" />}
                                            {payment.method === 'credit' && <Wallet className="h-4 w-4" />}
                                            <span className="font-medium">{getPaymentLabel(payment.method)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-primary">
                                                ${payment.amount.toLocaleString('es-AR')}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive"
                                                onClick={() => removePayment(index)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Payment */}
                        {remaining > 0 && (
                            <div className="space-y-2 p-3 border-2 border-dashed border-border rounded-lg">
                                <Label className="text-xs font-medium">Agregar Pago</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Button
                                        variant={newPaymentMethod === 'cash' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setNewPaymentMethod('cash')}
                                    >
                                        <DollarSign className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant={newPaymentMethod === 'card' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setNewPaymentMethod('card')}
                                    >
                                        <CreditCard className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant={newPaymentMethod === 'transfer' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setNewPaymentMethod('transfer')}
                                    >
                                        <ArrowLeftRight className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant={newPaymentMethod === 'credit' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setNewPaymentMethod('credit')}
                                    >
                                        <Wallet className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        value={newPaymentAmount}
                                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                                        placeholder={`Máx: $${remaining.toLocaleString()}`}
                                        className="h-10"
                                    />
                                    <Button onClick={addPayment} size="sm" className="shrink-0">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setNewPaymentAmount(remaining.toString())}
                                >
                                    Completar (${remaining.toLocaleString()})
                                </Button>
                            </div>
                        )}

                        {/* Remaining Display */}
                        <div
                            className={cn(
                                'p-3 rounded-lg border-2',
                                remaining <= 0
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : 'bg-amber-500/10 border-amber-500/20'
                            )}
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Restante:</span>
                                <span
                                    className={cn(
                                        'text-2xl font-bold',
                                        remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'
                                    )}
                                >
                                    ${remaining.toLocaleString('es-AR')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {canSettleSupplierDebt && suppliersWithDebt.length > 0 && (
                    <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Saldar deuda de proveedor con esta venta</Label>
                            <Button
                                type="button"
                                variant={applySupplierSettlement ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setApplySupplierSettlement((prev) => !prev)}
                            >
                                {applySupplierSettlement ? 'Activado' : 'Desactivado'}
                            </Button>
                        </div>

                        {applySupplierSettlement && (
                            <div className="space-y-2">
                                <Select value={supplierToSettleId} onValueChange={setSupplierToSettleId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar proveedor con deuda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliersWithDebt.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name} - Deuda ${Number(supplier.current_balance || 0).toLocaleString('es-AR')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    max={maxSupplierSettlement > 0 ? maxSupplierSettlement : undefined}
                                    placeholder={maxSupplierSettlement > 0 ? `Máx: $${maxSupplierSettlement.toLocaleString('es-AR')}` : 'Monto a saldar'}
                                    value={supplierSettlementAmount}
                                    onChange={(e) => setSupplierSettlementAmount(e.target.value)}
                                />

                                {selectedSupplier && (
                                    <p className="text-xs text-muted-foreground">
                                        Deuda actual: ${selectedSupplierDebt.toLocaleString('es-AR')} · Máximo a aplicar desde esta venta: ${maxSupplierSettlement.toLocaleString('es-AR')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">${subtotal.toLocaleString('es-AR')}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600">
                            <span>Descuento:</span>
                            <span className="font-medium">-${discount.toLocaleString('es-AR')}</span>
                        </div>
                    )}
                    {surcharge > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                            <span>Recargo:</span>
                            <span className="font-medium">+${surcharge.toLocaleString('es-AR')}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold pt-2 border-t border-border">
                        <span>TOTAL:</span>
                        <span className="text-primary">${total.toLocaleString('es-AR')}</span>
                    </div>
                </div>
            </div>

            {/* Process Button */}
            <div className="p-3 md:p-4 border-t border-border">
                <Button
                    onClick={handleProcessSale}
                    disabled={!canProcess || processing}
                    className={cn(
                        'w-full h-14 md:h-16 text-base md:text-xl font-bold rounded-xl',
                        'bg-gradient-to-r from-emerald-600 to-emerald-500',
                        'hover:from-emerald-700 hover:to-emerald-600',
                        'shadow-lg shadow-emerald-500/30',
                        'hover:shadow-xl hover:shadow-emerald-500/40',
                        'active:scale-95 transition-all',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    {processing ? '⏳ Procesando...' : '💰 COBRAR'}
                </Button>
            </div>
        </div>
    );
}
