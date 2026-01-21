'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, createContext, useContext } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    LayoutDashboard,
    ShoppingCart,
    ClipboardList,
    Package,
    ArrowLeftRight,
    Tags,
    Users,
    Factory,
    PackageOpen,
    BarChart3,
    UserCog,
    Shield,
    Settings,
    Sun,
    Moon,
    LogOut,
    ChevronLeft,
    ChevronRight,
    LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface MenuItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

const menuSections: MenuSection[] = [
    {
        title: 'Principal',
        items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Ventas',
        items: [
            { href: '/dashboard/sales', label: 'Punto de Venta', icon: ShoppingCart },
            { href: '/dashboard/sales/history', label: 'Historial Ventas', icon: ClipboardList },
        ],
    },
    {
        title: 'Inventario',
        items: [
            { href: '/dashboard/products', label: 'Productos', icon: Package },
            { href: '/dashboard/stock', label: 'Movimientos', icon: ArrowLeftRight },
            { href: '/dashboard/categories', label: 'Categorías', icon: Tags },
        ],
    },
    {
        title: 'Contactos',
        items: [
            { href: '/dashboard/customers', label: 'Clientes', icon: Users },
            { href: '/dashboard/suppliers', label: 'Proveedores', icon: Factory },
        ],
    },
    {
        title: 'Compras',
        items: [
            { href: '/dashboard/purchases', label: 'Compras', icon: PackageOpen },
        ],
    },
    {
        title: 'Análisis',
        items: [
            { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3 },
        ],
    },
    {
        title: 'Administración',
        items: [
            { href: '/dashboard/users', label: 'Usuarios', icon: UserCog },
            { href: '/dashboard/permissions', label: 'Permisos', icon: Shield },
            { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
        ],
    },
];

// Sidebar Context for sharing collapsed state
const SidebarContext = createContext<{
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}>({
    isCollapsed: false,
    setIsCollapsed: () => { },
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const { organization } = useOrganization();
    const { theme, toggleTheme } = useTheme();
    const { isCollapsed, setIsCollapsed } = useSidebar();

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={`min-h-screen flex flex-col transition-all duration-300 relative ${isCollapsed ? 'w-16' : 'w-64'
                    }`}
                style={{ background: 'var(--background-sidebar)' }}
            >
                {/* Collapse Toggle Button - Positioned on right edge */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors border-2 border-background"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Logo/Brand */}
                <div className={`p-4 border-b border-white/10 ${isCollapsed ? 'px-3' : 'px-5'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                            style={{ background: 'var(--gradient-primary)' }}>
                            FS
                        </div>
                        {!isCollapsed && (
                            <div className="overflow-hidden">
                                <h1 className="text-lg font-bold text-white">FrontStock</h1>
                                {organization && (
                                    <p className="text-xs text-slate-400 truncate max-w-[140px]">{organization.name}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-3 overflow-y-auto">
                    <div className="space-y-3">
                        {menuSections.map((section) => (
                            <div key={section.title}>
                                {/* Section Header */}
                                {!isCollapsed && (
                                    <h3 className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                        {section.title}
                                    </h3>
                                )}
                                {isCollapsed && (
                                    <div className="w-full h-px bg-white/10 my-2" />
                                )}
                                {/* Section Items */}
                                <ul className="space-y-0.5">
                                    {section.items.map((item) => {
                                        const isActive = pathname === item.href ||
                                            (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                        const Icon = item.icon;

                                        const linkContent = (
                                            <Link
                                                href={item.href}
                                                className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${isCollapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2'
                                                    } ${isActive
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                <Icon size={18} className="shrink-0" />
                                                {!isCollapsed && (
                                                    <span className="text-sm font-medium truncate">{item.label}</span>
                                                )}
                                            </Link>
                                        );

                                        if (isCollapsed) {
                                            return (
                                                <li key={item.href}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            {linkContent}
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="font-medium">
                                                            {item.label}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </li>
                                            );
                                        }

                                        return <li key={item.href}>{linkContent}</li>;
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-2 border-t border-white/10 space-y-1">
                    {/* Theme Toggle */}
                    {isCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-center px-3 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                >
                                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            <span className="text-sm font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                        </button>
                    )}

                    <LogoutButton isCollapsed={isCollapsed} />
                </div>
            </aside>
        </TooltipProvider>
    );
}

function LogoutButton({ isCollapsed }: { isCollapsed: boolean }) {
    const { createClient } = require('@/lib/supabase/client');
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                        <LogOut size={18} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    Cerrar Sesión
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
            <LogOut size={18} />
            <span className="text-sm font-medium">Cerrar Sesión</span>
        </button>
    );
}
