import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Factory,
    Mail,
    Phone,
    User,
    Pencil,
    Trash2,
    DollarSign,
    CreditCard,
    TrendingUp,
    AlertCircle,
    Star,
    ShoppingCart,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Supplier {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    credit_limit?: number;
    current_balance?: number;
    payment_terms?: number;
    rating?: number;
    last_payment_date?: string;
    created_at: string;
}

interface SupplierCardProps {
    supplier: Supplier;
    onEdit?: (supplier: Supplier) => void;
    onDelete?: (id: string) => void;
    onClick?: (supplier: Supplier) => void;
    onCreateOrder?: (supplier: Supplier) => void;
    onViewHistory?: (supplier: Supplier) => void;
    canEdit?: boolean;
    canDelete?: boolean;
    canCreateOrders?: boolean;
}

export function SupplierCard({
    supplier,
    onEdit,
    onDelete,
    onClick,
    onCreateOrder,
    onViewHistory,
    canEdit = false,
    canDelete = false,
    canCreateOrders = false,
}: SupplierCardProps) {
    const balance = supplier.current_balance || 0;
    const creditLimit = supplier.credit_limit || 0;
    const availableCredit = creditLimit - balance;
    const creditUsagePercent = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;

    const isOverdue = balance > creditLimit;
    const isNearLimit = creditUsagePercent > 80;

    return (
        <Card
            className={cn(
                'hover:shadow-lg transition-all cursor-pointer group',
                isOverdue && 'border-destructive/50'
            )}
            onClick={() => onClick?.(supplier)}
        >
            <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white shrink-0">
                            <Factory className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">{supplier.name}</h3>
                            {supplier.rating && (
                                <div className="flex items-center gap-1 mt-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={cn(
                                                'h-3 w-3',
                                                i < supplier.rating!
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-muted-foreground/30'
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit?.(supplier);
                                }}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {canDelete && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete?.(supplier.id);
                                }}
                                className="text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                    {supplier.contact_name && (
                        <p className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{supplier.contact_name}</span>
                        </p>
                    )}
                    {supplier.email && (
                        <p className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{supplier.email}</span>
                        </p>
                    )}
                    {supplier.phone && (
                        <p className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{supplier.phone}</span>
                        </p>
                    )}
                </div>

                {/* Financial Info */}
                {(balance !== 0 || creditLimit > 0) && (
                    <>
                        <div className="border-t pt-4 space-y-3">
                            {/* Balance */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <DollarSign className="h-4 w-4" />
                                    <span>Balance</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'font-semibold',
                                            balance > 0 ? 'text-destructive' : 'text-emerald-600'
                                        )}
                                    >
                                        ${Math.abs(balance).toLocaleString('es-AR')}
                                    </span>
                                    {isOverdue && (
                                        <Badge variant="destructive" className="text-xs">
                                            Excedido
                                        </Badge>
                                    )}
                                    {isNearLimit && !isOverdue && (
                                        <AlertCircle className="h-4 w-4 text-amber-500" />
                                    )}
                                </div>
                            </div>

                            {/* Credit Limit */}
                            {creditLimit > 0 && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CreditCard className="h-4 w-4" />
                                        <span>Crédito disponible</span>
                                    </div>
                                    <span className="font-medium text-sm">
                                        ${availableCredit.toLocaleString('es-AR')}
                                    </span>
                                </div>
                            )}

                            {/* Credit Usage Bar */}
                            {creditLimit > 0 && (
                                <div className="space-y-1">
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                'h-full transition-all rounded-full',
                                                isOverdue
                                                    ? 'bg-destructive'
                                                    : isNearLimit
                                                        ? 'bg-amber-500'
                                                        : 'bg-primary'
                                            )}
                                            style={{
                                                width: `${Math.min(creditUsagePercent, 100)}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-right">
                                        {creditUsagePercent.toFixed(0)}% utilizado
                                    </p>
                                </div>
                            )}

                            {/* Payment Terms */}
                            {supplier.payment_terms && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <TrendingUp className="h-4 w-4" />
                                        <span>Condiciones</span>
                                    </div>
                                    <span className="text-sm font-medium">
                                        {supplier.payment_terms} días
                                    </span>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Quick Actions */}
                {(canCreateOrders || onViewHistory) && (
                    <div className="border-t pt-4 mt-4 flex gap-2">
                        {canCreateOrders && onCreateOrder && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateOrder(supplier);
                                }}
                            >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Nueva Orden
                            </Button>
                        )}
                        {onViewHistory && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewHistory(supplier);
                                }}
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Historial
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
