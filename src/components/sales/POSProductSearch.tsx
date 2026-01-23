import { useRef, useEffect, useState } from "react";
import { Search, Loader2, Package, Barcode, Hash, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Product } from "./types";

interface POSProductSearchProps {
    products: Product[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onProductSelect: (product: Product) => void;
    onOpenCatalog: () => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function POSProductSearch({
    products,
    searchQuery,
    onSearchChange,
    onProductSelect,
    onOpenCatalog,
    searchInputRef,
}: POSProductSearchProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter products for dropdown
    const filteredProducts = searchQuery
        ? products
            .filter(
                (p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.barcode?.includes(searchQuery) ||
                    p.plu?.includes(searchQuery)
            )
            .slice(0, 8)
        : [];

    useEffect(() => {
        setShowDropdown(searchQuery.length > 0 && filteredProducts.length > 0);
        setSelectedIndex(0);
    }, [searchQuery, filteredProducts.length]);

    // Handle keyboard navigation for dropdown
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showDropdown) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredProducts.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation(); // Avoid submitting form if any
                if (filteredProducts[selectedIndex]) {
                    onProductSelect(filteredProducts[selectedIndex]);
                    onSearchChange("");
                    setShowDropdown(false);
                }
            } else if (e.key === "Escape") {
                setShowDropdown(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showDropdown, filteredProducts, selectedIndex, onProductSelect, onSearchChange]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchInputRef]);

    return (
        <div className="p-4 bg-card border-b border-border z-20 relative">
            <div className="relative max-w-3xl mx-auto">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Buscar por nombre, código de barras, SKU o PLU..."
                        className="pl-12 h-14 text-lg bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500/50"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onFocus={() => {
                            if (searchQuery.length > 0 && filteredProducts.length > 0) {
                                setShowDropdown(true);
                            }
                        }}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <kbd className="hidden md:inline-flex h-6 select-none items-center gap-1 rounded border border-border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground">
                            <span className="text-xs">F3</span>
                            Catálogo
                        </kbd>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-emerald-500 hover:bg-muted"
                            onClick={onOpenCatalog}
                        >
                            <List className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && (
                    <div
                        ref={dropdownRef}
                        className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {filteredProducts.map((product, index) => (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                        onProductSelect(product);
                                        onSearchChange("");
                                        setShowDropdown(false);
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left group
                    ${index === selectedIndex
                                            ? "bg-emerald-500/20 shadow-sm ring-1 ring-emerald-500/50"
                                            : "hover:bg-muted"
                                        }
                  `}
                                >
                                    <div className={`p-2 rounded-md ${index === selectedIndex ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground group-hover:text-foreground"
                                        }`}>
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${index === selectedIndex ? "text-emerald-500" : "text-foreground"
                                            }`}>
                                            {product.name}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            {product.stock <= 0 ? (
                                                <span className="text-destructive font-medium">Sin stock</span>
                                            ) : (
                                                <span>{product.stock} unid.</span>
                                            )}
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
                                                <span className="flex items-center gap-1 text-blue-500">
                                                    <span className="font-bold">PLU</span> {product.plu}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-bold ${index === selectedIndex ? "text-emerald-500" : "text-emerald-600"
                                            }`}>
                                            ${product.price.toLocaleString("es-AR")}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
