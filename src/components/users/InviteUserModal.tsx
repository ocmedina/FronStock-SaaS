import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, UserPlus, Mail, Shield, Eye, Lightbulb } from "lucide-react";
import { roleLabels, Role } from "@/lib/permissions";
import { ROLE_ICONS } from "./types";

interface InviteUserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inviteData: { email: string; role: string };
    setInviteData: (data: { email: string; role: string }) => void;
    availableRoles: Role[];
    saving: boolean;
    onInvite: (e: React.FormEvent) => void;
}

export function InviteUserModal({
    open,
    onOpenChange,
    inviteData,
    setInviteData,
    availableRoles,
    saving,
    onInvite,
}: InviteUserModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Invitar Usuario
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={onInvite} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email
                        </label>
                        <Input
                            type="email"
                            value={inviteData.email}
                            onChange={(e) =>
                                setInviteData({ ...inviteData, email: e.target.value })
                            }
                            required
                            placeholder="usuario@ejemplo.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            Rol
                        </label>
                        <Select
                            value={inviteData.role}
                            onValueChange={(v) => setInviteData({ ...inviteData, role: v })}
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

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1"><Lightbulb className="h-4 w-4 inline mr-1" />Cómo funciona:</p>
                        <p className="text-blue-600 dark:text-blue-400">
                            El usuario debe registrarse con este email. Al registrarse, se
                            unirá automáticamente a la organización con el rol asignado.
                        </p>
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
                        <Button type="submit" disabled={saving} className="flex-1">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {saving ? "Enviando..." : "Invitar"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
