'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';

interface Supplier {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
}

interface PurchaseOrder {
    id: string;
    order_number: string | null;
    supplier_id: string;
    supplier: { name: string } | null;
    status: string;
    total: number;
    created_at: string;
    received_at: string | null;
}

interface OrderItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    ordered: { label: 'Ordenado', color: 'bg-blue-100 text-blue-700' },
    received: { label: 'Recibido', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function PurchaseOrdersPage() {
    const { organizationId, isLoading: orgLoading } = useOrganization();
    const { canCreate, canEdit } = usePermissions();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [formData, setFormData] = useState({ supplier_id: '', notes: '' });
    const [items, setItems] = useState<OrderItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<string>('all');

    const supabase = createClient();

    const fetchData = useCallback(async () => {
        if (!organizationId) return;
        setIsLoading(true);

        const [ordersRes, suppliersRes, productsRes] = await Promise.all([
            supabase.from('purchase_orders').select('*, supplier:suppliers(name)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
            supabase.from('suppliers').select('id, name').eq('organization_id', organizationId).order('name'),
            supabase.from('products').select('id, name, price').eq('organization_id', organizationId).order('name'),
        ]);

        if (ordersRes.data) setOrders(ordersRes.data);
        if (suppliersRes.data) setSuppliers(suppliersRes.data);
        if (productsRes.data) setProducts(productsRes.data);
        setIsLoading(false);
    }, [organizationId, supabase]);

    useEffect(() => {
        if (organizationId) fetchData();
    }, [organizationId, fetchData]);

    const handleOpenNew = () => {
        setSelectedOrder(null);
        setFormData({ supplier_id: suppliers[0]?.id || '', notes: '' });
        setItems([]);
        setShowModal(true);
    };

    const addItem = () => {
        if (products.length === 0) return;
        setItems([...items, {
            product_id: products[0].id,
            product_name: products[0].name,
            quantity: 1,
            unit_cost: products[0].price,
        }]);
    };

    const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
        const updated = [...items];
        if (field === 'product_id') {
            const product = products.find((p) => p.id === value);
            if (product) {
                updated[index] = { ...updated[index], product_id: product.id, product_name: product.name };
            }
        } else {
            (updated[index] as Record<string, string | number>)[field] = value;
        }
        setItems(updated);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const calculateTotal = () => items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizationId || items.length === 0) return;

        setSaving(true);

        // Create order
        const { data: order, error } = await supabase
            .from('purchase_orders')
            .insert({
                organization_id: organizationId,
                supplier_id: formData.supplier_id,
                order_number: `OC-${Date.now().toString().slice(-6)}`,
                status: 'pending',
                total: calculateTotal(),
            })
            .select()
            .single();

        if (error || !order) {
            console.error('Error creating order:', error);
            setSaving(false);
            return;
        }

        // Create items
        const orderItemsData = items.map((item) => ({
            purchase_order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            total: item.quantity * item.unit_cost,
        }));

        await supabase.from('purchase_order_items').insert(orderItemsData);

        setSaving(false);
        setShowModal(false);
        fetchData();
    };

    const handleViewOrder = async (order: PurchaseOrder) => {
        setSelectedOrder(order);
        const { data } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('purchase_order_id', order.id);
        if (data) setOrderItems(data);
        setShowModal(true);
    };

    const handleReceiveOrder = async (orderId: string) => {
        if (!confirm('¿Marcar como recibido? Se actualizará el stock de los productos.')) return;

        // Get order items
        const { data: items } = await supabase
            .from('purchase_order_items')
            .select('product_id, quantity')
            .eq('purchase_order_id', orderId);

        if (!items) return;

        // Update stock for each product
        for (const item of items) {
            const { data: product } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product) {
                await supabase
                    .from('products')
                    .update({ stock: product.stock + item.quantity })
                    .eq('id', item.product_id);
            }
        }

        // Mark order as received
        await supabase
            .from('purchase_orders')
            .update({ status: 'received', received_at: new Date().toISOString() })
            .eq('id', orderId);

        setShowModal(false);
        setSelectedOrder(null);
        fetchData();
    };

    const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

    if (orgLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h1>
                    <p className="text-slate-500">{orders.length} órdenes</p>
                </div>
                {canCreate('products') && suppliers.length > 0 && (
                    <button
                        onClick={handleOpenNew}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Nueva Orden
                    </button>
                )}
            </div>

            {suppliers.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
                    ⚠️ Primero debes registrar al menos un proveedor antes de crear órdenes de compra.
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2">
                {['all', 'pending', 'ordered', 'received'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {status === 'all' ? 'Todas' : STATUS_LABELS[status]?.label}
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Orden</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Proveedor</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Estado</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Total</th>
                            <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No hay órdenes de compra
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-slate-800">{order.order_number || order.id.slice(0, 8)}</span>
                                        <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{order.supplier?.name || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[order.status]?.color}`}>
                                            {STATUS_LABELS[order.status]?.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-800">${Number(order.total).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleViewOrder(order)} className="text-blue-600 hover:text-blue-800">
                                            Ver detalle
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal: New Order */}
            {showModal && !selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-xl font-semibold text-slate-800">Nueva Orden de Compra</h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                                <select
                                    value={formData.supplier_id}
                                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-slate-700">Productos</label>
                                    <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800">
                                        + Agregar producto
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <select
                                                value={item.product_id}
                                                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            >
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                min="1"
                                                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                placeholder="Cant."
                                            />
                                            <input
                                                type="number"
                                                value={item.unit_cost}
                                                onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                step="0.01"
                                                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                placeholder="Costo"
                                            />
                                            <span className="w-24 text-right text-sm font-medium">${(item.quantity * item.unit_cost).toFixed(2)}</span>
                                            <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">✕</button>
                                        </div>
                                    ))}
                                </div>
                                {items.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                                        <span className="text-lg font-bold">Total: ${calculateTotal().toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving || items.length === 0} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? 'Guardando...' : 'Crear Orden'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Order */}
            {showModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-slate-800">Orden {selectedOrder.order_number}</h2>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[selectedOrder.status]?.color}`}>
                                    {STATUS_LABELS[selectedOrder.status]?.label}
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm">Proveedor: {selectedOrder.supplier?.name}</p>
                        </div>
                        <div className="p-6">
                            <h3 className="font-semibold text-slate-800 mb-3">Productos</h3>
                            <div className="space-y-2">
                                {orderItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between py-2 border-b border-slate-100">
                                        <div>
                                            <span className="font-medium">{item.product_name}</span>
                                            <span className="text-slate-500 text-sm ml-2">x{item.quantity}</span>
                                        </div>
                                        <span className="font-medium">${(item.quantity * item.unit_cost).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
                                <span className="font-semibold">Total:</span>
                                <span className="text-xl font-bold text-green-600">${Number(selectedOrder.total).toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-b-xl flex gap-3">
                            <button onClick={() => { setShowModal(false); setSelectedOrder(null); }} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white">
                                Cerrar
                            </button>
                            {selectedOrder.status === 'pending' && canEdit('products') && (
                                <button onClick={() => handleReceiveOrder(selectedOrder.id)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    ✓ Marcar Recibido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
