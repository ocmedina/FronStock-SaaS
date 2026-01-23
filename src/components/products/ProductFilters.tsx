"use client";

import { Search, Edit3, Tag, X, List, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProductFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    viewMode: "table" | "grid";
    onViewModeChange: (mode: "table" | "grid") => void;
    selectedCount: number;
    onBulkUpdate: () => void;
    onGenerateLabels: () => void;
    onClearSelection: () => void;
}

export function ProductFilters({
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
    selectedCount,
    onBulkUpdate,
    onGenerateLabels,
    onClearSelection,
}: ProductFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/50 p-3 rounded-xl border">
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre, SKU o código..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 bg-background/50 border-input/50 focus:bg-background transition-colors"
                />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {selectedCount > 0 && (
                    <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-5 duration-200">
                        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">
                            {selectedCount} seleccionados
                        </span>
                        <Button variant="outline" size="icon-sm" onClick={onBulkUpdate} title="Edición masiva">
                            <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon-sm" onClick={onGenerateLabels} title="Etiquetas">
                            <Tag className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={onClearSelection} title="Cancelar selección">
                            <X className="h-4 w-4" />
                        </Button>
                        <div className="h-4 w-px bg-border mx-1" />
                    </div>
                )}

                <div className="flex items-center border rounded-lg overflow-hidden bg-background shadow-sm p-0.5">
                    <button
                        onClick={() => onViewModeChange("table")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                        title="Vista lista"
                    >
                        <List size={16} />
                    </button>
                    <button
                        onClick={() => onViewModeChange("grid")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
                        title="Vista cuadrícula"
                    >
                        <LayoutGrid size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
