'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    stock: number;
}

interface StockMovement {
    id: string;
    product_id: string;
    product_name: string;
    movement_type: string;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reason: string | null;
    reference_type: string | null;
    notes: string | null;
    created_at: string;
}

const MOVEMENT_TYPES = {
    entry: { label: 'Entrada', variant: 'default' as const, icon: ArrowDownLeft },
    exit: { label: 'Salida', variant: 'destructive' as const, icon: ArrowUpRight },
    adjustment: { label: 'Ajuste', variant: 'secondary' as const, icon: RefreshCw },
};

const REASONS: Record<string, string> = {
    sale: 'Venta',
    purchase: 'Compra',
    adjustment: 'Ajuste de inventario',
    damaged: 'Producto dañado',
    lost: 'Pérdida',
    returned: 'Devolución',
    correction: 'Corrección',
    initial: 'Stock inicial',
    other: 'Otro',
};

export default function StockMovementsPage() {
    const { organizationId, profile, isLoading: orgLoading } = useOrganization();
    const { canCreate } = usePermissions();
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState({ type: 'all', productId: '' });
    const [formData, setFormData] = useState({
        product_id: '',
        movement_type: 'entry',
        quantity: 1,
        reason: 'adjustment',
        notes: '',
    });
    const [saving, setSaving] = useState(false);

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        let query = supabase
            .from('stock_movements')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (filter.type !== 'all') {
            query = query.eq('movement_type', filter.type);
        }
        if (filter.productId) {
            query = query.eq('product_id', filter.productId);
        }

        const { data: movementsData } = await query;
        if (movementsData) setMovements(movementsData);

        const { data: productsData } = await supabase
            .from('products')
            .select('id, name, stock')
            .eq('organization_id', organizationId)
            .order('name');
        if (productsData) setProducts(productsData);

        setIsLoading(false);
    }, [organizationId, filter, supabase]);

    useEffect(() => {
        if (organizationId) fetchData();
    }, [organizationId, fetchData]);

    const handleOpenModal = () => {
        if (products.length === 0) return;
        setFormData({
            product_id: products[0].id,
            movement_type: 'entry',
            quantity: 1,
            reason: 'adjustment',
            notes: '',
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || !profile) return;

        setSaving(true);

        const product = products.find((p) => p.id === formData.product_id);
        if (!product) {
            setSaving(false);
            return;
        }

        const isEntry = formData.movement_type === 'entry';
        const quantityChange = isEntry ? formData.quantity : -formData.quantity;
        const newStock = product.stock + quantityChange;

        if (newStock < 0) {
            alert('No hay suficiente stock para esta salida');
            setSaving(false);
            return;
        }

        await supabase.from('stock_movements').insert({
            organization_id: organizationId,
            product_id: formData.product_id,
            product_name: product.name,
            movement_type: formData.movement_type,
            quantity: quantityChange,
            previous_stock: product.stock,
            new_stock: newStock,
            reason: formData.reason,
            reference_type: 'manual',
            notes: formData.notes || null,
            created_by: profile.id,
        });

        await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', formData.product_id);

        setSaving(false);
        setShowModal(false);
        fetchData();
    };

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Movimientos de Stock</h1>
                    <p className="text-muted-foreground">Historial de entradas, salidas y ajustes</p>
                </div>
                {canCreate('products') && products.length > 0 && (
                    <Button onClick={handleOpenModal}>
                        <Plus /> Nuevo Movimiento
                    </Button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="w-40">
                    <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="entry">Entradas</SelectItem>
                            <SelectItem value="exit">Salidas</SelectItem>
                            <SelectItem value="adjustment">Ajustes</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-60">
                    <Select value={filter.productId || 'all'} onValueChange={(v) => setFilter({ ...filter, productId: v === 'all' ? '' : v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todos los productos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los productos</SelectItem>
                            {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Movements Table */}
            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Motivo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    No hay movimientos registrados
                                </TableCell>
                            </TableRow>
                        ) : (
                            movements.map((mov) => {
                                const typeInfo = MOVEMENT_TYPES[mov.movement_type as keyof typeof MOVEMENT_TYPES] || MOVEMENT_TYPES.adjustment;
                                const Icon = typeInfo.icon;
                                return (
                                    <TableRow key={mov.id}>
                                        <TableCell>
                                            <div>{new Date(mov.created_at).toLocaleDateString('es-AR')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(mov.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{mov.product_name}</TableCell>
                                        <TableCell>
                                            <Badge variant={typeInfo.variant} className="gap-1">
                                                <Icon className="h-3 w-3" /> {typeInfo.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                                                {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {mov.previous_stock} → <span className="font-medium text-foreground">{mov.new_stock}</span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {REASONS[mov.reason as string] || mov.reason || '-'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={() => setShowModal(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Movimiento de Stock</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Producto</label>
                            <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo</label>
                                <Select value={formData.movement_type} onValueChange={(v) => setFormData({ ...formData, movement_type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="entry">📥 Entrada</SelectItem>
                                        <SelectItem value="exit">📤 Salida</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cantidad</label>
                                <Input
                                    type="number"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                    min="1"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Motivo</label>
                            <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="adjustment">Ajuste de inventario</SelectItem>
                                    <SelectItem value="damaged">Producto dañado</SelectItem>
                                    <SelectItem value="lost">Pérdida</SelectItem>
                                    <SelectItem value="returned">Devolución</SelectItem>
                                    <SelectItem value="correction">Corrección</SelectItem>
                                    <SelectItem value="initial">Stock inicial</SelectItem>
                                    <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notas (opcional)</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                                placeholder="Descripción adicional..."
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving} className="flex-1">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                {saving ? 'Guardando...' : 'Registrar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
