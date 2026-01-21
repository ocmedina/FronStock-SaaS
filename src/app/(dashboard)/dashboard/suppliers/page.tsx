'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Loader2, Factory, Mail, Phone, User } from 'lucide-react';

interface Supplier {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    created_at: string;
}

export default function SuppliersPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canCreate, canEdit, canDelete } = usePermissions();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '', contact_name: '', email: '', phone: '', address: '', notes: ''
    });
    const [saving, setSaving] = useState(false);

    const supabase = createClient();

    const fetchSuppliers = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        const { data } = await supabase
            .from('suppliers')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name');

        if (data) setSuppliers(data);
        setIsLoading(false);
    }, [organizationId, supabase]);

    useEffect(() => {
        if (organizationId) fetchSuppliers();
    }, [organizationId, fetchSuppliers]);

    const handleOpenModal = (supplier?: Supplier) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                notes: supplier.notes || '',
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: '', contact_name: '', email: '', phone: '', address: '', notes: '' });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId) return;

        setSaving(true);

        const supplierData = {
            name: formData.name,
            contact_name: formData.contact_name || null,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            notes: formData.notes || null,
        };

        if (editingSupplier) {
            await supabase.from('suppliers').update(supplierData).eq('id', editingSupplier.id);
        } else {
            await supabase.from('suppliers').insert({ ...supplierData, organization_id: organizationId });
        }

        setSaving(false);
        setShowModal(false);
        fetchSuppliers();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
        await supabase.from('suppliers').delete().eq('id', id);
        fetchSuppliers();
    };

    const filteredSuppliers = suppliers.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <h1 className="text-2xl font-bold">Proveedores</h1>
                    <p className="text-muted-foreground">{suppliers.length} proveedores registrados</p>
                </div>
                {canCreate('products') && (
                    <Button onClick={() => handleOpenModal()}>
                        <Plus /> Nuevo Proveedor
                    </Button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar proveedores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores. ¡Registra el primero!'}
                        </CardContent>
                    </Card>
                ) : (
                    filteredSuppliers.map((supplier) => (
                        <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white">
                                        <Factory className="h-6 w-6" />
                                    </div>
                                    <div className="flex gap-1">
                                        {canEdit('products') && (
                                            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenModal(supplier)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canDelete('products') && (
                                            <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(supplier.id)} className="text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <h3 className="font-semibold mb-2">{supplier.name}</h3>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    {supplier.contact_name && (
                                        <p className="flex items-center gap-2"><User className="h-3 w-3" /> {supplier.contact_name}</p>
                                    )}
                                    {supplier.email && (
                                        <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {supplier.email}</p>
                                    )}
                                    {supplier.phone && (
                                        <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {supplier.phone}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={() => setShowModal(false)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre *</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Persona de Contacto</label>
                            <Input
                                value={formData.contact_name}
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Teléfono</label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dirección</label>
                            <Input
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notas</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
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
        </div>
    );
}
