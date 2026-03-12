"use client";

import { useState } from "react";
import { Activity, Package, ArrowDownLeft, ArrowUpRight, Loader2, ClipboardList, AlertTriangle, XCircle, Undo2, Pencil, FileText } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "./types";

interface StockMovementModalProps {
    open: boolean;
    onClose: () => void;
    products: Product[];
    onSave: (data: any) => Promise<void>;
}

export function StockMovementModal({
    open,
    onClose,
    products,
    onSave,
}: StockMovementModalProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        product_id: "",
        movement_type: "entry",
        quantity: 1,
        reason: "adjustment",
        notes: "",
    });

    // Reset when modal opens
    // Note: In strict component logic we might want useEffect to reset, 
    // but typically parent controls initial state or keys.
    // For simplicity, we assume parent sets initial or we just init empty.

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(formData);
            // Don't close here, parent handles it after success
            setFormData({ ...formData, quantity: 1, notes: "" }); // Reset some fields
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Activity className="h-5 w-5 text-primary" />
                        </div>
                        Nuevo Movimiento de Stock
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Producto
                        </label>
                        <Select
                            value={formData.product_id}
                            onValueChange={(v) =>
                                setFormData({ ...formData, product_id: v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar producto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center justify-between gap-4">
                                            <span>{p.name}</span>
                                            <Badge variant="outline" className="ml-2">
                                                Stock: {p.stock}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Tipo de Movimiento
                            </label>
                            <Select
                                value={formData.movement_type}
                                onValueChange={(v) =>
                                    setFormData({ ...formData, movement_type: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="entry">
                                        <div className="flex items-center gap-2">
                                            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                                            Entrada
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="exit">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight className="h-4 w-4 text-red-600" />
                                            Salida
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cantidad</label>
                            <Input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        quantity: parseInt(e.target.value) || 1,
                                    })
                                }
                                min="1"
                                className="font-semibold"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Motivo</label>
                        <Select
                            value={formData.reason}
                            onValueChange={(v) => setFormData({ ...formData, reason: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="adjustment">
                                    <ClipboardList className="h-4 w-4 inline mr-1" />Ajuste de inventario
                                </SelectItem>
                                <SelectItem value="damaged"><AlertTriangle className="h-4 w-4 inline mr-1" />Producto dañado</SelectItem>
                                <SelectItem value="lost"><XCircle className="h-4 w-4 inline mr-1" />Pérdida</SelectItem>
                                <SelectItem value="returned"><Undo2 className="h-4 w-4 inline mr-1" />Devolución</SelectItem>
                                <SelectItem value="correction"><Pencil className="h-4 w-4 inline mr-1" />Corrección</SelectItem>
                                <SelectItem value="initial"><Package className="h-4 w-4 inline mr-1" />Stock inicial</SelectItem>
                                <SelectItem value="other"><FileText className="h-4 w-4 inline mr-1" />Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notas (opcional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            rows={2}
                            placeholder="Descripción adicional del movimiento..."
                            className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                    </div>

                    {/* Preview del movimiento */}
                    {formData.product_id && (
                        <div className="p-3 rounded-lg bg-muted/50 border">
                            <p className="text-xs text-muted-foreground mb-1">
                                Vista previa:
                            </p>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={
                                        formData.movement_type === "entry"
                                            ? "default"
                                            : "destructive"
                                    }
                                >
                                    {formData.movement_type === "entry" ? "+" : "-"}
                                    {formData.quantity}
                                </Badge>
                                <span className="text-sm">
                                    {products.find((p) => p.id === formData.product_id)?.name}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
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
                            {saving ? "Guardando..." : "Registrar Movimiento"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
