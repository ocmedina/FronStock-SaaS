"use client";

import { Package, MoreHorizontal, Edit3, Trash2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product } from "@/types/database.types";

interface ProductGridProps {
    products: Product[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
}

export function ProductGrid({
    products,
    selectedIds,
    onToggleSelect,
    onEdit,
    onDelete,
}: ProductGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
            {products.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                    <div
                        key={product.id}
                        className={`group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                    >
                        <div className="p-5 flex flex-col h-full gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelect(product.id)}
                                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                    />
                                    {product.is_combo && (
                                        <Badge variant="secondary" className="gap-1 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-200">
                                            <Layers className="h-3 w-3" /> Combo
                                        </Badge>
                                    )}
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(product)}>
                                            <Edit3 className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(product.id)}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="space-y-1">
                                <h3 className="font-semibold leading-none tracking-tight truncate" title={product.name}>
                                    {product.name}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">SKU: {product.sku || '-'}</p>
                            </div>

                            <div className="flex items-end justify-between mt-auto pt-2">
                                <div>
                                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                        ${product.price}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Unitario</p>
                                </div>
                                <div className="text-right">
                                    <div className={`flex items-center gap-1 font-medium ${product.min_stock && product.stock <= product.min_stock
                                        ? "text-rose-500"
                                        : "text-foreground"
                                        }`}>
                                        <Package className="h-3.5 w-3.5" />
                                        {product.stock}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Stock</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer bar with hover effect */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                    </div>
                );
            })}
        </div>
    );
}
