import {
    AlertCircle,
    CheckCircle,
    ChefHat,
    Package,
    Truck,
} from "lucide-react";

export const STATUS_COLUMNS = [
    {
        id: "pending",
        label: "Nuevos",
        icon: AlertCircle,
        gradient: "from-yellow-500/10 to-orange-500/10",
        border: "border-yellow-500/20",
        text: "text-yellow-600 dark:text-yellow-400",
        statuses: ["pending", "draft"],
    },
    {
        id: "confirmed",
        label: "Confirmados",
        icon: CheckCircle,
        gradient: "from-blue-500/10 to-indigo-500/10",
        border: "border-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
        statuses: ["confirmed", "preparing", "packed"],
    },
    {
        id: "preparing",
        label: "Preparando",
        icon: ChefHat,
        gradient: "from-purple-500/10 to-pink-500/10",
        border: "border-purple-500/20",
        text: "text-purple-600 dark:text-purple-400",
        statuses: ["preparing", "packed"],
    },
    {
        id: "ready",
        label: "Listos",
        icon: Package,
        gradient: "from-cyan-500/10 to-teal-500/10",
        border: "border-cyan-500/20",
        text: "text-cyan-600 dark:text-cyan-400",
        statuses: ["ready", "assigned_to_route", "assigned"],
    },
    {
        id: "shipping",
        label: "En Camino",
        icon: Truck,
        gradient: "from-indigo-500/10 to-purple-500/10",
        border: "border-indigo-500/20",
        text: "text-indigo-600 dark:text-indigo-400",
        statuses: ["out_for_delivery", "in_delivery"],
    },
    {
        id: "delivered",
        label: "Completados",
        icon: CheckCircle,
        gradient: "from-emerald-500/10 to-green-500/10",
        border: "border-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        statuses: ["delivered"],
    },
];

export type ViewMode = "kanban" | "list" | "grouped" | "compact";
