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
            <div className="delivery-theme min-h-screen bg-background text-foreground flex flex-col">
                <main className="flex-1 overflow-y-auto pb-24">
                    {children}
                </main>
                <DeliveryBottomNav />
                <Toaster position="top-center" theme="system" />
            </div>
        </OrganizationProvider>
    );
}
