'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { SidebarProvider, Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { MobileNav } from '@/components/MobileNav';
import { LayoutProvider, useLayout } from '@/contexts/LayoutContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/Protected';
import { resolveDashboardModuleFromPath } from '@/lib/route-permissions';
import { MODULES } from '@/lib/permissions';

function MobileHeader() {
    const { organization } = useOrganization();

    return (
        <header className="md:hidden sticky top-0 z-30 h-16 flex items-center justify-between px-4 border-b border-sidebar-border/70 bg-sidebar/95 backdrop-blur-sm supports-[backdrop-filter]:bg-sidebar/80">
            <div className="flex items-center gap-3">
                {/* MobileMenuButton removed - moved to BottomNav */}
                <div className="flex items-center gap-2">
                    <Image
                        src="/logo.png"
                        alt="FrontStock"
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 object-contain"
                        priority
                    />
                    <div>
                        <h1 className="text-sm font-bold text-sidebar-foreground leading-none">FrontStock</h1>
                        {organization && (
                            <p className="text-[9px] text-sidebar-foreground/60 truncate max-w-[120px] uppercase tracking-wide">{organization.name}</p>
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
    const pathname = usePathname();
    const { canView } = usePermissions();
    const { isLoading, profile } = useOrganization();

    if (isLoading || !profile || !profile.role) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    const requiredModule = resolveDashboardModuleFromPath(pathname || '');
    const hasAccess = !requiredModule || canView(requiredModule);
    const isDashboardRoot = pathname === '/dashboard';
    const hasAnySectionAccess = MODULES.some((module) => module !== 'dashboard' && canView(module));
    const shouldAllow = hasAccess || (isDashboardRoot && hasAnySectionAccess);

    if (!shouldAllow) {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
                <div className="flex-1 flex flex-col min-w-0">
                    <AccessDenied message="No tienes permiso para acceder a esta sección" />
                </div>
            </div>
        );
    }

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
