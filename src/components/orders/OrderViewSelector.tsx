import { Button } from "@/components/ui/button";
import { Columns, List, Users, LayoutGrid } from "lucide-react";
import { ViewMode } from "@/lib/orders/constants";

interface OrderViewSelectorProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

export function OrderViewSelector({ viewMode, setViewMode }: OrderViewSelectorProps) {
    return (
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
            <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className={`shrink-0 ${viewMode === "kanban" ? "bg-background shadow-sm" : ""}`}
            >
                <Columns className="h-4 w-4" />
            </Button>
            <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={`shrink-0 ${viewMode === "list" ? "bg-background shadow-sm" : ""}`}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant={viewMode === "grouped" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grouped")}
                className={`shrink-0 ${viewMode === "grouped" ? "bg-background shadow-sm" : ""}`}
            >
                <Users className="h-4 w-4" />
            </Button>
            <Button
                variant={viewMode === "compact" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("compact")}
                className={`shrink-0 ${viewMode === "compact" ? "bg-background shadow-sm" : ""}`}
            >
                <LayoutGrid className="h-4 w-4" />
            </Button>
        </div>
    );
}
