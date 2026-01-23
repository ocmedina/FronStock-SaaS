import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Eye } from "lucide-react";
import { roleLabels, roleDescriptions, Role } from "@/lib/permissions";
import { ROLE_COLORS, ROLE_ICONS } from "./types";

export function RoleLegend() {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Roles Disponibles
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {(Object.keys(roleLabels) as Role[]).map((role) => {
                        const RoleIcon = ROLE_ICONS[role] || Eye;
                        return (
                            <div
                                key={role}
                                className="rounded-xl p-4 bg-muted/50 hover:bg-muted transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div
                                        className={`w-8 h-8 rounded-lg ${ROLE_COLORS[role]} flex items-center justify-center shadow-sm`}
                                    >
                                        <RoleIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="font-medium">{roleLabels[role]}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {roleDescriptions[role]}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
