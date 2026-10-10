"use client";

import { Package, Hash, Barcode, AlertTriangle, MoreHorizontal, Pencil, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product } from "@/types/database.types";

interface ProductTableProps {
    products: Product[];
    selectedIds: Set<string>;
    searchQuery: string;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onGenerateLabel: (product: Product) => void;
    canEdit: boolean;
    canDelete: boolean;
    canViewCost: boolean;
}

export function ProductTable({
    products,
    selectedIds,
    searchQuery,
    onToggleSelect,
    onToggleSelectAll,
    onEdit,
    onDelete,
    onGenerateLabel,
    canEdit,
    canDelete,
    canViewCost,
}: ProductTableProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
            <div className="overflow-x-auto">
                <Table className="min-w-[920px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedIds.size === products.length && products.length > 0}
                                    onCheckedChange={onToggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Códigos</TableHead>
                            {canViewCost && <TableHead className="text-right">Costo</TableHead>}
                            <TableHead className="text-right">Minorista</TableHead>
                            <TableHead className="text-right">Mayorista</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={canViewCost ? 8 : 7} className="text-center py-12">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 rounded-full bg-muted">
                                            <Package className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="font-medium">
                                            {searchQuery ? "No se encontraron productos" : "No hay productos"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {searchQuery ? "Intenta con otra búsqueda" : "¡Crea el primero!"}
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((product) => (
                                <TableRow
                                    key={product.id}
                                    className={`transition-colors hover:bg-slate-50 ${selectedIds.has(product.id) ? "bg-primary/5" : ""}`}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(product.id)}
                                            onCheckedChange={() => onToggleSelect(product.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <Package className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate max-w-[260px]">{product.name}</p>
                                                {product.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                                        {product.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {product.sku && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Hash className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-mono">{product.sku}</span>
                                                </div>
                                            )}
                                            {product.barcode && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Barcode className="h-3 w-3" />
                                                    <span className="font-mono">{product.barcode}</span>
                                                </div>
                                            )}
                                            {product.plu && (
                                                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                    <Hash className="h-3 w-3" />
                                                    <span className="font-mono">PLU: {product.plu}</span>
                                                </div>
                                            )}
                                            {!product.sku && !product.barcode && !product.plu && (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    {canViewCost && (
                                        <TableCell className="text-right">
                                            {product.cost_price ? (
                                                <span className="text-muted-foreground">
                                                    ${Number(product.cost_price).toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                            ${Number(product.price).toFixed(2)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {product.wholesale_price ? (
                                            <span className="text-blue-600 dark:text-blue-400">
                                                ${Number(product.wholesale_price).toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            variant={
                                                product.stock <= 0
                                                    ? "destructive"
                                                    : product.min_stock && product.stock <= product.min_stock
                                                        ? "secondary"
                                                        : product.stock <= 10
                                                            ? "secondary"
                                                            : "default"
                                            }
                                            className="gap-1"
                                        >
                                            {product.min_stock && product.stock <= product.min_stock && (
                                                <AlertTriangle className="h-3 w-3" />
                                            )}
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
                                                {canEdit && (
                                                    <DropdownMenuItem onClick={() => onEdit(product)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => onGenerateLabel(product)}>
                                                    <Tag className="h-4 w-4 mr-2" />
                                                    Generar Etiqueta
                                                </DropdownMenuItem>
                                                {canDelete && (
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(product.id)}
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
        </div>
    );
}
