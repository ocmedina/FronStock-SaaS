'use client';

import { ShoppingCart, Trash2, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CartItem } from '../types';
import { cn } from '@/lib/utils';

interface CartProps {
    items: CartItem[];
    onUpdateQuantity: (productId: string, quantity: number) => void;
    onUpdatePrice: (productId: string, unitPrice: number) => void;
    canEditPrice?: boolean;
    onRemove: (productId: string) => void;
    onClear: () => void;
    subtotal: number;
    totalItems: number;
}

export function Cart({
    items,
    onUpdateQuantity,
    onUpdatePrice,
    canEditPrice = true,
    onRemove,
    onClear,
    subtotal,
    totalItems,
}: CartProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-border/70">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Carrito
                    </h2>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                        <ShoppingCart className="h-8 w-8 text-primary/50" />
                    </div>
                    <p className="text-sm font-medium">El carrito está vacío</p>
                    <p className="text-xs mt-1">Busca productos para comenzar</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/70 bg-background">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Carrito
                    <span className="text-sm font-normal text-muted-foreground">
                        ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                    </span>
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <X className="h-4 w-4 mr-1" />
                    Limpiar
                </Button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {items.map((item) => {
                    const unitPrice = item.unitPrice ?? item.product.price;
                    const itemTotal = unitPrice * item.quantity;

                    return (
                        <div
                            key={item.product.id}
                            className={cn(
                                'flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg',
                                'bg-muted/35 hover:bg-muted/70 transition-colors',
                                'border border-border/60 hover:border-primary/20',
                                'group'
                            )}
                        >
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.product.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        disabled={!canEditPrice}
                                        value={Number.isFinite(unitPrice) ? unitPrice : 0}
                                        onChange={(e) => {
                                            const value = Number(e.target.value);
                                            if (!Number.isNaN(value)) {
                                                onUpdatePrice(item.product.id, value);
                                            }
                                        }}
                                        className="h-8 w-28"
                                        aria-label={`Precio unitario de ${item.product.name}`}
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        {canEditPrice ? 'suelto' : 'bloqueado'}
                                    </span>
                                </div>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center font-bold">{item.quantity}</span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg"
                                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                    disabled={item.quantity >= item.product.stock}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            {/* Item Total */}
                            <p className="w-full sm:w-24 text-left sm:text-right font-bold text-primary">
                                ${itemTotal.toLocaleString()}
                            </p>

                            {/* Delete Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onRemove(item.product.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            {/* Subtotal */}
            <div className="p-4 border-t border-border/70 bg-background">
                <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-muted-foreground">Subtotal:</span>
                    <span className="text-2xl font-semibold tracking-tight text-primary">
                        ${subtotal.toLocaleString('es-AR')}
                    </span>
                </div>
            </div>
        </div>
    );
}
