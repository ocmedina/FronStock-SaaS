'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    Trash2,
    X,
    Check,
    Loader2,
    Keyboard,
    Package,
    User,
    CreditCard,
    Banknote,
    Building,
    CheckCircle2,
    AlertCircle,
    Receipt,
} from 'lucide-react';

interface Product {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stock: number;
    category_id?: string;
    categories?: { name: string };
}

interface Customer {
    id: string;
    name: string;
}

interface CartItem {
    product: Product;
    quantity: number;
    discount: number;
}

interface SaleTab {
    id: string;
    name: string;
    cart: CartItem[];
    customerId: string | null;
    paymentMethod: PaymentMethod;
}

type PaymentMethod = 'cash' | 'card' | 'transfer';

const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: Banknote },
    { value: 'card', label: 'Tarjeta', icon: CreditCard },
    { value: 'transfer', label: 'Transferencia', icon: Building },
];

export default function POSPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Multiple sales tabs
    const [tabs, setTabs] = useState<SaleTab[]>([
        { id: '1', name: 'Venta 1', cart: [], customerId: null, paymentMethod: 'cash' }
    ]);
    const [activeTabId, setActiveTabId] = useState('1');

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const modalSearchRef = useRef<HTMLInputElement>(null);

    // Last sale info
    const [lastSaleTotal, setLastSaleTotal] = useState(0);

    const supabase = createClient();

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    const cart = activeTab?.cart || [];

    const fetchData = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        const [productsRes, customersRes] = await Promise.all([
            supabase
                .from('products')
                .select('id, name, sku, price, stock, category_id, categories(name)')
                .eq('organization_id', organizationId)
                .gt('stock', 0)
                .order('name'),
            supabase
                .from('customers')
                .select('id, name')
                .eq('organization_id', organizationId)
                .order('name'),
        ]);

        if (productsRes.data) setProducts(productsRes.data as Product[]);
        if (customersRes.data) setCustomers(customersRes.data);
        setIsLoading(false);
    }, [organizationId, supabase]);

    useEffect(() => {
        if (organizationId) fetchData();
    }, [organizationId, fetchData]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F1: Show shortcuts help
            if (e.key === 'F1') {
                e.preventDefault();
                setShowShortcutsModal(true);
            }
            // F2: Focus search
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // F3: Open product modal
            if (e.key === 'F3') {
                e.preventDefault();
                setShowProductModal(true);
            }
            // F4: New sale tab
            if (e.key === 'F4') {
                e.preventDefault();
                addNewTab();
            }
            // F8: Confirm sale
            if (e.key === 'F8' && cart.length > 0) {
                e.preventDefault();
                setShowConfirmModal(true);
            }
            // Escape: Close modals
            if (e.key === 'Escape') {
                setShowProductModal(false);
                setShowConfirmModal(false);
                setShowShortcutsModal(false);
            }
            // Ctrl+1-9: Switch tabs
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                if (tabs[tabIndex]) {
                    setActiveTabId(tabs[tabIndex].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, tabs]);

    // Focus modal search when opened
    useEffect(() => {
        if (showProductModal) {
            setTimeout(() => modalSearchRef.current?.focus(), 100);
        }
    }, [showProductModal]);

    const updateActiveTab = (updates: Partial<SaleTab>) => {
        setTabs(tabs.map(t =>
            t.id === activeTabId ? { ...t, ...updates } : t
        ));
    };

    const addNewTab = () => {
        const newId = String(Date.now());
        const newTab: SaleTab = {
            id: newId,
            name: `Venta ${tabs.length + 1}`,
            cart: [],
            customerId: null,
            paymentMethod: 'cash',
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
    };

    const closeTab = (tabId: string) => {
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTabId === tabId) {
            setActiveTabId(newTabs[0].id);
        }
    };

    const addToCart = (product: Product) => {
        const existing = cart.find((item) => item.product.id === product.id);
        let newCart: CartItem[];

        if (existing) {
            if (existing.quantity < product.stock) {
                newCart = cart.map((item) =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                return;
            }
        } else {
            newCart = [...cart, { product, quantity: 1, discount: 0 }];
        }

        updateActiveTab({ cart: newCart });
        setShowProductModal(false);
        setProductSearchQuery('');
    };

    const updateQuantity = (productId: string, quantity: number) => {
        let newCart: CartItem[];
        if (quantity <= 0) {
            newCart = cart.filter((item) => item.product.id !== productId);
        } else {
            newCart = cart.map((item) =>
                item.product.id === productId ? { ...item, quantity } : item
            );
        }
        updateActiveTab({ cart: newCart });
    };

    const removeFromCart = (productId: string) => {
        updateActiveTab({ cart: cart.filter((item) => item.product.id !== productId) });
    };

    const clearCart = () => {
        updateActiveTab({ cart: [], customerId: null });
    };

    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = subtotal;

    const processSale = async () => {
        if (cart.length === 0 || !organizationId) return;

        setIsProcessing(true);
        setShowConfirmModal(false);

        try {
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert({
                    organization_id: organizationId,
                    customer_id: activeTab.customerId,
                    subtotal,
                    total,
                    payment_method: activeTab.paymentMethod,
                    payment_status: 'paid',
                    status: 'completed',
                })
                .select()
                .single();

            if (saleError) throw saleError;

            const saleItems = cart.map((item) => ({
                sale_id: sale.id,
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price,
                discount: item.discount,
                total: item.product.price * item.quantity - item.discount,
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            for (const item of cart) {
                await supabase
                    .from('products')
                    .update({ stock: item.product.stock - item.quantity })
                    .eq('id', item.product.id);
            }

            setLastSaleTotal(total);
            clearCart();
            setShowSuccessModal(true);
            fetchData();

        } catch (error) {
            console.error('Error processing sale:', error);
            alert('Error al procesar la venta');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modalFilteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearchQuery.toLowerCase())
    );

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Tabs Bar */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {tabs.map((tab, index) => (
                    <div
                        key={tab.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${tab.id === activeTabId
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card hover:bg-accent'
                            }`}
                        onClick={() => setActiveTabId(tab.id)}
                    >
                        <ShoppingCart className="h-4 w-4" />
                        <span className="font-medium whitespace-nowrap">
                            {tab.name}
                            {tab.cart.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {tab.cart.length}
                                </Badge>
                            )}
                        </span>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className="ml-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                        <span className="text-xs opacity-50">Ctrl+{index + 1}</span>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={addNewTab}>
                    <Plus className="h-4 w-4" />
                    Nueva (F4)
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => setShowShortcutsModal(true)}>
                    <Keyboard className="h-4 w-4 mr-2" />
                    Atajos (F1)
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex gap-6 flex-1 min-h-0">
                {/* Left: Products */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Search Bar */}
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar producto... (F2)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button onClick={() => setShowProductModal(true)}>
                            <Package className="h-4 w-4 mr-2" />
                            Catálogo (F3)
                        </Button>
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredProducts.map((product) => (
                                <Card
                                    key={product.id}
                                    className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                                    onClick={() => addToCart(product)}
                                >
                                    <CardContent className="p-4">
                                        <p className="font-medium truncate">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">{product.sku || 'Sin SKU'}</p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-lg font-bold text-primary">
                                                ${Number(product.price).toLocaleString('es-AR')}
                                            </span>
                                            <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'}>
                                                {product.stock} disp.
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full text-center py-12 text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>No se encontraron productos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Cart */}
                <Card className="w-96 flex flex-col">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Carrito
                            </CardTitle>
                            {cart.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearCart}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Vaciar
                                </Button>
                            )}
                        </div>
                        <Select
                            value={activeTab.customerId || 'general'}
                            onValueChange={(v) => updateActiveTab({ customerId: v === 'general' ? null : v })}
                        >
                            <SelectTrigger>
                                <User className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Cliente general" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">Cliente general</SelectItem>
                                {customers.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto py-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <ShoppingCart className="h-12 w-12 mb-2 opacity-30" />
                                <p>Carrito vacío</p>
                                <p className="text-xs">Haz clic en un producto o F3</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.product.id} className="bg-muted rounded-lg p-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.product.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ${Number(item.product.price).toLocaleString('es-AR')} c/u
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-10 text-center font-medium">{item.quantity}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                    disabled={item.quantity >= item.product.stock}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <span className="font-semibold">
                                                ${(item.product.price * item.quantity).toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>

                    {/* Cart Footer */}
                    <div className="border-t p-4 space-y-4">
                        {/* Payment Methods */}
                        <div className="grid grid-cols-3 gap-2">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon;
                                return (
                                    <Button
                                        key={method.value}
                                        variant={activeTab.paymentMethod === method.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => updateActiveTab({ paymentMethod: method.value as PaymentMethod })}
                                        className="flex-col h-auto py-2"
                                    >
                                        <Icon className="h-4 w-4 mb-1" />
                                        <span className="text-xs">{method.label}</span>
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Summary */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Items:</span>
                                <span>{totalItems}</span>
                            </div>
                            <div className="flex justify-between text-2xl font-bold">
                                <span>Total:</span>
                                <span>${total.toLocaleString('es-AR')}</span>
                            </div>
                        </div>

                        {/* Checkout Button */}
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg"
                            onClick={() => setShowConfirmModal(true)}
                            disabled={cart.length === 0 || isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Check className="h-5 w-5 mr-2" />
                                    Cobrar (F8)
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Product Search Modal */}
            <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Catálogo de Productos</DialogTitle>
                        <DialogDescription>
                            Busca y selecciona productos para agregar al carrito
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={modalSearchRef}
                            placeholder="Buscar por nombre o código..."
                            value={productSearchQuery}
                            onChange={(e) => setProductSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modalFilteredProducts.slice(0, 50).map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{product.sku || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{product.categories?.name || 'Sin categoría'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ${Number(product.price).toLocaleString('es-AR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'}>
                                                {product.stock}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="sm" onClick={() => addToCart(product)}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {modalFilteredProducts.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                No se encontraron productos
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm Sale Modal */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            Confirmar Venta
                        </DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de procesar esta venta?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-muted rounded-lg p-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Productos:</span>
                                <span className="font-medium">{totalItems} items</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Método de pago:</span>
                                <span className="font-medium">
                                    {paymentMethods.find(m => m.value === activeTab.paymentMethod)?.label}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Cliente:</span>
                                <span className="font-medium">
                                    {activeTab.customerId
                                        ? customers.find(c => c.id === activeTab.customerId)?.name
                                        : 'General'}
                                </span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between text-xl font-bold">
                                    <span>Total:</span>
                                    <span className="text-primary">${total.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={processSale} disabled={isProcessing}>
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Confirmar Venta
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Success Modal */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="text-center">
                    <div className="flex flex-col items-center py-6">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <DialogTitle className="text-2xl mb-2">¡Venta Exitosa!</DialogTitle>
                        <DialogDescription className="text-lg">
                            Total cobrado: <span className="font-bold text-primary">${lastSaleTotal.toLocaleString('es-AR')}</span>
                        </DialogDescription>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" className="flex-1">
                            <Receipt className="h-4 w-4 mr-2" />
                            Imprimir Ticket
                        </Button>
                        <Button className="flex-1" onClick={() => setShowSuccessModal(false)}>
                            Nueva Venta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Shortcuts Modal */}
            <Dialog open={showShortcutsModal} onOpenChange={setShowShortcutsModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Keyboard className="h-5 w-5" />
                            Atajos de Teclado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {[
                            { key: 'F1', desc: 'Mostrar esta ayuda' },
                            { key: 'F2', desc: 'Enfocar búsqueda rápida' },
                            { key: 'F3', desc: 'Abrir catálogo de productos' },
                            { key: 'F4', desc: 'Nueva venta (nueva pestaña)' },
                            { key: 'F8', desc: 'Confirmar y cobrar venta' },
                            { key: 'Ctrl + 1-9', desc: 'Cambiar entre pestañas' },
                            { key: 'Escape', desc: 'Cerrar ventanas' },
                        ].map((shortcut) => (
                            <div key={shortcut.key} className="flex items-center justify-between">
                                <span>{shortcut.desc}</span>
                                <kbd className="px-3 py-1 bg-muted rounded-lg font-mono text-sm">
                                    {shortcut.key}
                                </kbd>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
