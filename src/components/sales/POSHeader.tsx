import { Plus, ShoppingCart, X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaleTab } from "./types";

interface POSHeaderProps {
    tabs: SaleTab[];
    activeTabId: string;
    onTabChange: (id: string) => void;
    onAddTab: () => void;
    onCloseTab: (id: string) => void;
    onShowShortcuts: () => void;
}

export function POSHeader({
    tabs,
    activeTabId,
    onTabChange,
    onAddTab,
    onCloseTab,
    onShowShortcuts,
}: POSHeaderProps) {
    return (
        <div className="flex items-center gap-2 p-2 bg-card border-b border-border">
            <div className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border min-w-fit
              ${tab.id === activeTabId
                                ? "bg-muted border-primary/20 text-foreground shadow-sm"
                                : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            }
            `}
                    >
                        <div
                            className={`p-1.5 rounded-md ${tab.id === activeTabId
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-muted text-muted-foreground group-hover:text-foreground"
                                }`}
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium leading-none">{tab.name}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                                {tab.cart.length} items • $
                                {tab.cart
                                    .reduce((acc, item) => acc + item.product.price * item.quantity, 0)
                                    .toLocaleString("es-AR")}
                            </span>
                        </div>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseTab(tab.id);
                                }}
                                className={`
                  ml-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                  ${tab.id === activeTabId
                                        ? "hover:bg-muted text-muted-foreground"
                                        : "hover:bg-muted text-muted-foreground"
                                    }
                `}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={onAddTab}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors border border-dashed border-border hover:border-emerald-500/30 ml-1"
                    title="Nueva Venta (F4)"
                >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs font-medium hidden sm:inline">Nueva</span>
                </button>
            </div>

            <div className="flex items-center gap-2 border-l border-border pl-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShowShortcuts}
                    className="hidden md:flex gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                    <Keyboard className="h-4 w-4" />
                    <span className="text-xs hidden lg:inline">Atajos</span>
                </Button>
            </div>
        </div>
    );
}
