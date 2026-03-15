'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Truck, Package, Menu } from 'lucide-react';
import { useSidebar } from '@/components/Sidebar';
import { usePermissions } from '@/hooks/usePermissions';
import { resolveDashboardModuleFromPath } from '@/lib/route-permissions';

export function MobileNav() {
    const pathname = usePathname();
    const { setIsMobileOpen } = useSidebar();
    const { canView } = usePermissions();

    const navItems = [
        {
            href: '/dashboard',
            label: 'Inicio',
            icon: LayoutDashboard,
            exact: true
        },
        {
            href: '/dashboard/orders',
            label: 'Pedidos',
            icon: Truck
        },
        {
            href: '/dashboard/sales',
            label: 'Vender',
            icon: ShoppingCart
        },
        {
            href: '/dashboard/stock',
            label: 'Stock',
            icon: Package
        },
    ];

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    };

    const visibleNavItems = navItems.filter((item) => {
        const requiredModule = resolveDashboardModuleFromPath(item.href);
        return !requiredModule || canView(requiredModule);
    });

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar/95 backdrop-blur-lg border-t border-sidebar-border pb-safe supports-[backdrop-filter]:bg-sidebar/80">
            <div className="flex justify-around items-center h-16">
                {visibleNavItems.map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                                }`}
                        >
                            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}

                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="flex flex-col items-center justify-center w-full h-full space-y-1 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                >
                    <Menu size={20} />
                    <span className="text-[10px] font-medium">Menú</span>
                </button>
            </div>
        </div>
    );
}
