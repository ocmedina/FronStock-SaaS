"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Role, roleLabels } from "@/lib/permissions";

interface UserFiltersProps {
    onFilterChange: (filters: UserFilterValues) => void;
    availableRoles: Role[];
}

export interface UserFilterValues {
    searchTerm?: string;
    role?: Role;
    status?: "active" | "inactive";
}

export function UserFilters({ onFilterChange, availableRoles }: UserFiltersProps) {
    const [filters, setFilters] = useState<UserFilterValues>({});

    const handleFilterChange = (key: keyof UserFilterValues, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Nombre o email..."
                        value={filters.searchTerm || ""}
                        onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                    value={filters.role || "all"}
                    onValueChange={(v) =>
                        handleFilterChange("role", v === "all" ? undefined : v)
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los roles</SelectItem>
                        {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                                {roleLabels[role]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                    value={filters.status || "all"}
                    onValueChange={(v) =>
                        handleFilterChange("status", v === "all" ? undefined : v)
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Activos</SelectItem>
                        <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
