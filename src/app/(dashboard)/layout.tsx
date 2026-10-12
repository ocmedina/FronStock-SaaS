import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { DashboardShell } from '@/components/DashboardShell';
import { OfflineStatusBanner } from '@/components/OfflineStatusBanner';
import { CashSessionStartupPrompt } from '@/components/cash/CashSessionStartupPrompt';
import { requireDeveloperAccess } from '@/lib/developer-access';

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
    const developerAccess = await requireDeveloperAccess();

    return (
        <OrganizationProvider>
            <NotificationsProvider>
                <DashboardShell isDeveloper={developerAccess.allowed}>
                    <CashSessionStartupPrompt />

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
