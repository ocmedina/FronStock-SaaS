import { useState, useMemo } from "react";
import { Search, Package, Plus, Barcode, Hash } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Product } from "./types";

interface POSProductModalProps {
    open: boolean;
    onClose: () => void;
    products: Product[];
    onSelect: (product: Product) => void;
}

export function POSProductModal({
    open,
    onClose,
    products,
    onSelect,
}: POSProductModalProps) {
    const [search, setSearch] = useState("");

    const filteredProducts = useMemo(() => {
        if (!search) return products;
        const query = search.toLowerCase();
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(query) ||
                p.sku?.toLowerCase().includes(query) ||
                p.barcode?.includes(search) ||
                p.plu?.includes(search)
        );
    }, [products, search]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader className="p-6 pb-2 border-b border-slate-800">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Package className="h-6 w-6 text-emerald-500" />
                        Catálogo de Productos
                    </DialogTitle>
                    <div className="pt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre, código..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-slate-900 border-slate-700 text-slate-100"
                            autoFocus
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-900 text-slate-400 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Producto</th>
                                <th className="px-6 py-3">Códigos</th>
                                <th className="px-6 py-3 text-right">Precio</th>
                                <th className="px-6 py-3 text-right">Stock</th>
                                <th className="px-6 py-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredProducts.map((product) => (
                                <tr
                                    key={product.id}
                                    className="hover:bg-slate-900/50 transition-colors group"
                                >
                                    <td className="px-6 py-4 font-medium text-slate-200">
                                        {product.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-xs text-slate-500">
                                            {product.barcode && (
                                                <span className="flex items-center gap-1">
                                                    <Barcode className="h-3 w-3" /> {product.barcode}
                                                </span>
                                            )}
                                            {product.sku && (
                                                <span className="flex items-center gap-1">
                                                    <Hash className="h-3 w-3" /> {product.sku}
                                                </span>
                                            )}
                                            {product.plu && (
                                                <span className="flex items-center gap-1 text-blue-400">
                                                    PLU {product.plu}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                                        ${product.price.toLocaleString("es-AR")}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Badge
                                            variant="outline"
                                            className={
                                                product.stock > 0
                                                    ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/10"
                                                    : "border-red-500/20 text-red-500 bg-red-500/10"
                                            }
                                        >
                                            {product.stock}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                onSelect(product);
                                                onClose();
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Agregar
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="h-8 w-8 opacity-50" />
                                            <p>No se encontraron productos</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
