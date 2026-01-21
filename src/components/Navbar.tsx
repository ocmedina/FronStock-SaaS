'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

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
            { href: '/dashboard/suppliers', label: 'Proveedores', icon: Factory, description: 'Gestionar proveedores' },
            { href: '/dashboard/purchases', label: 'Compras', icon: PackageOpen, description: 'Órdenes de compra' },
        ],
    },
    {
        title: 'Análisis',
        icon: BarChart3,
        items: [
            { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, description: 'Estadísticas y métricas' },
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
    const { theme, toggleTheme } = useTheme();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <nav className="h-16 border-b backdrop-blur-lg sticky top-0 z-40"
                style={{
                    background: 'var(--background-sidebar)',
                    borderColor: 'rgba(255,255,255,0.1)'
                }}
            >
                <div className="h-full flex items-center px-4 gap-2">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-3 mr-6">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                            style={{ background: 'var(--gradient-primary)' }}
                        >
                            FS
                        </div>
                        <div className="hidden sm:block">
                            <span className="text-white font-bold text-lg">FrontStock</span>
                            {organization && (
                                <p className="text-slate-400 text-xs -mt-0.5">{organization.name}</p>
                            )}
                        </div>
                    </Link>

                    {/* Dashboard Link */}
                    <Link href="/dashboard">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`hidden md:flex text-slate-300 hover:text-white hover:bg-white/10 ${pathname === '/dashboard' ? 'bg-white/10 text-white' : ''
                                }`}
                        >
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Dashboard
                        </Button>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-1">
                        {menuSections.map((section) => {
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
                                            className={`text-slate-300 hover:text-white hover:bg-white/10 ${hasActiveItem ? 'bg-white/10 text-white' : ''
                                                }`}
                                        >
                                            <SectionIcon className="h-4 w-4 mr-1.5" />
                                            {section.title}
                                            <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="w-56"
                                        sideOffset={8}
                                    >
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                            {section.title}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = pathname === item.href ||
                                                (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                            return (
                                                <DropdownMenuItem key={item.href} asChild>
                                                    <Link
                                                        href={item.href}
                                                        className={`flex items-start gap-3 py-2 ${isActive ? 'bg-accent' : ''}`}
                                                    >
                                                        <div className={`p-1.5 rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-medium">{item.label}</p>
                                                            {item.description && (
                                                                <p className="text-xs text-muted-foreground">{item.description}</p>
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
                            size="icon-sm"
                            onClick={toggleTheme}
                            className="text-slate-300 hover:text-white hover:bg-white/10"
                        >
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        {/* Notifications */}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-300 hover:text-white hover:bg-white/10 relative"
                        >
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </Button>

                        {/* User Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="text-slate-300 hover:text-white hover:bg-white/10 gap-2 pl-2 pr-3"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                                        style={{ background: 'var(--gradient-primary)' }}
                                    >
                                        {userInitials}
                                    </div>
                                    <span className="hidden lg:block text-sm max-w-[100px] truncate">
                                        {profile?.full_name?.split(' ')[0] || 'Usuario'}
                                    </span>
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col">
                                        <span>{profile?.full_name || 'Usuario'}</span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {profile?.role === 'admin' ? 'Administrador' : profile?.role}
                                        </span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/settings" className="flex items-center gap-2">
                                        <Settings className="h-4 w-4" />
                                        Configuración
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
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
                            className="md:hidden text-slate-300 hover:text-white"
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
                        className="absolute left-0 right-0 top-0 max-h-[80vh] overflow-y-auto border-b shadow-2xl"
                        style={{
                            background: 'var(--background-sidebar)',
                            borderColor: 'rgba(255,255,255,0.1)'
                        }}
                    >
                        <div className="p-4">
                            {/* Dashboard Link */}
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${pathname === '/dashboard'
                                        ? 'bg-primary text-white'
                                        : 'text-slate-300 hover:bg-white/10'
                                    }`}
                            >
                                <LayoutDashboard className="h-5 w-5" />
                                <span className="font-medium">Dashboard</span>
                            </Link>

                            {/* Sections */}
                            <div className="space-y-4">
                                {menuSections.map((section) => (
                                    <div key={section.title}>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
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
                                                                ? 'bg-primary text-white'
                                                                : 'text-slate-300 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        <Icon className="h-5 w-5" />
                                                        <div>
                                                            <p className="font-medium">{item.label}</p>
                                                            {item.description && (
                                                                <p className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
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
