'use client';

import { SidebarProvider, Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { LayoutProvider, useLayout } from '@/contexts/LayoutContext';

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
    return (
        <SidebarProvider>
            <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    {children}
                </div>
            </div>
        </SidebarProvider>
    );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <LayoutProvider>
            <DashboardContent>{children}</DashboardContent>
        </LayoutProvider>
    );
}
