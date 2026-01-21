import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { DashboardShell } from '@/components/DashboardShell';

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
            <DashboardShell>
                {/* Page content */}
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </DashboardShell>
        </OrganizationProvider>
    );
}
