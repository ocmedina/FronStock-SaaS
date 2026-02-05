'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getAllPromotions, formatPromotionType, formatPromotionDiscount, type Promotion } from '@/lib/promotions';
import { PromotionFormModal } from '@/components/promotions/PromotionFormModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Percent, Tag, Clock, Gift, TrendingUp, Calendar, Users, Loader2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function PromotionsPage() {
    const { organization } = useOrganization();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

    const loadPromotions = async () => {
        if (!organization?.id) return;
        setIsLoading(true);
        const data = await getAllPromotions(organization.id);
        setPromotions(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadPromotions();
    }, [organization?.id]);

    const promotionTypeIcons: Record<Promotion['type'], any> = {
        percentage: Percent,
        fixed_amount: Tag,
        volume: TrendingUp,
        combo: Gift,
        happy_hour: Clock,
        coupon: Tag,
    };

    const promotionTypeColors: Record<Promotion['type'], string> = {
        percentage: 'text-blue-500 bg-blue-500/10',
        fixed_amount: 'text-emerald-500 bg-emerald-500/10',
        volume: 'text-purple-500 bg-purple-500/10',
        combo: 'text-orange-500 bg-orange-500/10',
        happy_hour: 'text-pink-500 bg-pink-500/10',
        coupon: 'text-cyan-500 bg-cyan-500/10',
    };

    const activePromotions = promotions.filter(p => p.active);
    const inactivePromotions = promotions.filter(p => !p.active);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Promociones y Descuentos</h1>
                    <p className="text-muted-foreground mt-1">Gestiona ofertas y promociones especiales</p>
                </div>
                <Button onClick={() => {
                    setSelectedPromotion(null);
                    setIsModalOpen(true);
                }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Promoción
                </Button>
            </div>

            {/* Modal */}
            <PromotionFormModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                promotion={selectedPromotion}
                onSuccess={loadPromotions}
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Promociones</p>
                                <p className="text-2xl font-bold mt-1">{promotions.length}</p>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-lg">
                                <Gift className="h-6 w-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Activas</p>
                                <p className="text-2xl font-bold mt-1 text-emerald-600">{activePromotions.length}</p>
                            </div>
                            <div className="p-3 bg-emerald-500/10 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Inactivas</p>
                                <p className="text-2xl font-bold mt-1 text-muted-foreground">{inactivePromotions.length}</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                                <Calendar className="h-6 w-6 text-muted-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Cupones</p>
                                <p className="text-2xl font-bold mt-1">{promotions.filter(p => p.type === 'coupon').length}</p>
                            </div>
                            <div className="p-3 bg-cyan-500/10 rounded-lg">
                                <Tag className="h-6 w-6 text-cyan-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Promotions List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : promotions.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
                            <Gift className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No hay promociones</h3>
                        <p className="text-muted-foreground mb-6">
                            Crea tu primera promoción para aumentar tus ventas
                        </p>
                        <Button onClick={() => {
                            setSelectedPromotion(null);
                            setIsModalOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Crear Promoción
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Active Promotions */}
                    {activePromotions.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                                Promociones Activas
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activePromotions.map((promo) => {
                                    const Icon = promotionTypeIcons[promo.type];
                                    const colorClass = promotionTypeColors[promo.type];

                                    return (
                                        <Card key={promo.id} className="hover:shadow-lg transition-shadow">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                                                            <Icon className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <CardTitle className="text-base truncate">{promo.name}</CardTitle>
                                                            <Badge variant="secondary" className="mt-1">
                                                                {formatPromotionType(promo.type)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Badge variant="default" className="shrink-0">
                                                        Activa
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {promo.description && (
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        {promo.description}
                                                    </p>
                                                )}

                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Descuento:</span>
                                                        <span className="font-bold text-primary">
                                                            {formatPromotionDiscount(promo)}
                                                        </span>
                                                    </div>

                                                    {promo.coupon_code && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">Código:</span>
                                                            <code className="font-mono font-bold bg-muted px-2 py-0.5 rounded">
                                                                {promo.coupon_code}
                                                            </code>
                                                        </div>
                                                    )}

                                                    {promo.max_uses && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">Usos:</span>
                                                            <span className="font-medium">
                                                                {promo.current_uses} / {promo.max_uses}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {(promo.start_date || promo.end_date) && (
                                                        <div className="pt-2 border-t">
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Calendar className="h-3 w-3" />
                                                                {promo.start_date && new Date(promo.start_date).toLocaleDateString('es-AR')}
                                                                {promo.start_date && promo.end_date && ' - '}
                                                                {promo.end_date ? new Date(promo.end_date).toLocaleDateString('es-AR') : 'Sin límite'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Inactive Promotions */}
                    {inactivePromotions.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-5 w-5" />
                                Promociones Inactivas
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inactivePromotions.map((promo) => {
                                    const Icon = promotionTypeIcons[promo.type];

                                    return (
                                        <Card key={promo.id} className="opacity-60">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted rounded-lg">
                                                            <Icon className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-base">{promo.name}</CardTitle>
                                                            <Badge variant="secondary" className="mt-1">
                                                                {formatPromotionType(promo.type)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary">Inactiva</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatPromotionDiscount(promo)}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
