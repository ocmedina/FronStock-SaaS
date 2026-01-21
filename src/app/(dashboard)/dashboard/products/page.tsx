'use client';

import { useState, useEffect } from 'react';
import { useSupabaseTable } from '@/hooks/useSupabaseTable';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Pencil, Trash2, Loader2, FileSpreadsheet, Edit3, Tag, MoreHorizontal } from 'lucide-react';
import { ImportExcelModal, type ImportedProduct, BulkUpdateModal, type BulkUpdateData, LabelModal } from '@/components/products';

export default function ProductsPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canCreate, canEdit, canDelete } = usePermissions();
    const { data: products, isLoading, error, getAll, create, update, remove } = useSupabaseTable<Product>({ table: 'products' });

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // New states for bulk operations
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
    const [showLabelModal, setShowLabelModal] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (organizationId) {
            getAll({ orderBy: { column: 'created_at', ascending: false } });
        }
    }, [organizationId, getAll]);

    const handleSave = async (productData: Omit<Product, 'id' | 'organization_id' | 'created_at'>) => {
        if (editingProduct) {
            await update(editingProduct.id, productData);
        } else {
            await create(productData as Omit<Product, keyof { id: string; organization_id: string; created_at: string }>);
        }
        setShowModal(false);
        setEditingProduct(null);
        getAll({ orderBy: { column: 'created_at', ascending: false } });
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            await remove(id);
            getAll({ orderBy: { column: 'created_at', ascending: false } });
        }
    };

    // Bulk selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // Import handler
    const handleImport = async (importedProducts: ImportedProduct[]) => {
        if (!organizationId) return;

        for (const product of importedProducts) {
            await supabase.from('products').insert({
                organization_id: organizationId,
                name: product.name,
                sku: product.sku,
                price: product.price,
                stock: product.stock,
            });
        }

        getAll({ orderBy: { column: 'created_at', ascending: false } });
    };

    // Bulk update handler
    const handleBulkUpdate = async (updates: BulkUpdateData) => {
        const selectedProducts = products.filter(p => selectedIds.has(p.id));

        for (const product of selectedProducts) {
            let newValue: number;
            const currentValue = updates.field === 'price' ? product.price : product.stock;

            switch (updates.operation) {
                case 'set':
                    newValue = updates.value;
                    break;
                case 'add':
                    newValue = currentValue + updates.value;
                    break;
                case 'subtract':
                    newValue = Math.max(0, currentValue - updates.value);
                    break;
                case 'percentage':
                    newValue = currentValue * (1 + updates.value / 100);
                    break;
                default:
                    newValue = currentValue;
            }

            if (updates.field === 'price') {
                newValue = Math.round(newValue * 100) / 100; // Round to 2 decimals
            } else {
                newValue = Math.round(newValue); // Round stock to integer
            }

            await supabase
                .from('products')
                .update({ [updates.field]: newValue })
                .eq('id', product.id);
        }

        setSelectedIds(new Set());
        getAll({ orderBy: { column: 'created_at', ascending: false } });
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 rounded-lg bg-destructive/10 text-destructive">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Productos</h1>
                    <p className="text-muted-foreground">{products.length} productos en inventario</p>
                </div>
                <div className="flex items-center gap-2">
                    {canCreate('products') && (
                        <>
                            <Button variant="outline" onClick={() => setShowImportModal(true)}>
                                <FileSpreadsheet className="h-4 w-4" /> Importar Excel
                            </Button>
                            <Button onClick={() => { setEditingProduct(null); setShowModal(true); }}>
                                <Plus /> Nuevo Producto
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Search and Bulk Actions */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar productos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {selectedIds.size} seleccionados
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setShowBulkUpdateModal(true)}>
                            <Edit3 className="h-4 w-4" /> Actualizar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowLabelModal(true)}>
                            <Tag className="h-4 w-4" /> Etiquetas
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                            Limpiar
                        </Button>
                    </div>
                )}
            </div>

            {/* Products Table */}
            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    {searchQuery ? 'No se encontraron productos' : 'No hay productos. ¡Crea el primero!'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => (
                                <TableRow key={product.id} className={selectedIds.has(product.id) ? 'bg-muted/50' : ''}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(product.id)}
                                            onCheckedChange={() => toggleSelect(product.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{product.sku || '-'}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        ${Number(product.price).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={
                                            product.stock <= 0 ? 'destructive' :
                                                product.stock <= 10 ? 'secondary' : 'default'
                                        }>
                                            {product.stock}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon-sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {canEdit('products') && (
                                                    <DropdownMenuItem onClick={() => { setEditingProduct(product); setShowModal(true); }}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => {
                                                    setSelectedIds(new Set([product.id]));
                                                    setShowLabelModal(true);
                                                }}>
                                                    <Tag className="h-4 w-4 mr-2" />
                                                    Generar Etiqueta
                                                </DropdownMenuItem>
                                                {canDelete('products') && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(product.id)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Product Modal */}
            <ProductModal
                open={showModal}
                product={editingProduct}
                onSave={handleSave}
                onClose={() => { setShowModal(false); setEditingProduct(null); }}
            />

            {/* Import Modal */}
            <ImportExcelModal
                open={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
            />

            {/* Bulk Update Modal */}
            <BulkUpdateModal
                open={showBulkUpdateModal}
                onClose={() => setShowBulkUpdateModal(false)}
                selectedCount={selectedIds.size}
                onUpdate={handleBulkUpdate}
            />

            {/* Label Modal */}
            <LabelModal
                open={showLabelModal}
                onClose={() => setShowLabelModal(false)}
                products={selectedProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    price: p.price,
                }))}
            />
        </div>
    );
}

interface ProductModalProps {
    open: boolean;
    product: Product | null;
    onSave: (data: Omit<Product, 'id' | 'organization_id' | 'created_at'>) => Promise<void>;
    onClose: () => void;
}

function ProductModal({ open, product, onSave, onClose }: ProductModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        price: '0',
        stock: '0',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                sku: product.sku || '',
                price: product.price?.toString() || '0',
                stock: product.stock?.toString() || '0',
            });
        } else {
            setFormData({ name: '', sku: '', price: '0', stock: '0' });
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
            name: formData.name,
            sku: formData.sku || null,
            price: parseFloat(formData.price) || 0,
            stock: parseInt(formData.stock) || 0,
        });
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nombre</label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">SKU</label>
                        <Input
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Precio</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Stock</label>
                            <Input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving} className="flex-1">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

