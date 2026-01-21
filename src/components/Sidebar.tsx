'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, createContext, useContext, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createClient } from '@/lib/supabase/client';
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
    User,
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
    const supabase = createClient();
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || 'Usuario');
            }
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={`h-screen sticky top-0 flex flex-col transition-all duration-300 z-40 border-r border-slate-800 ${isCollapsed ? 'w-16' : 'w-64'
                    }`}
                style={{ background: 'var(--background-sidebar)' }}
            >
                {/* Collapse Toggle Button - Positioned on right edge */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute top-8 -right-3 z-50 w-6 h-6 rounded-full bg-slate-800 text-slate-200 shadow-xl flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-700"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Logo/Brand */}
                <div className={`h-16 flex items-center border-b border-white/5 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-emerald-900/20"
                            style={{ background: 'var(--gradient-primary)' }}>
                            FS
                        </div>
                        {!isCollapsed && (
                            <div className="overflow-hidden">
                                <h1 className="text-base font-bold text-white tracking-wide">FrontStock</h1>
                                {organization && (
                                    <p className="text-[10px] text-slate-500 truncate max-w-[140px] uppercase tracking-wider font-medium">{organization.name}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-4 overflow-y-auto no-scrollbar">
                    <div className="space-y-4">
                        {menuSections.map((section) => (
                            <div key={section.title}>
                                {/* Section Header */}
                                {!isCollapsed && (
                                    <h3 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500/80 mb-1">
                                        {section.title}
                                    </h3>
                                )}
                                {isCollapsed && (
                                    <div className="w-full h-px bg-white/5 my-3 mx-auto w-8" />
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
                                                className={`flex items-center gap-3 rounded-lg transition-all duration-200 group relative ${isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
                                                    } ${isActive
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <Icon size={18} className={`shrink-0 transition-colors ${isActive ? 'text-emerald-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                                {!isCollapsed && (
                                                    <span className="text-sm font-medium truncate">{item.label}</span>
                                                )}
                                                {isActive && !isCollapsed && (
                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-l-full" />
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
                                                        <TooltipContent side="right" className="font-medium bg-slate-900 border-slate-700 text-slate-200">
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

                {/* Footer / User Profile */}
                <div className="p-3 border-t border-white/5 bg-slate-950/30">
                    <div className={`flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>

                        {/* User Info (Expanded) */}
                        {!isCollapsed && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/50 border border-slate-800/50 mb-1">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-emerald-500 font-bold text-xs">
                                    {userEmail?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-200 truncate">
                                        {userEmail}
                                    </p>
                                    <p className="text-[10px] text-slate-500">Conectado</p>
                                </div>
                            </div>
                        )}

                        <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                            {/* Theme Toggle */}
                            {isCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={toggleTheme}
                                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
                                        >
                                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-slate-900 border-slate-700">
                                        {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={toggleTheme}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-800"
                                >
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                    <span>Tema</span>
                                </button>
                            )}

                            {/* Logout Button */}
                            {isCollapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={handleLogout}
                                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <LogOut size={18} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-slate-900 border-slate-700 text-red-400">
                                        Cerrar Sesión
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                                >
                                    <LogOut size={16} />
                                    <span>Salir</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    );
}
