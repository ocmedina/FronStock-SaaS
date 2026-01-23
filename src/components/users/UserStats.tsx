import { Card, CardContent } from "@/components/ui/card";
import {
    Users,
    Mail,
    Shield,
    UserCog,
} from "lucide-react";
import { roleLabels, Role } from "@/lib/permissions";
import { User, Invitation } from "./types";

interface UserStatsProps {
    users: User[];
    invitations: Invitation[];
    currentRole: Role;
}

export function UserStats({ users, invitations, currentRole }: UserStatsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Usuarios</p>
                            <p className="text-2xl font-bold mt-1">{users.length}</p>
                        </div>
                        <Users className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm">Invitaciones</p>
                            <p className="text-2xl font-bold mt-1">{invitations.length}</p>
                        </div>
                        <Mail className="h-8 w-8 opacity-50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Administradores</p>
                            <p className="text-2xl font-bold mt-1">
                                {
                                    users.filter(
                                        (u) => u.role === "admin" || u.role === "owner",
                                    ).length
                                }
                            </p>
                        </div>
                        <Shield className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm">Tu Rol</p>
                            <p className="text-lg font-bold mt-1">
                                {roleLabels[currentRole] || currentRole}
                            </p>
                        </div>
                        <UserCog className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
