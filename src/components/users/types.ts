import {
    Crown,
    ShieldCheck,
    Briefcase,
    UserCog,
    Eye,
    LucideIcon,
    Truck,
} from "lucide-react";
import { Role } from "@/lib/permissions";

export interface User {
    id: string;
    full_name: string | null;
    role: string;
    updated_at: string;
    organization_id?: string | null; // Added for completeness based on usage
}

export interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
}

export const ASSIGNABLE_ROLES: Role[] = [
    "admin",
    "manager",
    "employee",
    "delivery",
    "viewer",
];

export const ROLE_COLORS: Record<string, string> = {
    owner: "bg-gradient-to-r from-purple-500 to-pink-500",
    admin: "bg-gradient-to-r from-blue-500 to-cyan-500",
    manager: "bg-gradient-to-r from-emerald-500 to-green-500",
    employee: "bg-gradient-to-r from-amber-500 to-orange-500",
    delivery: "bg-gradient-to-r from-indigo-500 to-blue-600",
    viewer: "bg-gradient-to-r from-slate-400 to-slate-500",
};

export const ROLE_ICONS: Record<string, LucideIcon> = {
    owner: Crown,
    admin: ShieldCheck,
    manager: Briefcase,
    employee: UserCog,
    delivery: Truck,
    viewer: Eye,
};
