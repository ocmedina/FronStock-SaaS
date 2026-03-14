'use client';

import { PLANS, PlanType } from '@/config/plans';
import { PlanCard } from '@/components/settings/PlanCard';
import { updatePlan, devActivatePlan } from '@/actions/plans';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PlansClientWrapperProps {
    currentPlanId: PlanType;
    canManage?: boolean;
    arsPrices?: Partial<Record<PlanType, number>>;
    subscriptionStatus?: string;
    planExpiresAt?: string | null;
    isDev?: boolean;
}

export function PlansClientWrapper({ currentPlanId, canManage = true, arsPrices = {}, subscriptionStatus = 'none', planExpiresAt, isDev = false }: PlansClientWrapperProps) {
    const [isLoading, setIsLoading] = useState<PlanType | null>(null);
    const [isDevActivating, setIsDevActivating] = useState<PlanType | null>(null);
    const [confirmPlanId, setConfirmPlanId] = useState<PlanType | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPlan = PLANS[currentPlanId] || PLANS.free;
    const confirmPlan = confirmPlanId ? PLANS[confirmPlanId] : null;
    const salesWhatsappNumber = process.env.NEXT_PUBLIC_SALES_WHATSAPP_NUMBER || '';

    const formatLimit = (value: number, suffix?: string) => {
        if (value === Infinity) {
            return 'Ilimitado';
        }
        return suffix ? `${value} ${suffix}` : `${value}`;
    };

    const formatPrice = (planId: PlanType) => {
        const plan = PLANS[planId];
        if (plan.price <= 0) {
            return 'Gratis';
        }

        const ars = arsPrices[planId];
        if (ars) {
            return `$${ars.toLocaleString('es-AR')} ARS/mes`;
        }

        return `$${plan.price.toLocaleString('es-AR')}/mes`;
    };

    const buildSalesWhatsappUrl = (planId: PlanType) => {
        const cleaned = salesWhatsappNumber.replace(/\D/g, '');
        if (!cleaned) {
            return null;
        }

        const planName = PLANS[planId]?.name || planId;
        const message = encodeURIComponent(`Hola! Quiero cambiar mi cuenta al plan ${planName} de FrontStock.`);
        return `https://wa.me/${cleaned}?text=${message}`;
    };

    useEffect(() => {
        // Limpia parámetros heredados del flujo de checkout anterior.
        if (!searchParams.get('checkout')) {
            return;
        }

        toast.info('El alta de planes pagos se gestiona por WhatsApp con ventas.');
        router.replace('/dashboard/settings/plans');
    }, [searchParams, router]);

    const handleSelectPlan = async (planId: PlanType) => {
        if (!canManage) {
            toast.error('Solo owner/admin puede cambiar el plan');
            return;
        }

        if (planId === currentPlanId) return;

        if (planId !== 'free') {
            setConfirmPlanId(planId);
            return;
        }

        setIsLoading(planId);
        try {
            if (planId === 'free') {
                const result = await updatePlan(planId);

                if (result.error) {
                    toast.error(result.error);
                } else {
                    toast.success(`Te cambiaste al plan ${PLANS[planId].name}`);
                    router.refresh();
                }

                return;
            }
        } catch (error) {
            toast.error("Ocurrió un error inesperado al cambiar de plan.");
        } finally {
            setIsLoading(null);
        }
    };

    const handleContactSales = async () => {
        if (!confirmPlanId) {
            return;
        }

        setIsLoading(confirmPlanId);
        try {
            const url = buildSalesWhatsappUrl(confirmPlanId);
            if (!url) {
                toast.error('Falta configurar NEXT_PUBLIC_SALES_WHATSAPP_NUMBER para contactar ventas.');
                return;
            }

            window.open(url, '_blank', 'noopener,noreferrer');
            toast.success('Te redirigimos a WhatsApp para coordinar el cambio de plan.');
        } catch (error) {
            toast.error('No se pudo abrir WhatsApp en este momento.');
        } finally {
            setIsLoading(null);
            setConfirmPlanId(null);
        }
    };

    const handleDevActivate = async (planId: PlanType) => {
        setIsDevActivating(planId);
        try {
            const result = await devActivatePlan(planId);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`[DEV] Plan ${planId} activado manualmente.`);
                router.refresh();
            }
        } catch {
            toast.error('Error al activar plan en modo desarrollo.');
        } finally {
            setIsDevActivating(null);
        }
    };

    return (
        <div className="space-y-5">
            <Card className="border-primary/20">
                <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Plan actual</p>
                        <p className="text-xl font-semibold">{currentPlan.name}</p>
                        {subscriptionStatus === 'authorized' && (
                            <p className="text-xs text-green-600 mt-1">
                                Suscripción activa
                                {planExpiresAt && ` — próximo cobro: ${new Date(planExpiresAt).toLocaleDateString('es-AR')}`}
                            </p>
                        )}
                        {subscriptionStatus === 'pending' && (
                            <p className="text-xs text-yellow-600 mt-1">Suscripción pendiente de autorización</p>
                        )}
                        {subscriptionStatus === 'paused' && (
                            <p className="text-xs text-orange-600 mt-1">Suscripción pausada</p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="secondary">Usuarios: {currentPlan.limits.maxUsers === Infinity ? 'Ilimitado' : currentPlan.limits.maxUsers}</Badge>
                        <Badge variant="secondary">Productos: {currentPlan.limits.maxProducts === Infinity ? 'Ilimitado' : currentPlan.limits.maxProducts}</Badge>
                        <Badge variant="secondary">Historial: {currentPlan.limits.salesHistoryMonths === Infinity ? 'Ilimitado' : `${currentPlan.limits.salesHistoryMonths} meses`}</Badge>
                    </div>
                </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
                Los planes pagos se activan por gestión comercial. Selecciona un plan y presiona Contactar con ventas.
            </p>

            {!canManage && (
                <p className="text-sm text-muted-foreground">
                    Tienes acceso de lectura. Solo owner/admin puede cambiar el plan.
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {Object.values(PLANS).map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={{ ...plan, priceArs: arsPrices[plan.id] }}
                        currentPlanId={currentPlanId}
                        onSelect={handleSelectPlan}
                        isLoading={isLoading === plan.id}
                        disabled={!canManage}
                    />
                ))}
            </div>

            <Dialog open={Boolean(confirmPlanId)} onOpenChange={(open) => !open && setConfirmPlanId(null)}>
                <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
                    {confirmPlan && (
                        <>
                            <DialogHeader className="px-6 pt-6 pb-4 border-b">
                                <DialogTitle>Confirmar cambio de plan</DialogTitle>
                                <DialogDescription>
                                    Plan actual: <span className="font-semibold text-foreground">{currentPlan.name}</span> {'->'} Nuevo plan:{' '}
                                    <span className="font-semibold text-foreground">{confirmPlan.name}</span> ({formatPrice(confirmPlan.id)})
                                </DialogDescription>
                                <p className="text-sm text-muted-foreground">
                                    Se abrirá WhatsApp para contactar al equipo de ventas y coordinar la activación del nuevo plan.
                                </p>
                            </DialogHeader>

                            <div className="px-6 py-4">
                                <div className="rounded-md border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-muted-foreground">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium">Límite</th>
                                                <th className="text-left px-4 py-3 font-medium">Actual</th>
                                                <th className="text-left px-4 py-3 font-medium">Nuevo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t">
                                                <td className="px-4 py-3">Usuarios máx.</td>
                                                <td className="px-4 py-3">{formatLimit(currentPlan.limits.maxUsers)}</td>
                                                <td className="px-4 py-3">{formatLimit(confirmPlan.limits.maxUsers)}</td>
                                            </tr>
                                            <tr className="border-t">
                                                <td className="px-4 py-3">Productos máx.</td>
                                                <td className="px-4 py-3">{formatLimit(currentPlan.limits.maxProducts)}</td>
                                                <td className="px-4 py-3">{formatLimit(confirmPlan.limits.maxProducts)}</td>
                                            </tr>
                                            <tr className="border-t">
                                                <td className="px-4 py-3">Historial de ventas</td>
                                                <td className="px-4 py-3">{formatLimit(currentPlan.limits.salesHistoryMonths, 'meses')}</td>
                                                <td className="px-4 py-3">{formatLimit(confirmPlan.limits.salesHistoryMonths, 'meses')}</td>
                                            </tr>
                                            <tr className="border-t">
                                                <td className="px-4 py-3">Precio</td>
                                                <td className="px-4 py-3">{formatPrice(currentPlan.id)}</td>
                                                <td className="px-4 py-3 font-semibold">{formatPrice(confirmPlan.id)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <DialogFooter className="px-6 pb-6 pt-2 border-t">
                                <Button variant="outline" onClick={() => setConfirmPlanId(null)} disabled={isLoading === confirmPlan.id}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleContactSales} disabled={isLoading === confirmPlan.id}>
                                    {isLoading === confirmPlan.id ? 'Procesando...' : 'Contactar con ventas'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {isDev && canManage && (
                <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="pt-6">
                        <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                            Modo Desarrollo — Activar plan manualmente
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(['entrepreneur', 'business', 'enterprise'] as PlanType[]).map((planId) => (
                                <Button
                                    key={planId}
                                    variant="outline"
                                    size="sm"
                                    className="border-yellow-500/50"
                                    disabled={isDevActivating !== null || currentPlanId === planId}
                                    onClick={() => handleDevActivate(planId)}
                                >
                                    {isDevActivating === planId ? 'Activando...' : `Activar ${planId}`}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
