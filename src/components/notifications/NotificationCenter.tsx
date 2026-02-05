'use client';

import {
    Bell,
    Check,
    Trash2,
    Package,
    ShoppingCart,
    CreditCard,
    AlertCircle,
    FileText,
    CheckCheck,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/contexts/NotificationsContext';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const notificationIcons = {
    stock_low: Package,
    new_order: ShoppingCart,
    payment_received: CreditCard,
    invoice_due: FileText,
    system: Bell,
};

const notificationColors = {
    stock_low: 'text-orange-500 bg-orange-500/10',
    new_order: 'text-blue-500 bg-blue-500/10',
    payment_received: 'text-emerald-500 bg-emerald-500/10',
    invoice_due: 'text-red-500 bg-red-500/10',
    system: 'text-purple-500 bg-purple-500/10',
};

export function NotificationCenter() {
    const {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    } = useNotifications();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent relative h-9 w-9"
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[380px] max-h-[600px] overflow-hidden flex flex-col bg-popover border-border"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div>
                        <h3 className="font-semibold text-base">Notificaciones</h3>
                        <p className="text-xs text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="text-xs h-8"
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Marcar todas
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[500px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-muted/50 mb-3">
                                <Bell className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                                No hay notificaciones
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Te avisaremos cuando haya novedades
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((notification) => {
                                const Icon = notificationIcons[notification.type];
                                const colorClass = notificationColors[notification.type];

                                return (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            'p-4 hover:bg-muted/50 transition-colors relative',
                                            !notification.read && 'bg-primary/5 border-l-2 border-l-primary'
                                        )}
                                    >
                                        <div className="flex gap-3">
                                            {/* Icon */}
                                            <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                                                <Icon className="h-4 w-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-medium text-sm leading-tight">
                                                        {notification.title}
                                                    </p>
                                                    {!notification.read && (
                                                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                                    {formatDistanceToNow(new Date(notification.created_at), {
                                                        addSuffix: true,
                                                        locale: es,
                                                    })}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1 shrink-0">
                                                {!notification.read && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                                        onClick={() => markAsRead(notification.id)}
                                                        title="Marcar como leída"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteNotification(notification.id)}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-border bg-muted/30">
                        <p className="text-xs text-center text-muted-foreground">
                            Mostrando las últimas {notifications.length} notificaciones
                        </p>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
