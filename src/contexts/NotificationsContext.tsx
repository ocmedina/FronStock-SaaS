'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOrganization } from './OrganizationContext';
import { toast } from 'sonner';

export interface Notification {
    id: string;
    organization_id: string;
    user_id?: string;
    type: 'stock_low' | 'new_order' | 'payment_received' | 'invoice_due' | 'system';
    title: string;
    message: string;
    data?: any;
    read: boolean;
    created_at: string;
}

interface NotificationsContextType {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { organization } = useOrganization();
    const supabase = createClient();

    const loadNotifications = async () => {
        if (!organization?.id) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (data) setNotifications(data);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [organization?.id]);

    useEffect(() => {
        if (!organization?.id) return;

        // Suscribirse a cambios en tiempo real
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications((prev) => [newNotification, ...prev]);

                    // Mostrar toast para notificaciones importantes
                    if (newNotification.type === 'stock_low') {
                        toast.warning(newNotification.title, {
                            description: newNotification.message,
                        });
                    } else if (newNotification.type === 'new_order') {
                        toast.success(newNotification.title, {
                            description: newNotification.message,
                        });
                    } else if (newNotification.type === 'payment_received') {
                        toast.success(newNotification.title, {
                            description: newNotification.message,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload) => {
                    const updatedNotification = payload.new as Notification;
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `organization_id=eq.${organization.id}`,
                },
                (payload) => {
                    const deletedId = payload.old.id;
                    setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organization?.id, supabase]);

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;

            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Error al marcar notificación como leída');
        }
    };

    const markAllAsRead = async () => {
        if (!organization?.id) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('organization_id', organization.id)
                .eq('read', false);

            if (error) throw error;

            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            toast.success('Todas las notificaciones marcadas como leídas');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Error al marcar todas como leídas');
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setNotifications((prev) => prev.filter((n) => n.id !== id));
            toast.success('Notificación eliminada');
        } catch (error) {
            console.error('Error deleting notification:', error);
            toast.error('Error al eliminar notificación');
        }
    };

    const refresh = async () => {
        await loadNotifications();
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationsContext.Provider
            value={{
                notifications,
                unreadCount,
                isLoading,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                refresh,
            }}
        >
            {children}
        </NotificationsContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationsProvider');
    }
    return context;
};
