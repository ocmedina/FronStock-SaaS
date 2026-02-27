import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { DollarSign, Loader2, Package, Receipt } from 'lucide-react';

interface Supplier {
    id: string;
    name: string;
    current_balance?: number;
}

interface SupplierTransaction {
    id: string;
    transaction_type: string;
    amount: number;
    balance_after: number;
    description: string;
    transaction_date: string;
    created_at: string;
}

interface PurchaseOrder {
    id: string;
    order_number: string | null;
    status: string;
    total: number;
    created_at: string;
    received_at: string | null;
}

interface SupplierPayment {
    id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    reference_number: string | null;
    notes: string | null;
    created_at: string;
}

interface SupplierHistoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier: Supplier | null;
    onRegisterPayment: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    ordered: { label: 'Ordenado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    received: { label: 'Recibido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    purchase: { label: 'Compra', color: 'text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/30 dark:border-rose-800' },
    payment: { label: 'Pago', color: 'text-emerald-500 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800' },
    credit_note: { label: 'Nota de Crédito', color: 'text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800' },
    debit_note: { label: 'Nota de Débito', color: 'text-orange-500 border-orange-200 bg-orange-50 dark:bg-orange-900/30 dark:border-orange-800' },
    adjustment: { label: 'Ajuste', color: 'text-purple-500 border-purple-200 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-800' },
};

export function SupplierHistoryModal({
    open,
    onOpenChange,
    supplier,
    onRegisterPayment,
}: SupplierHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<'transactions' | 'orders' | 'payments'>('transactions');
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);

    const supabase = createClient();

    const loadData = useCallback(async () => {
        if (!supplier?.id || !open) return;
        setLoading(true);

        try {
            // Load transactions
            const { data: transactionsData } = await supabase
                .from('supplier_transactions')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (transactionsData) setTransactions(transactionsData);

            // Load purchase orders
            const { data: ordersData } = await supabase
                .from('purchase_orders')
                .select('id, order_number, status, total, created_at, received_at')
                .eq('supplier_id', supplier.id)
                .order('created_at', { ascending: false });

            if (ordersData) setPurchaseOrders(ordersData);

            // Load payments
            const { data: paymentsData } = await supabase
                .from('supplier_payments')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('payment_date', { ascending: false });

            if (paymentsData) setPayments(paymentsData);
        } catch (error) {
            console.error('Error loading supplier data:', error);
        } finally {
            setLoading(false);
        }
    }, [supplier?.id, open, supabase]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!supplier) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[65vw] max-w-[80vw] w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl">Historial del Proveedor</DialogTitle>
                            <p className="text-muted-foreground">{supplier.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Balance Actual</p>
                            <p
                                className={`text-2xl font-bold ${supplier.current_balance && supplier.current_balance > 0
                                        ? 'text-destructive'
                                        : 'text-emerald-500'
                                    }`}
                            >
                                ${(supplier.current_balance || 0).toLocaleString('es-AR')}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                    <Button
                        variant={activeTab === 'transactions' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('transactions')}
                        className="rounded-b-none"
                    >
                        <Receipt className="h-4 w-4 mr-2" />
                        Transacciones
                    </Button>
                    <Button
                        variant={activeTab === 'orders' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('orders')}
                        className="rounded-b-none"
                    >
                        <Package className="h-4 w-4 mr-2" />
                        Órdenes de Compra
                    </Button>
                    <Button
                        variant={activeTab === 'payments' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('payments')}
                        className="rounded-b-none"
                    >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Pagos
                    </Button>
                </div>

                {/* Content */}
                <div className="py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Transactions Tab */}
                            {activeTab === 'transactions' && (
                                <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <Button onClick={onRegisterPayment}>
                                            <DollarSign className="mr-2 h-4 w-4" /> Registrar Pago
                                        </Button>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Tipo</TableHead>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead className="text-right">Monto</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={5}
                                                            className="text-center text-muted-foreground py-8"
                                                        >
                                                            No hay transacciones
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    transactions.map((txn) => {
                                                        const typeInfo = TRANSACTION_TYPE_LABELS[txn.transaction_type] || {
                                                            label: txn.transaction_type,
                                                            color: 'text-gray-500',
                                                        };
                                                        return (
                                                            <TableRow key={txn.id}>
                                                                <TableCell>
                                                                    {new Date(txn.transaction_date).toLocaleDateString('es-AR')}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className={typeInfo.color}>
                                                                        {typeInfo.label}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="max-w-xs truncate">
                                                                    {txn.description}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    <span className={txn.amount > 0 ? 'text-destructive' : 'text-emerald-600'}>
                                                                        {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toLocaleString('es-AR')}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold">
                                                                    ${txn.balance_after.toLocaleString('es-AR')}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Purchase Orders Tab */}
                            {activeTab === 'orders' && (
                                <div className="space-y-4">
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Orden</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {purchaseOrders.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={4}
                                                            className="text-center text-muted-foreground py-8"
                                                        >
                                                            No hay órdenes de compra
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    purchaseOrders.map((order) => {
                                                        const statusInfo = STATUS_LABELS[order.status] || {
                                                            label: order.status,
                                                            color: 'bg-gray-100 text-gray-700',
                                                        };
                                                        return (
                                                            <TableRow key={order.id}>
                                                                <TableCell className="font-medium">
                                                                    {order.order_number || order.id.slice(0, 8)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span>
                                                                            {new Date(order.created_at).toLocaleDateString('es-AR')}
                                                                        </span>
                                                                        {order.received_at && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                Recibido: {new Date(order.received_at).toLocaleDateString('es-AR')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary" className={statusInfo.color}>
                                                                        {statusInfo.label}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold">
                                                                    ${order.total.toLocaleString('es-AR')}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Payments Tab */}
                            {activeTab === 'payments' && (
                                <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <Button onClick={onRegisterPayment}>
                                            <DollarSign className="mr-2 h-4 w-4" /> Registrar Pago
                                        </Button>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Método</TableHead>
                                                    <TableHead>Referencia</TableHead>
                                                    <TableHead>Notas</TableHead>
                                                    <TableHead className="text-right">Monto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payments.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={5}
                                                            className="text-center text-muted-foreground py-8"
                                                        >
                                                            No hay pagos registrados
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    payments.map((payment) => (
                                                        <TableRow key={payment.id}>
                                                            <TableCell>
                                                                {new Date(payment.payment_date).toLocaleDateString('es-AR')}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">
                                                                    {payment.payment_method === 'cash' && 'Efectivo'}
                                                                    {payment.payment_method === 'transfer' && 'Transferencia'}
                                                                    {payment.payment_method === 'check' && 'Cheque'}
                                                                    {payment.payment_method === 'card' && 'Tarjeta'}
                                                                    {payment.payment_method === 'cash_from_sales' && 'Caja Ventas'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">
                                                                {payment.reference_number || '-'}
                                                            </TableCell>
                                                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                                                {payment.notes || '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-emerald-600">
                                                                ${payment.amount.toLocaleString('es-AR')}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
