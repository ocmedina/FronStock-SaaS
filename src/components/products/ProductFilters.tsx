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
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
            <div className="relative w-full max-w-full sm:max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre, SKU o código..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-11 border-slate-200 bg-slate-50 pl-10 transition-colors focus:bg-background"
                />
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:justify-between">
                {selectedCount > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5 duration-200 flex-wrap">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
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
                        <div className="hidden sm:block h-4 w-px bg-border mx-1" />
                    </div>
                )}

                <div className="ml-auto flex items-center gap-0.5 overflow-hidden rounded-xl border bg-background p-1 shadow-sm">
                    <button
                        onClick={() => onViewModeChange("table")}
                        className={`rounded-lg p-2 transition-colors ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
                        title="Vista lista"
                    >
                        <List size={16} />
                    </button>
                    <button
                        onClick={() => onViewModeChange("grid")}
                        className={`rounded-lg p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
                        title="Vista cuadrícula"
                    >
                        <LayoutGrid size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
