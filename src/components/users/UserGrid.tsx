import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, UserCog, Trash2, WalletCards } from "lucide-react";
import { roleLabels, roleDescriptions, Role, canAssignRole } from "@/lib/permissions";
import { User, ROLE_COLORS, ROLE_ICONS } from "./types";

interface UserGridProps {
    users: User[];
    currentUserId: string | undefined;
    currentRole: Role;
    loading: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEditRole: (user: User) => void;
    onAssignCashRegisters: (user: User) => void;
    onRemoveUser: (userId: string, userName: string) => void;
}

export function UserGrid({
    users,
    currentUserId,
    currentRole,
    loading,
    canEdit,
    canDelete,
    onEditRole,
    onAssignCashRegisters,
    onRemoveUser,
}: UserGridProps) {
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

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="col-span-full flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || Eye;
                const isCurrentUser = user.id === currentUserId;
                return (
                    <Card
                        key={user.id}
                        className={`hover:shadow-lg transition-shadow ${isCurrentUser ? "ring-2 ring-primary/20" : ""
                            }`}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-12 h-12 rounded-full ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer
                                            } flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                                    >
                                        {getInitials(user.full_name)}
                                    </div>
                                    <div>
                                        <p className="font-semibold flex items-center gap-2">
                                            {user.full_name || "Sin nombre"}
                                            {isCurrentUser && (
                                                <Badge variant="outline" className="text-xs">
                                                    Tú
                                                </Badge>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                {roleLabels[user.role as Role] || user.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground mb-4">
                                {roleDescriptions[user.role as Role]}
                            </p>

                            {!isCurrentUser && user.role !== "owner" && (
                                <div className="flex gap-2">
                                    {canEdit && canAssignRole(currentRole, user.role as Role) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onEditRole(user)}
                                            className="flex-1"
                                        >
                                            <UserCog className="h-4 w-4" />
                                            Cambiar Rol
                                        </Button>
                                    )}
                                    {canEdit && user.role === "employee" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onAssignCashRegisters(user)}
                                            title="Asignar cajas"
                                        >
                                            <WalletCards className="h-4 w-4" />
                                            Cajas
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                onRemoveUser(user.id, user.full_name || "usuario")
                                            }
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
