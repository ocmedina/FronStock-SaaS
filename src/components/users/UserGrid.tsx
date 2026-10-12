import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, MoreHorizontal, Trash2, UserCog } from "lucide-react";
import { roleLabels, roleDescriptions, Role, canAssignRole } from "@/lib/permissions";
import { User, ROLE_COLORS, ROLE_ICONS } from "./types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface UserGridProps {
    users: User[];
    currentUserId: string | undefined;
    currentRole: Role;
    loading: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEditRole: (user: User) => void;
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
            <div className="flex items-center justify-center rounded-xl border h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="hidden md:table-cell">Última actualización</TableHead>
                        <TableHead className="w-16 text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
            {users.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || Eye;
                const isCurrentUser = user.id === currentUserId;
                return (
                    <TableRow
                        key={user.id}
                        className={isCurrentUser ? "bg-primary/5" : ""}
                    >
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${ROLE_COLORS[user.role] || ROLE_COLORS.viewer}`}>
                                    {getInitials(user.full_name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{user.full_name || "Sin nombre"}</p>
                                    {isCurrentUser && <Badge variant="outline" className="mt-1 text-xs">Tu usuario</Badge>}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary" className="gap-1">
                                <RoleIcon className="h-3.5 w-3.5" />
                                {roleLabels[user.role as Role] || user.role}
                            </Badge>
                            <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
                                {roleDescriptions[user.role as Role]}
                            </p>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                            {new Date(user.updated_at).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right">
                            {!isCurrentUser && user.role !== "owner" && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label={`Acciones para ${user.full_name || "usuario"}`}>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canEdit && canAssignRole(currentRole, user.role as Role) && (
                                            <DropdownMenuItem onClick={() => onEditRole(user)}>
                                                <UserCog className="mr-2 h-4 w-4" />Cambiar rol
                                            </DropdownMenuItem>
                                        )}
                                        {canDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => onRemoveUser(user.id, user.full_name || "usuario")}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />Eliminar usuario
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </TableCell>
                    </TableRow>
                );
            })}
                </TableBody>
            </Table>
            {users.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">No hay usuarios que coincidan con los filtros.</p>
            )}
        </div>
    );
}
