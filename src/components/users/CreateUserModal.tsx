"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Shield, Eye, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { roleLabels, Role } from "@/lib/permissions";
import { ROLE_ICONS } from "./types";
import { createUser } from "@/actions/users";
// remove use-toast
interface CreateUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableRoles: Role[];
    onSuccess: (message?: string) => void;
}

export function CreateUserModal({
    open,
    onOpenChange,
    availableRoles,
    onSuccess,
}: CreateUserModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        role: "employee" as Role,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await createUser(formData);

            if (result.error) {
                setError(result.error);
            } else {
                onSuccess("Usuario creado exitosamente");
                onOpenChange(false);
                setFormData({
                    fullName: "",
                    email: "",
                    password: "",
                    role: "employee",
                });
            }
        } catch (error) {
            setError("Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Crear Nuevo Usuario
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            Nombre Completo
                        </label>
                        <Input
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            required
                            placeholder="Juan Pérez"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email
                        </label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            placeholder="usuario@ejemplo.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            Contraseña
                        </label>
                        <Input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            minLength={6}
                            placeholder="******"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            Rol
                        </label>
                        <Select
                            value={formData.role}
                            onValueChange={(v) => setFormData({ ...formData, role: v as Role })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRoles.map((role) => {
                                    const RoleIcon = ROLE_ICONS[role] || Eye;
                                    return (
                                        <SelectItem key={role} value={role}>
                                            <div className="flex items-center gap-2">
                                                <RoleIcon className="h-4 w-4" />
                                                {roleLabels[role]}
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                "Crear Usuario"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
