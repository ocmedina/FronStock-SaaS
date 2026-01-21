'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, Pencil, Trash2, Loader2, UserPlus } from 'lucide-react';

interface Customer {
    id: string;
    organization_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    created_at: string;
}

export default function CustomersPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const supabase = createClient();

    const fetchCustomers = async () => {
        if (!organizationId) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name');

        if (!error && data) {
            setCustomers(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (organizationId) {
            fetchCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId) return;

        setSaving(true);

        const customerData = {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
        };

        if (editingCustomer) {
            await supabase.from('customers').update(customerData).eq('id', editingCustomer.id);
        } else {
            await supabase.from('customers').insert({ ...customerData, organization_id: organizationId });
        }

        setSaving(false);
        setShowModal(false);
        setEditingCustomer(null);
        setFormData({ name: '', email: '', phone: '', address: '' });
        fetchCustomers();
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este cliente?')) {
            await supabase.from('customers').delete().eq('id', id);
            fetchCustomers();
        }
    };

    const openEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
        });
        setShowModal(true);
    };

    const filteredCustomers = customers.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery)
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
                    <h1 className="text-2xl font-bold">Clientes</h1>
                    <p className="text-muted-foreground">{customers.length} clientes registrados</p>
                </div>
                <Button onClick={() => {
                    setEditingCustomer(null);
                    setFormData({ name: '', email: '', phone: '', address: '' });
                    setShowModal(true);
                }}>
                    <UserPlus /> Nuevo Cliente
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar clientes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Customers Table */}
            <div className="rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                    {searchQuery ? 'No se encontraron clientes' : 'No hay clientes. ¡Registra el primero!'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{customer.email || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{customer.phone || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => openEditModal(customer)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => handleDelete(customer.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={() => { setShowModal(false); setEditingCustomer(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dirección</label>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditingCustomer(null); }} className="flex-1">
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
