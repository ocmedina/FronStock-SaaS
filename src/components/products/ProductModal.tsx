"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Package,
    Hash,
    Barcode,
    DollarSign,
    AlertTriangle,
    BoxIcon,
    TrendingUp,
    Wand2,
    Layers,
    Search,
    X,
    Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/types/database.types";

interface ProductModalProps {
    open: boolean;
    product: Product | null;
    allProducts: Product[];
    onSave: (
        data: Omit<Product, "id" | "organization_id" | "created_at">,
        comboItems?: { child_product_id: string; quantity: number }[]
    ) => Promise<void>;
    onClose: () => void;
    canViewCost: boolean;
}

export function ProductModal({ open, product, allProducts, onSave, onClose, canViewCost }: ProductModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        barcode: "",
        price: "0",
        cost_price: "",
        wholesale_price: "",
        stock: "0",
        min_stock: "",
        description: "",
        plu: "",
        is_combo: false,
    });
    const [comboItems, setComboItems] = useState<{ child_product_id: string; quantity: number }[]>([]);
    const [comboSearch, setComboSearch] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || "",
                sku: product.sku || "",
                barcode: product.barcode || "",
                price: product.price?.toString() || "0",
                cost_price: product.cost_price?.toString() || "",
                wholesale_price: product.wholesale_price?.toString() || "",
                stock: product.stock?.toString() || "0",
                min_stock: product.min_stock?.toString() || "",
                description: product.description || "",
                plu: product.plu || "",
                is_combo: product.is_combo || false,
            });

            if (product.is_combo) {
                const supabase = createClient();
                supabase
                    .from("product_combos")
                    .select("child_product_id, quantity")
                    .eq("parent_product_id", product.id)
                    .then(({ data }) => {
                        if (data) {
                            setComboItems(data);
                        }
                    });
            } else {
                setComboItems([]);
            }
        } else {
            setFormData({
                name: "",
                sku: "",
                barcode: "",
                price: "0",
                cost_price: "",
                wholesale_price: "",
                stock: "0",
                min_stock: "",
                description: "",
                plu: "",
                is_combo: false,
            });
            setComboItems([]);
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
            name: formData.name,
            sku: formData.sku || null,
            barcode: formData.barcode || null,
            price: parseFloat(formData.price) || 0,
            cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
            wholesale_price: formData.wholesale_price
                ? parseFloat(formData.wholesale_price)
                : null,
            stock: parseInt(formData.stock) || 0,
            min_stock: formData.min_stock ? parseInt(formData.min_stock) : null,
            description: formData.description || null,
            plu: formData.plu || null,
            is_combo: formData.is_combo,
        }, comboItems);
        setSaving(false);
    };

    // Calcular margen de ganancia
    const profitMargin =
        canViewCost && formData.cost_price && formData.price
            ? (
                ((parseFloat(formData.price) - parseFloat(formData.cost_price)) /
                    parseFloat(formData.cost_price)) *
                100
            ).toFixed(1)
            : null;

    // Funciones de generación
    const generateRandomBarcode = () => {
        const prefix = "779"; // Argentina
        const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
        const code = prefix + random;

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;

        setFormData(prev => ({ ...prev, barcode: code + checkDigit }));
    };

    const generateRandomSKU = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let sku = "";
        for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 26));
        sku += "-";
        for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 36));
        sku += "-";
        for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 10) + 26);

        setFormData(prev => ({ ...prev, sku: sku }));
    };

    const addComboItem = (prod: Product) => {
        setComboItems((prev) => {
            const existing = prev.find((p) => p.child_product_id === prod.id);
            if (existing) {
                return prev.map((p) =>
                    p.child_product_id === prod.id
                        ? { ...p, quantity: p.quantity + 1 }
                        : p,
                );
            }
            return [...prev, { child_product_id: prod.id, quantity: 1 }];
        });
        setComboSearch("");
    };

    const removeComboItem = (id: string) => {
        setComboItems((prev) => prev.filter((p) => p.child_product_id !== id));
    };

    const updateComboQuantity = (id: string, qty: number) => {
        if (qty < 1) return;
        setComboItems((prev) =>
            prev.map((p) => (p.child_product_id === id ? { ...p, quantity: qty } : p)),
        );
    };

    // Calcular costo total del combo basado en componentes
    const comboCost = comboItems.reduce((acc, item) => {
        const prod = allProducts?.find((p) => p.id === item.child_product_id);
        return acc + (prod?.cost_price || 0) * item.quantity;
    }, 0);

    // Actualizar costo en formData si es combo
    useEffect(() => {
        if (formData.is_combo) {
            setFormData(prev => ({ ...prev, cost_price: comboCost.toString() }));
        }
    }, [comboCost, formData.is_combo]);

    const filteredComboProducts = allProducts?.filter(
        (p) =>
            !p.is_combo &&
            p.id !== product?.id &&
            (p.name.toLowerCase().includes(comboSearch.toLowerCase()) ||
                p.sku?.toLowerCase().includes(comboSearch.toLowerCase()))
    ).slice(0, 5) || [];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        {product ? "Editar Producto" : "Nuevo Producto"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Tipo de Producto */}
                    <div className="flex items-center space-x-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Checkbox
                            id="is_combo"
                            checked={formData.is_combo}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_combo: !!checked }))}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="is_combo"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                Es Combo / Promoción
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Selecciona esta opción si el producto está compuesto por otros productos.
                            </p>
                        </div>
                    </div>

                    {/* Información básica */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Información Básica
                        </h3>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Nombre del Producto *
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder="Ej: Camiseta Nike Dry-Fit"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descripción</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Descripción del producto..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Códigos */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Códigos de Identificación
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-muted-foreground" />
                                        SKU
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        onClick={generateRandomSKU}
                                        title="Generar SKU aleatorio"
                                    >
                                        <Wand2 className="h-3 w-3" />
                                    </Button>
                                </label>
                                <Input
                                    value={formData.sku}
                                    onChange={(e) =>
                                        setFormData({ ...formData, sku: e.target.value })
                                    }
                                    placeholder="Ej: CAM-NIK-001"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Barcode className="h-4 w-4 text-muted-foreground" />
                                        Código de Barras
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        onClick={generateRandomBarcode}
                                        title="Generar EAN-13 aleatorio"
                                    >
                                        <Wand2 className="h-3 w-3" />
                                    </Button>
                                </label>
                                <Input
                                    value={formData.barcode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, barcode: e.target.value })
                                    }
                                    placeholder="Ej: 7790001234567"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-emerald-500" />
                                    PLU (Frutas/Verduras)
                                </label>
                                <Input
                                    value={formData.plu}
                                    onChange={(e) =>
                                        setFormData({ ...formData, plu: e.target.value })
                                    }
                                    placeholder="Ej: 4011"
                                    maxLength={5}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Componentes del Combo */}
                    {formData.is_combo && (
                        <div className="space-y-4 rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Componentes del Combo
                            </h3>

                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={comboSearch}
                                    onChange={e => setComboSearch(e.target.value)}
                                    placeholder="Buscar productos para agregar..."
                                    className="pl-9 bg-background"
                                />
                                {comboSearch && (
                                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        {filteredComboProducts.length === 0 ? (
                                            <div className="p-3 text-sm text-muted-foreground text-center">No se encontraron productos</div>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredComboProducts.map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => addComboItem(p)}
                                                        className="p-2.5 hover:bg-accent cursor-pointer flex justify-between items-center transition-colors border-b last:border-0"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-medium">{p.name}</p>
                                                            <p className="text-xs text-muted-foreground">SKU: {p.sku || '-'}</p>
                                                        </div>
                                                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                            ${p.cost_price || 0}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-md divide-y bg-background">
                                {comboItems.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                        <Layers className="h-8 w-8 opacity-20" />
                                        <p>Agrega productos para armar el combo</p>
                                    </div>
                                ) : (
                                    comboItems.map(item => {
                                        const comboProduct = allProducts?.find(p => p.id === item.child_product_id);
                                        return (
                                            <div key={item.child_product_id} className="p-2 flex items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{comboProduct?.name || "Producto desconocido"}</p>
                                                    <p className="text-xs text-muted-foreground">Costo unit: ${comboProduct?.cost_price || 0}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center border rounded-md overflow-hidden bg-background">
                                                        <span className="px-2 text-xs text-muted-foreground bg-muted border-r h-full flex items-center">Cant.</span>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateComboQuantity(item.child_product_id, parseInt(e.target.value) || 1)}
                                                            className="w-12 h-8 text-center text-sm focus:outline-none bg-transparent"
                                                            min="1"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => removeComboItem(item.child_product_id)}
                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="flex justify-between items-center text-sm pt-2">
                                <span className="text-muted-foreground">Total items: {comboItems.reduce((a, b) => a + b.quantity, 0)}</span>
                                <span className="font-medium text-muted-foreground">
                                    Costo Sugerido: <span className="text-foreground font-bold">${comboCost.toFixed(2)}</span>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Precios */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Precios
                        </h3>
                        <div className={`grid ${canViewCost ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                            {canViewCost && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-red-500" />
                                        Costo
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.cost_price}
                                        onChange={(e) =>
                                            setFormData({ ...formData, cost_price: e.target.value })
                                        }
                                        placeholder="0.00"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    Minorista *
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData({ ...formData, price: e.target.value })
                                    }
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-blue-500" />
                                    Mayorista
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.wholesale_price}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            wholesale_price: e.target.value,
                                        })
                                    }
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        {canViewCost && profitMargin && parseFloat(profitMargin) > 0 && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Margen de ganancia:{" "}
                                    <span className="font-bold">{profitMargin}%</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Inventario */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Inventario
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <BoxIcon className="h-4 w-4 text-muted-foreground" />
                                    Stock Actual
                                </label>
                                <Input
                                    type="number"
                                    value={formData.stock}
                                    onChange={(e) =>
                                        setFormData({ ...formData, stock: e.target.value })
                                    }
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    Stock Mínimo
                                </label>
                                <Input
                                    type="number"
                                    value={formData.min_stock}
                                    onChange={(e) =>
                                        setFormData({ ...formData, min_stock: e.target.value })
                                    }
                                    placeholder="Alertar cuando sea menor a..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="flex-1 shadow-lg shadow-primary/20"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {saving ? "Guardando..." : "Guardar Producto"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
