"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, User, Clock, Plus, Truck, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export function DeliveryBottomNav() {
    const pathname = usePathname();
    const { resolvedTheme, toggleTheme } = useTheme();
    const hideDock = pathname?.endsWith("/order");

    const nextThemeLabel = resolvedTheme === "dark" ? "modo claro" : "modo oscuro";

    return (
        <>
            {!hideDock && (
                <>
                    {/* The Floating Dock */}
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[96%] max-w-sm">
                        <div className="relative flex h-16 items-center justify-between rounded-3xl border border-cyan-400/20 bg-slate-900/80 px-4 shadow-[0_18px_45px_rgba(14,116,144,0.28)] backdrop-blur-xl">
                            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

                            {/* Left Items */}
                            <div className="flex w-[40%] justify-between h-full items-center">
                                <NavItem href="/delivery" icon={Package} label="Ruta" isActive={pathname === "/delivery"} />
                                <NavItem href="/delivery/debtors" icon={User} label="Deudores" isActive={pathname === "/delivery/debtors"} />
                            </div>

                            {/* Right Items */}
                            <div className="flex w-[40%] justify-between h-full items-center">
                                <NavItem href="/delivery/orders" icon={Truck} label="Operacion" isActive={pathname === "/delivery/orders"} />
                                <NavItem href="/delivery/history" icon={Clock} label="Historial" isActive={pathname === "/delivery/history"} />
                            </div>
                        </div>
                    </div>

                    {/* Keep FAB visible across delivery screens, but below dialogs/overlays. */}
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 mb-8">
                        <Link 
                            href="/delivery/order" 
                            className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-slate-950 bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/35 transition-transform duration-200 hover:bg-amber-300 active:scale-95"
                        >
                            <Plus className="h-7 w-7 stroke-[3px]" />
                        </Link>
                    </div>
                </>
            )}

            <button
                type="button"
                onClick={toggleTheme}
                title={`Cambiar a ${nextThemeLabel}`}
                aria-label={`Cambiar a ${nextThemeLabel}`}
                className="fixed bottom-24 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
            >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
        </>
    );
}

function NavItem({ href, icon: Icon, label, isActive }: { href: string, icon: any, label: string, isActive: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[50px]",
                isActive 
                    ? "text-foreground" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
            )}
        >
            {isActive && (
                <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 transition-opacity" />
            )}
            <Icon 
                className={cn(
                    "h-6 w-6 z-10 transition-all duration-300",
                    isActive && "scale-110 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]"
                )}
            />
            <span className={cn(
                "text-[10px] font-semibold mt-1 z-10 transition-all",
                isActive ? "text-cyan-700 dark:text-cyan-100" : "text-transparent h-0 overflow-hidden"
            )}>
                {isActive && label}
            </span>
        </Link>
    );
}
