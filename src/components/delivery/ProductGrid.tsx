
"use client";

import { useState, useEffect } from "react";
import { Search, Minus, Plus, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Product {
    id: string;
    name: string;
    price: number;
    sku?: string;
    stock: number;
}

interface ProductGridProps {
    cart: { [key: string]: number };
    onUpdateCart: (product: Product, quantity: number) => void;
}

export function ProductGrid({ cart, onUpdateCart }: ProductGridProps) {
    const { organizationId } = useOrganization();
    const [products, setProducts] = useState<Product[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!organizationId) return;

        const loadProducts = async () => {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('organization_id', organizationId)
                .order('name');
            if (data) setProducts(data);
            setLoading(false);
        };
        loadProducts();
    }, [organizationId, supabase]);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku?.includes(query)
    );

    return (
        <div className="space-y-4">
            {/* Mobile Sticky Search */}
            <div className="sticky top-0 bg-slate-950 pt-2 pb-2 z-10">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                        className="pl-9 bg-slate-900 border-slate-800 text-white rounded-lg"
                        placeholder="Buscar producto..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pb-24">
                {filtered.map(product => {
                    const qty = cart[product.id] || 0;
                    return (
                        <div
                            key={product.id}
                            className={`
                                flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.99]
                                ${qty > 0
                                    ? 'bg-emerald-900/10 border-emerald-500/30'
                                    : 'bg-slate-900 border-slate-800'
                                }
                            `}
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <h4 className="font-bold text-slate-200 truncate text-sm">{product.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-emerald-400 font-bold">${product.price}</span>
                                    {product.stock <= 5 && (
                                        <span className="text-[10px] text-orange-500 bg-orange-500/10 px-1.5 rounded">
                                            Stock: {product.stock}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {qty > 0 && (
                                    <>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-full"
                                            onClick={() => onUpdateCart(product, -1)}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="w-5 text-center font-bold text-white text-lg leading-none">
                                            {qty}
                                        </span>
                                    </>
                                )}
                                <Button
                                    size="icon"
                                    disabled={qty >= product.stock}
                                    className={`
                                            h-9 w-9 rounded-full shadow-lg transition-colors
                                            ${qty > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-emerald-500 border border-slate-700'}
                                            ${qty >= product.stock ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    onClick={() => {
                                        if (qty < product.stock) {
                                            onUpdateCart(product, 1);
                                        } else {
                                            // Optional: Toast "No hay más stock"
                                        }
                                    }}
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
