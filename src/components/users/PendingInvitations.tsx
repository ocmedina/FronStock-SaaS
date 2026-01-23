import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Eye } from "lucide-react";
import { roleLabels, Role } from "@/lib/permissions";
import { Invitation, ROLE_ICONS } from "./types";

interface PendingInvitationsProps {
    invitations: Invitation[];
    canDeleteUsers: boolean;
    onCancel: (invitationId: string) => void;
}

export function PendingInvitations({
    invitations,
    canDeleteUsers,
    onCancel,
}: PendingInvitationsProps) {
    if (invitations.length === 0) return null;

    return (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Mail className="h-5 w-5" />
                    Invitaciones Pendientes
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {invitations.map((inv) => {
                        const RoleIcon = ROLE_ICONS[inv.role] || Eye;
                        return (
                            <div
                                key={inv.id}
                                className="flex items-center justify-between bg-background rounded-xl p-4 border"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{inv.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                                <RoleIcon className="h-3 w-3 mr-1" />
                                                {roleLabels[inv.role as Role] || inv.role}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(inv.created_at).toLocaleDateString("es-AR")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {canDeleteUsers && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onCancel(inv.id)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
