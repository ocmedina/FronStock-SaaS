import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { Toaster } from 'sonner';
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav';

export const metadata = {
    title: 'FrontStock Reparto',
    description: 'Modo Reparto y Preventa',
};

export default async function DeliveryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <OrganizationProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
                <main className="flex-1 overflow-y-auto pb-24">
                    {children}
                </main>
                <DeliveryBottomNav />
                <Toaster position="top-center" theme="dark" />
            </div>
        </OrganizationProvider>
    );
}
