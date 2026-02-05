'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import type { Product } from '../types';
import { cn } from '@/lib/utils';

interface ProductGridProps {
    products: Product[];
    onProductSelect: (product: Product) => void;
    maxItems?: number;
}

const PRODUCT_EMOJIS: Record<string, string> = {
    bebida: '🥤',
    pan: '🍞',
    leche: '🥛',
    chocolate: '🍫',
    jugo: '🧃',
    galleta: '🍪',
    cafe: '☕',
    agua: '💧',
    default: '📦',
};

function getProductEmoji(productName: string): string {
    const name = productName.toLowerCase();
    for (const [key, emoji] of Object.entries(PRODUCT_EMOJIS)) {
        if (name.includes(key)) return emoji;
    }
    return PRODUCT_EMOJIS.default;
}

export function ProductGrid({ products, onProductSelect, maxItems = 8 }: ProductGridProps) {
    const [topProducts, setTopProducts] = useState<Product[]>([]);

    useEffect(() => {
        // Sort by stock descending (most available first) and take top items
        const sorted = [...products]
            .filter((p) => p.stock > 0)
            .sort((a, b) => b.stock - a.stock)
            .slice(0, maxItems);
        setTopProducts(sorted);
    }, [products, maxItems]);

    if (topProducts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No hay productos disponibles</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Productos Rápidos</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {topProducts.map((product) => {
                    const isLowStock = product.stock < 10;
                    const emoji = getProductEmoji(product.name);

                    return (
                        <button
                            key={product.id}
                            onClick={() => onProductSelect(product)}
                            className={cn(
                                'aspect-square rounded-xl transition-all',
                                'bg-gradient-to-br from-primary/10 to-primary/5',
                                'hover:from-primary/20 hover:to-primary/10',
                                'border-2 border-primary/20 hover:border-primary/40',
                                'hover:scale-105 active:scale-95',
                                'flex flex-col items-center justify-center p-3 gap-2',
                                'relative group'
                            )}
                        >
                            {/* Emoji */}
                            <span className="text-4xl">{emoji}</span>

                            {/* Product Name */}
                            <p className="text-xs font-semibold text-center line-clamp-2 leading-tight">
                                {product.name}
                            </p>

                            {/* Price */}
                            <p className="text-sm font-bold text-primary">
                                ${product.price.toLocaleString()}
                            </p>

                            {/* Low Stock Warning */}
                            {isLowStock && (
                                <div className="absolute top-1 right-1 flex items-center gap-1 bg-amber-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {product.stock}
                                </div>
                            )}

                            {/* Hover Effect */}
                            <div className="absolute inset-0 rounded-xl bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
