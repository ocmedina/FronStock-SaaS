import { Badge } from "@/components/ui/badge";
import { differenceInMinutes } from "date-fns";
import React from "react";
import { Truck, Store } from "lucide-react";

export const getUrgencyBadge = (createdAt: string, status: string): React.ReactElement | null => {
    const minutesAgo = differenceInMinutes(new Date(), new Date(createdAt));

    if (status === "pending" && minutesAgo > 30) {
        return (
            <Badge className="animate-pulse bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 text-[10px]">
                ¡Urgente!
            </Badge>
        );
    }
    if (status === "preparing" && minutesAgo > 45) {
        return (
            <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px]">
                Revisar
            </Badge>
        );
    }
    if (status === "ready" && minutesAgo > 20) {
        return (
            <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-[10px]">
                Esperando
            </Badge>
        );
    }
    if ((status === "assigned" || status === "in_delivery") && minutesAgo > 45) {
        return (
            <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-[10px]">
                Ruta activa
            </Badge>
        );
    }
    return null;
};

export const getServiceTypeBadge = (serviceType: string): React.ReactElement => {
    if (serviceType === "delivery") {
        return (
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
                <Truck className="h-3 w-3 inline mr-0.5" /> Reparto
            </Badge>
        );
    }
    return (
        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]">
            <Store className="h-3 w-3 inline mr-0.5" /> Mostrador
        </Badge>
    );
};

export const getStatusBadge = (status: string): React.ReactElement => {
    if (status === "pending" || status === "draft") {
        return (
            <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs">
                Nuevo
            </Badge>
        );
    }
    if (status === "confirmed") {
        return (
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                Confirmado
            </Badge>
        );
    }
    if (status === "preparing" || status === "packed") {
        return (
            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs">
                Preparando
            </Badge>
        );
    }
    if (status === "ready" || status === "assigned_to_route") {
        return (
            <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs">
                Listo
            </Badge>
        );
    }
    if (status === "assigned") {
        return (
            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs">
                Asignado
            </Badge>
        );
    }
    if (status === "out_for_delivery") {
        return (
            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs">
                En Camino
            </Badge>
        );
    }
    if (status === "in_delivery") {
        return (
            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs">
                En Reparto
            </Badge>
        );
    }
    if (status === "not_delivered" || status === "cancelled") {
        return (
            <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                No Entregado
            </Badge>
        );
    }
    return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
            Completado
        </Badge>
    );
};
