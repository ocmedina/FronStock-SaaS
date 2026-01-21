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
                {/* Top Header */}
                <header
                    className="h-16 flex items-center justify-between px-6 border-b shrink-0"
                    style={{
                        background: 'var(--background-card)',
                        borderColor: 'var(--border)'
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-lg">👋</span>
                        <span style={{ color: 'var(--foreground-secondary)' }}>
                            Bienvenido
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                            {user.email}
                        </span>
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-lg"
                            style={{ background: 'var(--gradient-primary)' }}
                        >
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </DashboardShell>
        </OrganizationProvider>
    );
}
