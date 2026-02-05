'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Barcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Product } from '../types';
import { cn } from '@/lib/utils';

interface SearchBarProps {
    products: Product[];
    onProductSelect: (product: Product) => void;
    autoFocus?: boolean;
}

export function SearchBar({ products, onProductSelect, autoFocus = true }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        const searchTerm = query.toLowerCase();
        const filtered = products.filter(
            (p) =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku?.toLowerCase().includes(searchTerm) ||
                p.barcode?.toLowerCase().includes(searchTerm) ||
                p.plu?.toLowerCase().includes(searchTerm)
        );

        setResults(filtered.slice(0, 8));
        setShowResults(filtered.length > 0);
        setSelectedIndex(0);
    }, [query, products]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showResults || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % results.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowResults(false);
                setQuery('');
                break;
        }
    };

    const handleSelect = (product: Product) => {
        onProductSelect(product);
        setQuery('');
        setShowResults(false);
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query && setShowResults(true)}
                    placeholder="🔍 Buscar por nombre, código o escanear..."
                    className="h-14 pl-12 pr-12 text-lg rounded-xl border-2 focus:border-primary"
                />
                <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>

            {/* Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-card rounded-xl shadow-2xl border-2 border-border z-50 max-h-[400px] overflow-y-auto">
                    {results.map((product, index) => (
                        <button
                            key={product.id}
                            onClick={() => handleSelect(product)}
                            className={cn(
                                'w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors',
                                'border-b border-border last:border-0',
                                selectedIndex === index && 'bg-accent'
                            )}
                        >
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-2xl">📦</span>
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <p className="font-semibold truncate">{product.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {product.sku && `SKU: ${product.sku}`}
                                    {product.barcode && ` • ${product.barcode}`}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-lg font-bold text-primary">
                                    ${product.price.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Stock: {product.stock}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
