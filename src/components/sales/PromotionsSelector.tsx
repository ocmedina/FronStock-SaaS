'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { calculateApplicablePromotions, applyCoupon, type ApplicablePromotion, type CartItem } from '@/lib/promotions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tag, Percent, TrendingUp, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PromotionsSelectorProps {
    customerId: string | null;
    items: CartItem[];
    subtotal: number;
    currentDiscount: number;
    onApplyPromotion: (discount: number, promotionId?: string) => void;
}

export function PromotionsSelector({
    customerId,
    items,
    subtotal,
    currentDiscount,
    onApplyPromotion,
}: PromotionsSelectorProps) {
    const { organization } = useOrganization();
    const [promotions, setPromotions] = useState<ApplicablePromotion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState<string | null>(null);

    // Cargar promociones aplicables cuando cambia el carrito
    useEffect(() => {
        if (!organization?.id || items.length === 0) {
            setPromotions([]);
            return;
        }

        const loadPromotions = async () => {
            setIsLoading(true);
            const applicable = await calculateApplicablePromotions(
                organization.id,
                customerId,
                items,
                subtotal
            );
            setPromotions(applicable);
            setIsLoading(false);
        };

        loadPromotions();
    }, [organization?.id, customerId, items, subtotal]);

    const handleApplyPromotion = (promo: ApplicablePromotion) => {
        setSelectedPromotion(promo.id);
        onApplyPromotion(promo.discount, promo.id);
        toast.success(`Promoción "${promo.name}" aplicada`, {
            description: `Descuento de $${promo.discount.toFixed(2)}`,
        });
    };

    const handleApplyCoupon = async () => {
        if (!organization?.id || !couponCode.trim()) return;

        setIsApplyingCoupon(true);
        const result = await applyCoupon(organization.id, couponCode, customerId, subtotal);
        setIsApplyingCoupon(false);

        if (result.success && result.promotion) {
            setSelectedPromotion(result.promotion.id);
            onApplyPromotion(result.promotion.discount, result.promotion.id);
            toast.success(`Cupón "${result.promotion.name}" aplicado`, {
                description: `Descuento de $${result.promotion.discount.toFixed(2)}`,
            });
            setCouponCode('');
        } else {
            toast.error(result.error || 'Cupón no válido');
        }
    };

    const handleClearPromotion = () => {
        setSelectedPromotion(null);
        onApplyPromotion(0);
        toast.info('Promoción removida');
    };

    const promotionTypeIcons: Record<string, any> = {
        percentage: Percent,
        fixed_amount: Tag,
        volume: TrendingUp,
        happy_hour: TrendingUp,
        coupon: Tag,
    };

    if (items.length === 0) return null;

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Promociones Disponibles
                </h3>
                {selectedPromotion && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearPromotion}
                        className="h-7 text-xs"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Quitar
                    </Button>
                )}
            </div>

            {/* Coupon Input */}
            <div className="flex gap-2">
                <Input
                    placeholder="Código de cupón"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    className="flex-1 h-9 text-sm"
                />
                <Button
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || isApplyingCoupon}
                    size="sm"
                    className="h-9"
                >
                    {isApplyingCoupon ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        'Aplicar'
                    )}
                </Button>
            </div>

            {/* Promotions List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : promotions.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {promotions.map((promo) => {
                        const Icon = promotionTypeIcons[promo.type] || Tag;
                        const isSelected = selectedPromotion === promo.id;

                        return (
                            <Card
                                key={promo.id}
                                className={cn(
                                    'p-3 cursor-pointer transition-all hover:shadow-md',
                                    isSelected && 'ring-2 ring-primary bg-primary/5'
                                )}
                                onClick={() => handleApplyPromotion(promo)}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="p-1.5 bg-primary/10 rounded">
                                            <Icon className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{promo.name}</p>
                                            {promo.description && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {promo.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="secondary" className="font-bold">
                                            -${promo.discount.toFixed(2)}
                                        </Badge>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-center text-muted-foreground py-3">
                    No hay promociones disponibles para esta compra
                </p>
            )}

            {/* Current Discount Display */}
            {currentDiscount > 0 && (
                <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Descuento aplicado:</span>
                        <span className="font-bold text-emerald-600">
                            -${currentDiscount.toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
