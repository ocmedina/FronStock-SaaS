import { Trash2, ShoppingCart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "./types";

interface POSCartProps {
    items: CartItem[];
    onUpdateQuantity: (productId: string, quantity: number) => void;
    onRemove: (productId: string) => void;
    onClear: () => void;
    subtotal: number;
    totalItems: number;
}

export function POSCart({
    items,
    onUpdateQuantity,
    onRemove,
    onClear,
    subtotal,
    totalItems,
}: POSCartProps) {
    if (items.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <div className="bg-muted p-6 rounded-full mb-4">
                    <ShoppingCart className="h-12 w-12 opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Carrito Vacío</h3>
                <p className="text-sm text-center max-w-[250px]">
                    Busca productos o usa el catálogo (F3) para agregar items a la venta
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-secondary/20">
            <div className="flex items-center justify-between p-2 px-4 border-b border-border bg-card">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Items en carrito ({totalItems})
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-6 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Vaciar Carrito
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-border">
                    {items.map((item) => (
                        <div
                            key={item.product.id}
                            className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group animate-in fade-in slide-in-from-left-2 duration-200"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-medium text-foreground truncate pr-2">
                                        {item.product.name}
                                    </h4>
                                    <span className="font-bold text-emerald-500">
                                        ${(item.product.price * item.quantity).toLocaleString("es-AR")}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                        ${item.product.price.toLocaleString("es-AR")} x {item.quantity}
                                        {item.product.plu && (
                                            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1 rounded border border-blue-500/20">
                                                PLU {item.product.plu}
                                            </span>
                                        )}
                                    </span>
                                    {item.discount > 0 && (
                                        <span className="text-amber-500 text-xs">
                                            -{item.discount}% desc.
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-background rounded-lg border border-border">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-l-lg hover:bg-muted text-muted-foreground"
                                        onClick={() =>
                                            onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))
                                        }
                                    >
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center text-sm font-medium text-foreground">
                                        {item.quantity}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-r-lg hover:bg-muted text-emerald-500 hover:text-emerald-600"
                                        onClick={() =>
                                            onUpdateQuantity(item.product.id, item.quantity + 1)
                                        }
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                    onClick={() => onRemove(item.product.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-card border-t border-border">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString("es-AR")}</span>
                </div>
            </div>
        </div>
    );
}
