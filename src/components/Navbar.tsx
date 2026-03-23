import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { roleLabels, type Role } from '@/lib/permissions';
import { resolveDashboardModuleFromPath } from '@/lib/route-permissions';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    Menu,
    ChevronDown,
    LucideIcon,
    X,
    Bell,
    Search,
    FileText,
    Truck,
    MapPin,
    Building2,
    CreditCard,
} from 'lucide-react';

interface MenuItem {
    href: string;
    label: string;
    icon: LucideIcon;
    description?: string;
}

interface MenuSection {
    title: string;
    icon: LucideIcon;
    items: MenuItem[];
}

const menuSections: MenuSection[] = [
    {
        title: 'Ventas',
        icon: ShoppingCart,
        items: [
            { href: '/dashboard/sales', label: 'Punto de Venta', icon: ShoppingCart, description: 'Registrar ventas' },
            { href: '/dashboard/sales/history', label: 'Historial', icon: ClipboardList, description: 'Ver ventas realizadas' },
            { href: '/dashboard/invoices', label: 'Facturación', icon: FileText, description: 'Facturas y comprobantes' },
            { href: '/dashboard/promotions', label: 'Promociones', icon: Tags, description: 'Descuentos y campañas' },
        ],
    },
    {
        title: 'Logística',
        icon: Truck,
        items: [
            { href: '/dashboard/orders', label: 'Pedidos', icon: Truck, description: 'Delivery y encargos' },
            { href: '/dashboard/delivery/customers', label: 'Clientes', icon: Building2, description: 'Clientes de reparto' },
            { href: '/dashboard/delivery/routes', label: 'Rutas', icon: MapPin, description: 'Planificación de recorridos' },
            { href: '/dashboard/delivery/shifts', label: 'Cajas / Recorridos', icon: ClipboardList, description: 'Cierres y turnos' },
        ],
    },
    {
        title: 'Inventario',
        icon: Package,
        items: [
            { href: '/dashboard/products', label: 'Productos', icon: Package, description: 'Gestionar catálogo' },
            { href: '/dashboard/stock', label: 'Movimientos', icon: ArrowLeftRight, description: 'Entradas y salidas' },
            { href: '/dashboard/categories', label: 'Categorías', icon: Tags, description: 'Organizar productos' },
        ],
    },
    {
        title: 'Contactos',
        icon: Users,
        items: [
            { href: '/dashboard/customers', label: 'Clientes', icon: Users, description: 'Base de clientes' },
            { href: '/dashboard/customers/debtors', label: 'Deudores', icon: CreditCard, description: 'Clientes con saldo' },
        ],
    },
    {
        title: 'Compras',
        icon: PackageOpen,
        items: [
            { href: '/dashboard/purchases', label: 'Compras', icon: PackageOpen, description: 'Órdenes de compra' },
            { href: '/dashboard/suppliers', label: 'Proveedores', icon: Factory, description: 'Gestionar proveedores' },
        ],
    },
    {
        title: 'Análisis',
        icon: BarChart3,
        items: [
            { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, description: 'Estadísticas y métricas' },
            { href: '/dashboard/cash-closing', label: 'Cierre de Caja', icon: CreditCard, description: 'Resumen diario local + reparto' },
        ],
    },
    {
        title: 'Admin',
        icon: Settings,
        items: [
            { href: '/dashboard/users', label: 'Usuarios', icon: UserCog, description: 'Gestionar equipo' },
            { href: '/dashboard/permissions', label: 'Permisos', icon: Shield, description: 'Roles y accesos' },
            { href: '/dashboard/settings', label: 'Configuración', icon: Settings, description: 'Preferencias' },
        ],
    },
];

export function Navbar() {
    const pathname = usePathname();
    const { organization, profile } = useOrganization();
    const { resolvedTheme, toggleTheme } = useTheme();
    const { canView } = usePermissions();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const visibleMenuSections = menuSections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
                const requiredModule = resolveDashboardModuleFromPath(item.href);
                return !requiredModule || canView(requiredModule);
            }),
        }))
        .filter((section) => section.items.length > 0);

    const handleLogout = async () => {
        const { createClient } = require('@/lib/supabase/client');
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const userInitials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    return (
        <>
            <nav className="h-16 border-b border-white/5 backdrop-blur-lg sticky top-0 z-40 bg-sidebar/95 supports-[backdrop-filter]:bg-sidebar/60">
                <div className="h-full flex items-center px-4 gap-2">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-3 mr-6">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shadow-lg bg-sidebar-primary"
                        >
                            FS
                        </div>
                        <div className="hidden sm:block">
                            <span className="text-sidebar-foreground font-bold text-lg">FrontStock</span>
                            {organization && (
                                <p className="text-sidebar-foreground/60 text-xs -mt-0.5">{organization.name}</p>
                            )}
                        </div>
                    </Link>

                    {/* Dashboard Link */}
                    <Link href="/dashboard">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`hidden md:flex text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent ${pathname === '/dashboard' ? 'bg-sidebar-accent text-sidebar-foreground' : ''
                                }`}
                        >
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Dashboard
                        </Button>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-1">
                        {visibleMenuSections.map((section) => {
                            const SectionIcon = section.icon;
                            const hasActiveItem = section.items.some(
                                item => pathname === item.href ||
                                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                            );

                            return (
                                <DropdownMenu key={section.title}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent ${hasActiveItem ? 'bg-sidebar-accent text-sidebar-foreground' : ''
                                                }`}
                                        >
                                            <SectionIcon className="h-4 w-4 mr-1.5" />
                                            {section.title}
                                            <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="w-56 bg-sidebar border-sidebar-border text-sidebar-foreground"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-xs text-sidebar-foreground/50">
                                            {section.title}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-sidebar-border" />
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = pathname === item.href ||
                                                (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                            return (
                                                <DropdownMenuItem key={item.href} asChild className="focus:bg-sidebar-accent focus:text-sidebar-foreground">
                                                    <Link
                                                        href={item.href}
                                                        className={`flex items-start gap-3 py-2 ${isActive ? 'bg-sidebar-accent/50' : ''}`}
                                                    >
                                                        <div className={`p-1.5 rounded-md ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/70'}`}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-medium">{item.label}</p>
                                                            {item.description && (
                                                                <p className="text-xs text-sidebar-foreground/60">{item.description}</p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Right side actions */}
                    <div className="flex items-center gap-1">
                        {/* Theme Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-9 w-9"
                        >
                            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        {/* User Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-2 pl-2 pr-3"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-primary-foreground text-sm font-semibold bg-sidebar-primary"
                                    >
                                        {userInitials}
                                    </div>
                                    <span className="hidden lg:block text-sm max-w-[100px] truncate">
                                        {profile?.full_name?.split(' ')[0] || 'Usuario'}
                                    </span>
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-sidebar border-sidebar-border text-sidebar-foreground">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col">
                                        <span>{profile?.full_name || 'Usuario'}</span>
                                        <span className="text-xs font-normal text-sidebar-foreground/60">
                                            {profile?.role ? roleLabels[profile.role as Role] || profile.role : 'Usuario'}
                                        </span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-sidebar-border" />
                                <DropdownMenuItem asChild className="focus:bg-sidebar-accent focus:text-sidebar-foreground">
                                    <Link href="/dashboard/settings" className="flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Configuración
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-sidebar-border" />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Cerrar Sesión
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Panel */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-30 md:hidden"
                    style={{ top: '64px' }}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Menu */}
                    <div
                        className="absolute left-0 right-0 top-0 max-h-[80vh] overflow-y-auto border-b shadow-2xl bg-sidebar border-sidebar-border"
                    >
                        <div className="p-4">
                            {/* Dashboard Link */}
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${pathname === '/dashboard'
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
                                    }`}
                            >
                                <LayoutDashboard className="h-5 w-5" />
                                <span className="font-medium">Dashboard</span>
                            </Link>

                            {/* Sections */}
                            <div className="space-y-4">
                                {visibleMenuSections.map((section) => (
                                    <div key={section.title}>
                                        <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-4 mb-2">
                                            {section.title}
                                        </p>
                                        <div className="space-y-1">
                                            {section.items.map((item) => {
                                                const Icon = item.icon;
                                                const isActive = pathname === item.href ||
                                                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive
                                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
                                                            }`}
                                                    >
                                                        <Icon className="h-5 w-5" />
                                                        <div>
                                                            <p className="font-medium">{item.label}</p>
                                                            {item.description && (
                                                                <p className={`text-xs ${isActive ? 'text-sidebar-primary-foreground/70' : 'text-sidebar-foreground/50'}`}>
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
