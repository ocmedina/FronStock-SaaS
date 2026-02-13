import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { DashboardShell } from '@/components/DashboardShell';
import { OfflineStatusBanner } from '@/components/OfflineStatusBanner';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    // Verificar sesión del lado del servidor
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <OrganizationProvider>
            <NotificationsProvider>
                <DashboardShell>
                    {/* Offline/Sync Status Banner */}
                    <OfflineStatusBanner />
                    
                    {/* Page content */}
                    <main className="flex-1 p-3 md:p-6 overflow-auto">
                        {children}
                    </main>
                </DashboardShell>
            </NotificationsProvider>
        </OrganizationProvider>
    );
}

