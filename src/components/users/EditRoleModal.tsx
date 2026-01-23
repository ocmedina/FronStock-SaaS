import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, UserCog, Eye } from "lucide-react";
import { roleLabels, roleDescriptions, Role } from "@/lib/permissions";
import { User, ROLE_COLORS, ROLE_ICONS, ASSIGNABLE_ROLES } from "./types";

interface EditRoleModalProps {
    user: User | null;
    newRole: string;
    saving: boolean;
    availableRoles: Role[];
    onClose: () => void;
    onSave: () => void;
    onRoleChange: (role: string) => void;
}

export function EditRoleModal({
    user,
    newRole,
    saving,
    availableRoles,
    onClose,
    onSave,
    onRoleChange,
}: EditRoleModalProps) {
    // Función para obtener iniciales
    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Dialog open={!!user} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCog className="h-5 w-5 text-primary" />
                        Cambiar Rol
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                        <div
                            className={`w-12 h-12 rounded-full ${ROLE_COLORS[user?.role || "viewer"]
                                } flex items-center justify-center text-white font-bold`}
                        >
                            {getInitials(user?.full_name || null)}
                        </div>
                        <div>
                            <p className="font-semibold">
                                {user?.full_name || "Sin nombre"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Rol actual:{" "}
                                {roleLabels[user?.role as Role] || user?.role}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nuevo Rol</label>
                        <Select value={newRole} onValueChange={onRoleChange}>
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
                        <p className="text-xs text-muted-foreground">
                            {roleDescriptions[newRole as Role]}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={onSave}
                            disabled={saving || newRole === user?.role}
                            className="flex-1"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
