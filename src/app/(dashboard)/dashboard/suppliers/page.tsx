'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Loader2, DollarSign, Eye, Pencil, Trash2, Star, AlertCircle, ShoppingCart, Package } from 'lucide-react';
import { SupplierCard, PaymentRegistrationModal, SupplierHistoryModal } from '@/components/suppliers';
import { CreatePurchaseOrderModal } from '@/components/purchases';

interface Supplier {
    id: string;
    name: string;
    // Datos Maestros
    legal_name?: string | null;
    trade_name?: string | null;
    tax_id?: string | null;
    tax_id_type?: string | null;
    category?: string | null;
    // Contacto
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    administrative_address?: string | null;
    warehouse_address?: string | null;
    notes: string | null;
    // Condiciones Financieras
    credit_limit?: number;
    payment_terms?: number;
    early_payment_discount?: number;
    current_balance?: number;
    rating?: number;
    last_payment_date?: string;
    // Condiciones Comerciales
    default_payment_condition?: string | null;
    payment_days?: number | null;
    requires_advance?: boolean;
    advance_percentage?: number | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_cbu_alias?: string | null;
    lead_time_days?: number | null;
    // Metadata
    created_at: string;
}

export default function SuppliersPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canCreate, canEdit, canDelete } = usePermissions();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'with_debt' | 'no_debt' | 'over_limit'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'balance' | 'last_payment'>('name');
    const [formData, setFormData] = useState({
        // Básico
        name: '',
        // Datos Maestros
        legal_name: '',
        trade_name: '',
        tax_id: '',
        tax_id_type: 'CUIT',
        category: '',
        // Contacto
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        administrative_address: '',
        warehouse_address: '',
        notes: '',
        // Condiciones Financieras
        credit_limit: '0',
        payment_terms: '30',
        early_payment_discount: '0',
        rating: '3',
        // Condiciones Comerciales
        default_payment_condition: 'Contado',
        payment_days: '0',
        requires_advance: false,
        advance_percentage: '0',
        bank_name: '',
        bank_account_number: '',
        bank_cbu_alias: '',
        lead_time_days: '0',
    });
    const [activeTab, setActiveTab] = useState<'general' | 'fiscal' | 'commercial' | 'contact'>('general');
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
                legal_name: supplier.legal_name || '',
                trade_name: supplier.trade_name || '',
                tax_id: supplier.tax_id || '',
                tax_id_type: supplier.tax_id_type || 'CUIT',
                category: supplier.category || '',
                contact_name: supplier.contact_name || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                administrative_address: supplier.administrative_address || '',
                warehouse_address: supplier.warehouse_address || '',
                notes: supplier.notes || '',
                credit_limit: supplier.credit_limit?.toString() || '0',
                payment_terms: supplier.payment_terms?.toString() || '30',
                early_payment_discount: supplier.early_payment_discount?.toString() || '0',
                rating: supplier.rating?.toString() || '3',
                default_payment_condition: supplier.default_payment_condition || 'Contado',
                payment_days: supplier.payment_days?.toString() || '0',
                requires_advance: supplier.requires_advance || false,
                advance_percentage: supplier.advance_percentage?.toString() || '0',
                bank_name: supplier.bank_name || '',
                bank_account_number: supplier.bank_account_number || '',
                bank_cbu_alias: supplier.bank_cbu_alias || '',
                lead_time_days: supplier.lead_time_days?.toString() || '0',
            });
        } else {
            setEditingSupplier(null);
            setFormData({
                name: '',
                legal_name: '',
                trade_name: '',
                tax_id: '',
                tax_id_type: 'CUIT',
                category: '',
                contact_name: '',
                email: '',
                phone: '',
                address: '',
                administrative_address: '',
                warehouse_address: '',
                notes: '',
                credit_limit: '0',
                payment_terms: '30',
                early_payment_discount: '0',
                rating: '3',
                default_payment_condition: 'Contado',
                payment_days: '0',
                requires_advance: false,
                advance_percentage: '0',
                bank_name: '',
                bank_account_number: '',
                bank_cbu_alias: '',
                lead_time_days: '0',
            });
        }
        setActiveTab('general');
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId) return;

        setSaving(true);

        const supplierData = {
            organization_id: organizationId,
            name: formData.name,
            legal_name: formData.legal_name || null,
            trade_name: formData.trade_name || null,
            tax_id: formData.tax_id || null,
            tax_id_type: formData.tax_id_type || null,
            category: formData.category || null,
            contact_name: formData.contact_name || null,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            administrative_address: formData.administrative_address || null,
            warehouse_address: formData.warehouse_address || null,
            notes: formData.notes || null,
            credit_limit: parseFloat(formData.credit_limit) || 0,
            payment_terms: parseInt(formData.payment_terms) || 30,
            early_payment_discount: parseFloat(formData.early_payment_discount) || 0,
            rating: parseInt(formData.rating) || 3,
            default_payment_condition: formData.default_payment_condition || null,
            payment_days: parseInt(formData.payment_days) || null,
            requires_advance: formData.requires_advance,
            advance_percentage: parseFloat(formData.advance_percentage) || null,
            bank_name: formData.bank_name || null,
            bank_account_number: formData.bank_account_number || null,
            bank_cbu_alias: formData.bank_cbu_alias || null,
            lead_time_days: parseInt(formData.lead_time_days) || 0,
        };

        const { saveSupplier } = await import('@/actions/suppliers');
        const result = await saveSupplier({
            supplierId: editingSupplier?.id,
            data: supplierData,
        });

        if (result.error) {
            alert(result.error);
            setSaving(false);
            return;
        }

        setSaving(false);
        setShowModal(false);
        fetchSuppliers();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
        const { deleteSupplier } = await import('@/actions/suppliers');
        const result = await deleteSupplier(id);
        if (result.error) {
            alert(result.error);
            return;
        }
        fetchSuppliers();
    };

    const handleOpenPayment = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setShowPaymentModal(true);
    };

    const handleOpenHistory = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setShowHistoryModal(true);
    };

    const handleOpenCreateOrder = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setShowCreateOrderModal(true);
    };

    const handleCreateOrderSuccess = () => {
        setShowCreateOrderModal(false);
        setSelectedSupplier(null);
        fetchSuppliers();
    };

    const handleRegisterPaymentFromHistory = () => {
        setShowHistoryModal(false);
        setShowPaymentModal(true);
    };

    const filteredSuppliers = suppliers
        .filter((s) => {
            // Search filter
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.email?.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            // Status filter
            const balance = s.current_balance || 0;
            const creditLimit = s.credit_limit || 0;

            switch (filterStatus) {
                case 'with_debt':
                    return balance > 0;
                case 'no_debt':
                    return balance === 0;
                case 'over_limit':
                    return balance > creditLimit && creditLimit > 0;
                default:
                    return true;
            }
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'balance':
                    return (b.current_balance || 0) - (a.current_balance || 0);
                case 'last_payment':
                    if (!a.last_payment_date) return 1;
                    if (!b.last_payment_date) return -1;
                    return new Date(b.last_payment_date).getTime() - new Date(a.last_payment_date).getTime();
                default:
                    return a.name.localeCompare(b.name);
            }
        });

    // Calculate stats
    const totalBalance = suppliers.reduce((sum, s) => sum + (s.current_balance || 0), 0);
    const suppliersWithDebt = suppliers.filter((s) => (s.current_balance || 0) > 0).length;
    const suppliersOverLimit = suppliers.filter((s) => {
        const balance = s.current_balance || 0;
        const limit = s.credit_limit || 0;
        return limit > 0 && balance > limit;
    }).length;

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
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Proveedores
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {suppliers.length} proveedores registrados
                    </p>
                </div>
                {canCreate('suppliers') && (
                    <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">
                        <Plus /> Nuevo Proveedor
                    </Button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Deuda Total</p>
                                <p className="text-2xl font-bold text-destructive">
                                    ${totalBalance.toLocaleString('es-AR')}
                                </p>
                            </div>
                            <DollarSign className="h-8 w-8 text-destructive/30" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Con Deuda</p>
                                <p className="text-2xl font-bold">{suppliersWithDebt}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={suppliersOverLimit > 0 ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Límite Excedido</p>
                                <p className={`text-2xl font-bold ${suppliersOverLimit > 0 ? 'text-amber-600' : ''}`}>
                                    {suppliersOverLimit}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Proveedores</p>
                                <p className="text-2xl font-bold">{suppliers.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar proveedores..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={filterStatus === 'all' ? 'default' : 'outline'}
                        onClick={() => setFilterStatus('all')}
                        size="sm"
                    >
                        Todos ({suppliers.length})
                    </Button>
                    <Button
                        variant={filterStatus === 'with_debt' ? 'default' : 'outline'}
                        onClick={() => setFilterStatus('with_debt')}
                        size="sm"
                    >
                        Con Deuda ({suppliersWithDebt})
                    </Button>
                    <Button
                        variant={filterStatus === 'no_debt' ? 'default' : 'outline'}
                        onClick={() => setFilterStatus('no_debt')}
                        size="sm"
                    >
                        Sin Deuda ({suppliers.length - suppliersWithDebt})
                    </Button>
                    <Button
                        variant={filterStatus === 'over_limit' ? 'default' : 'outline'}
                        onClick={() => setFilterStatus('over_limit')}
                        size="sm"
                        className="text-destructive"
                    >
                        Límite Excedido ({suppliersOverLimit})
                    </Button>
                </div>
            </div>

            {/* Suppliers Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Proveedor</TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Crédito Disponible</TableHead>
                                <TableHead className="text-center">Rating</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores. ¡Registra el primero!'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((supplier) => {
                                    const balance = supplier.current_balance || 0;
                                    const creditLimit = supplier.credit_limit || 0;
                                    const availableCredit = creditLimit - balance;
                                    const creditUsagePercent = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;
                                    const isOverdue = balance > creditLimit;
                                    const isNearLimit = creditUsagePercent > 80;

                                    return (
                                        <TableRow
                                            key={supplier.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleOpenPayment(supplier)}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{supplier.name}</span>
                                                        {supplier.category && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {supplier.category}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {supplier.legal_name && supplier.legal_name !== supplier.name && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Razón Social: {supplier.legal_name}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        {supplier.tax_id && (
                                                            <span className="font-mono">
                                                                {supplier.tax_id_type || 'ID'}: {supplier.tax_id}
                                                            </span>
                                                        )}
                                                        {supplier.lead_time_days && supplier.lead_time_days > 0 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                <Package className="h-3 w-3 inline mr-1" />{supplier.lead_time_days}d entrega
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm">
                                                    {supplier.contact_name && (
                                                        <span className="text-muted-foreground">{supplier.contact_name}</span>
                                                    )}
                                                    {supplier.phone && (
                                                        <span className="text-xs text-muted-foreground">{supplier.phone}</span>
                                                    )}
                                                    {!supplier.contact_name && !supplier.phone && (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-semibold ${balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                        ${Math.abs(balance).toLocaleString('es-AR')}
                                                    </span>
                                                    {isOverdue && (
                                                        <Badge variant="destructive" className="text-xs mt-1">
                                                            Excedido
                                                        </Badge>
                                                    )}
                                                    {isNearLimit && !isOverdue && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <AlertCircle className="h-3 w-3 text-amber-500" />
                                                            <span className="text-xs text-amber-600">Cerca del límite</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {creditLimit > 0 ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="font-medium text-sm">
                                                            ${availableCredit.toLocaleString('es-AR')}
                                                        </span>
                                                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all rounded-full ${isOverdue
                                                                    ? 'bg-destructive'
                                                                    : isNearLimit
                                                                        ? 'bg-amber-500'
                                                                        : 'bg-primary'
                                                                    }`}
                                                                style={{
                                                                    width: `${Math.min(creditUsagePercent, 100)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {creditUsagePercent.toFixed(0)}% usado
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {supplier.rating ? (
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <Star
                                                                key={i}
                                                                className={`h-3.5 w-3.5 ${i < supplier.rating!
                                                                    ? 'fill-amber-400 text-amber-400'
                                                                    : 'text-muted-foreground/30'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canCreate('suppliers') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenCreateOrder(supplier);
                                                            }}
                                                            title="Crear orden de compra"
                                                        >
                                                            <ShoppingCart className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenHistory(supplier);
                                                        }}
                                                        title="Ver historial"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {canEdit('suppliers') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenModal(supplier);
                                                            }}
                                                            title="Editar"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {canDelete('suppliers') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(supplier.id);
                                                            }}
                                                            className="text-destructive hover:text-destructive"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit/Create Modal */}
            <Dialog open={showModal} onOpenChange={() => setShowModal(false)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                                <TabsTrigger value="commercial">Comercial</TabsTrigger>
                                <TabsTrigger value="contact">Contacto</TabsTrigger>
                            </TabsList>

                            {/* Tab 1: Información General */}
                            <TabsContent value="general" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <Label>Nombre Comercial (Nombre Fantasía) *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Ej: Distribuidora ABC"
                                        />
                                        <p className="text-xs text-muted-foreground">Nombre con el que se conoce al proveedor</p>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Razón Social</Label>
                                        <Input
                                            value={formData.legal_name}
                                            onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                                            placeholder="Ej: Juan Pérez S.A."
                                        />
                                        <p className="text-xs text-muted-foreground">Nombre legal para facturación</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nombre Fantasía Alternativo</Label>
                                        <Input
                                            value={formData.trade_name}
                                            onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Categoría/Rubro</Label>
                                        <Input
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="Ej: Tecnología, Limpieza, Servicios"
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab 2: Datos Fiscales */}
                            <TabsContent value="fiscal" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo de Identificación</Label>
                                        <select
                                            value={formData.tax_id_type}
                                            onChange={(e) => setFormData({ ...formData, tax_id_type: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            <option value="CUIT">CUIT</option>
                                            <option value="RUT">RUT</option>
                                            <option value="DNI">DNI</option>
                                            <option value="Pasaporte">Pasaporte</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Número de Identificación Fiscal</Label>
                                        <Input
                                            value={formData.tax_id}
                                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                            placeholder="Ej: 20-12345678-9"
                                        />
                                        <p className="text-xs text-muted-foreground">Debe ser único</p>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Dirección Administrativa/Facturación</Label>
                                        <textarea
                                            value={formData.administrative_address}
                                            onChange={(e) => setFormData({ ...formData, administrative_address: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                            placeholder="Dirección para facturación"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Dirección de Depósito/Retiro</Label>
                                        <textarea
                                            value={formData.warehouse_address}
                                            onChange={(e) => setFormData({ ...formData, warehouse_address: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                            placeholder="Dirección para retiro de mercadería"
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab 3: Condiciones Comerciales */}
                            <TabsContent value="commercial" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Condición de Pago</Label>
                                        <select
                                            value={formData.default_payment_condition}
                                            onChange={(e) => setFormData({ ...formData, default_payment_condition: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            <option value="Contado">Contado</option>
                                            <option value="30 días">30 días</option>
                                            <option value="60 días">60 días</option>
                                            <option value="90 días">90 días</option>
                                            <option value="Personalizado">Personalizado</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Días de Pago</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.payment_days}
                                            onChange={(e) => setFormData({ ...formData, payment_days: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="requires_advance"
                                                checked={formData.requires_advance}
                                                onCheckedChange={(checked) => setFormData({ ...formData, requires_advance: checked as boolean })}
                                            />
                                            <Label htmlFor="requires_advance" className="cursor-pointer">
                                                Requiere Anticipo
                                            </Label>
                                        </div>
                                        {formData.requires_advance && (
                                            <div className="space-y-2 ml-6">
                                                <Label>Porcentaje de Anticipo (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={formData.advance_percentage}
                                                    onChange={(e) => setFormData({ ...formData, advance_percentage: e.target.value })}
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-2 border-t pt-4">
                                        <h4 className="font-semibold mb-3">Datos Bancarios</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Banco</Label>
                                                <Input
                                                    value={formData.bank_name}
                                                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                    placeholder="Nombre del banco"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Número de Cuenta</Label>
                                                <Input
                                                    value={formData.bank_account_number}
                                                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                                                    placeholder="Número de cuenta"
                                                />
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <Label>CBU / Alias</Label>
                                                <Input
                                                    value={formData.bank_cbu_alias}
                                                    onChange={(e) => setFormData({ ...formData, bank_cbu_alias: e.target.value })}
                                                    placeholder="CBU o Alias para transferencias"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Tiempo de Entrega (días)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.lead_time_days}
                                            onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                                            placeholder="0"
                                        />
                                        <p className="text-xs text-muted-foreground">Días promedio de entrega (lead time)</p>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab 4: Contacto y Finanzas */}
                            <TabsContent value="contact" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Persona de Contacto</Label>
                                        <Input
                                            value={formData.contact_name}
                                            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                            placeholder="Nombre del contacto"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@ejemplo.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+54 11 1234-5678"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Dirección (General)</Label>
                                        <Input
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="Dirección general"
                                        />
                                    </div>
                                    <div className="col-span-2 border-t pt-4">
                                        <h4 className="font-semibold mb-3">Condiciones Financieras</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Límite de Crédito ($)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.credit_limit}
                                                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Días de Crédito</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={formData.payment_terms}
                                                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Descuento Pronto Pago (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={formData.early_payment_discount}
                                                    onChange={(e) => setFormData({ ...formData, early_payment_discount: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Calificación (1-5)</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="5"
                                                    value={formData.rating}
                                                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Notas</Label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                            placeholder="Notas adicionales sobre el proveedor"
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="flex gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={saving} className="flex-1">
                                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Modal */}
            {selectedSupplier && (
                <SupplierHistoryModal
                    open={showHistoryModal}
                    onOpenChange={setShowHistoryModal}
                    supplier={selectedSupplier}
                    onRegisterPayment={handleRegisterPaymentFromHistory}
                />
            )}

            {/* Payment Modal */}
            {selectedSupplier && (
                <PaymentRegistrationModal
                    open={showPaymentModal}
                    onOpenChange={(open) => {
                        setShowPaymentModal(open);
                        if (!open) {
                            // Refresh data when payment modal closes
                            fetchSuppliers();
                        }
                    }}
                    supplierId={selectedSupplier.id}
                    supplierName={selectedSupplier.name}
                    organizationId={organizationId!}
                    currentBalance={selectedSupplier.current_balance || 0}
                    onSuccess={() => {
                        fetchSuppliers();
                        setShowHistoryModal(true);
                    }}
                />
            )}

            {/* Create Purchase Order Modal */}
            <CreatePurchaseOrderModal
                open={showCreateOrderModal}
                onOpenChange={setShowCreateOrderModal}
                supplier={selectedSupplier}
                onSuccess={handleCreateOrderSuccess}
            />
        </div>
    );
}
