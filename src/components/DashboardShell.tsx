'use client';

import { SidebarProvider, Sidebar, MobileMenuButton, useSidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { MobileNav } from '@/components/MobileNav';
import { LayoutProvider, useLayout } from '@/contexts/LayoutContext';
import { useOrganization } from '@/contexts/OrganizationContext';

function MobileHeader() {
    const { organization } = useOrganization();

    return (
        <header className="md:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                {/* MobileMenuButton removed - moved to BottomNav */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ background: 'var(--gradient-primary)' }}>
                        FS
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white leading-none">FrontStock</h1>
                        {organization && (
                            <p className="text-[9px] text-slate-500 truncate max-w-[120px] uppercase tracking-wide">{organization.name}</p>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

function SidebarLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <div className="min-h-screen flex flex-col md:flex-row pb-16 md:pb-0" style={{ background: 'var(--background)' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <MobileHeader />
                    {children}
                </div>
                <MobileNav />
            </div>
        </SidebarProvider>
    );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { layoutMode } = useLayout();

    if (layoutMode === 'navbar') {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
                <Navbar />
                <div className="flex-1 flex flex-col min-w-0">
                    {children}
                </div>
            </div>
        );
    }

    // Default: sidebar layout
    return <SidebarLayoutContent>{children}</SidebarLayoutContent>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <LayoutProvider>
            <DashboardContent>{children}</DashboardContent>
        </LayoutProvider>
    );
}
