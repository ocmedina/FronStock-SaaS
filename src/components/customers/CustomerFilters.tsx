import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface CustomerFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showDebtorsOnly: boolean;
    setShowDebtorsOnly: (show: boolean) => void;
    hideDebtorsToggle?: boolean;
}

export function CustomerFilters({
    searchQuery,
    setSearchQuery,
    showDebtorsOnly,
    setShowDebtorsOnly,
    hideDebtorsToggle = false,
}: CustomerFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/50 p-3 rounded-xl border">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre, email, teléfono..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                />
            </div>

            {!hideDebtorsToggle && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center space-x-2 bg-background border px-3 py-2 rounded-md">
                        <Checkbox
                            id="debtors-only"
                            checked={showDebtorsOnly}
                            onCheckedChange={(checked) => setShowDebtorsOnly(!!checked)}
                        />
                        <label
                            htmlFor="debtors-only"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            Solo Deudores
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}
