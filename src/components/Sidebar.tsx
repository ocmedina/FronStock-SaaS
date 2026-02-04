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
    Menu,
    X,
    FileText,
    CreditCard,
    Truck,
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
            { href: '/dashboard/orders', label: 'Pedidos', icon: Truck },
            { href: '/dashboard/sales/history', label: 'Historial Ventas', icon: ClipboardList },
            { href: '/dashboard/invoices', label: 'Facturación', icon: FileText },
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
            { href: '/dashboard/customers/debtors', label: 'Deudores', icon: CreditCard },
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
    {
        title: 'Logística',
        items: [
            { href: '/dashboard/delivery/shifts', label: 'Cajas / Recorridos', icon: ClipboardList },
        ],
    },
];

// Sidebar Context for sharing collapsed state and mobile open state
const SidebarContext = createContext<{
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
}>({
    isCollapsed: false,
    setIsCollapsed: () => { },
    isMobileOpen: false,
    setIsMobileOpen: () => { },
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

// Mobile Menu Button - to be used in header
export function MobileMenuButton() {
    const { setIsMobileOpen } = useSidebar();

    return (
        <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileOpen(true)}
        >
            <Menu className="h-5 w-5" />
        </Button>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const { organization } = useOrganization();
    const { theme, toggleTheme } = useTheme();
    const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();
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

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname, setIsMobileOpen]);

    // Close mobile sidebar on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsMobileOpen(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [setIsMobileOpen]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileOpen]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const sidebarContent = (
        <>
            {/* Logo/Brand */}
            <div className={`h-16 flex items-center border-b border-sidebar-border ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-5'}`}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg shrink-0 shadow-lg shadow-sidebar-primary/20 bg-sidebar-primary">
                        FS
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                        <div className="overflow-hidden">
                            <h1 className="text-base font-bold text-sidebar-foreground tracking-wide">FrontStock</h1>
                            {organization && (
                                <p className="text-[10px] text-sidebar-foreground/60 truncate max-w-[140px] uppercase tracking-wider font-medium">{organization.name}</p>
                            )}
                        </div>
                    )}
                </div>
                {/* Close button for mobile */}
                {isMobileOpen && (
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="ml-auto p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-lg hover:bg-sidebar-accent transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 overflow-y-auto no-scrollbar">
                <div className="space-y-4">
                    {menuSections.map((section) => (
                        <div key={section.title}>
                            {/* Section Header */}
                            {(!isCollapsed || isMobileOpen) && (
                                <h3 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-1">
                                    {section.title}
                                </h3>
                            )}
                            {isCollapsed && !isMobileOpen && (
                                <div className="w-full h-px bg-sidebar-border my-3 mx-auto w-8" />
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
                                            className={`flex items-center gap-3 rounded-lg transition-all duration-200 group relative ${isCollapsed && !isMobileOpen ? 'p-2.5 justify-center' : 'px-3 py-2'
                                                } ${isActive
                                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                                                }`}
                                        >
                                            <Icon size={18} className={`shrink-0 transition-colors ${isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'}`} />
                                            {(!isCollapsed || isMobileOpen) && (
                                                <span className="text-sm font-medium truncate">{item.label}</span>
                                            )}
                                            {isActive && (!isCollapsed || isMobileOpen) && (
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-l-full" />
                                            )}
                                        </Link>
                                    );

                                    if (isCollapsed && !isMobileOpen) {
                                        return (
                                            <li key={item.href}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        {linkContent}
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="font-medium bg-sidebar text-sidebar-foreground border-sidebar-border">
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
            <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/5">
                <div className={`flex flex-col gap-2 ${isCollapsed && !isMobileOpen ? 'items-center' : ''}`}>

                    {/* User Info (Expanded) */}
                    {(!isCollapsed || isMobileOpen) && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border mb-1">
                            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center border border-sidebar-border text-sidebar-primary font-bold text-xs">
                                {userEmail?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-sidebar-foreground truncate">
                                    {userEmail}
                                </p>
                                <p className="text-[10px] text-sidebar-foreground/60">Conectado</p>
                            </div>
                        </div>
                    )}

                    <div className={`flex items-center gap-2 ${isCollapsed && !isMobileOpen ? 'flex-col' : ''}`}>
                        {/* Theme Toggle */}
                        {isCollapsed && !isMobileOpen ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={toggleTheme}
                                        className="w-10 h-10 flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all"
                                    >
                                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-sidebar-accent text-sidebar-foreground border-sidebar-border">
                                    {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <button
                                onClick={toggleTheme}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all border border-transparent hover:border-sidebar-border"
                            >
                                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                <span>Tema</span>
                            </button>
                        )}

                        {/* Logout Button */}
                        {isCollapsed && !isMobileOpen ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleLogout}
                                        className="w-10 h-10 flex items-center justify-center text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                    >
                                        <LogOut size={18} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-sidebar-accent text-destructive border-sidebar-border">
                                    Cerrar Sesión
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <button
                                onClick={handleLogout}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all border border-transparent hover:border-destructive/20"
                            >
                                <LogOut size={16} />
                                <span>Salir</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <TooltipProvider delayDuration={0}>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar (Drawer) */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-in-out md:hidden bg-sidebar
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {sidebarContent}
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`hidden md:flex h-screen sticky top-0 flex-col transition-all duration-300 z-40 border-r border-sidebar-border bg-sidebar ${isCollapsed ? 'w-16' : 'w-64'
                    }`}
            >
                {/* Collapse Toggle Button - Positioned on right edge */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute top-8 -right-3 z-50 w-6 h-6 rounded-full bg-sidebar-accent text-sidebar-foreground shadow-xl flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors border border-sidebar-border"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {sidebarContent}
            </aside>
        </TooltipProvider>
    );
}
