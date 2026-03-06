
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plan, PlanType } from '@/config/plans';
import { Check, Loader2 } from 'lucide-react';

interface PlanCardProps {
    plan: Plan;
    currentPlanId?: string;
    onSelect?: (planId: PlanType) => Promise<void>;
    isLoading?: boolean;
    disabled?: boolean;
}

export function PlanCard({ plan, currentPlanId, onSelect, isLoading, disabled = false }: PlanCardProps) {
    const isCurrent = currentPlanId === plan.id;
    const isFree = plan.price === 0;

    return (
        <Card className={`flex flex-col relative ${isCurrent ? 'border-primary ring-1 ring-primary' : ''} ${plan.recommended ? 'shadow-lg border-primary/50' : ''}`}>
            {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    Recomendado
                </div>
            )}
            <CardHeader>
                <CardTitle className="flex justify-between items-start gap-2">
                    <span>{plan.name}</span>
                    {isCurrent && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Actual</span>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                        {isFree && plan.id !== 'enterprise'
                            ? 'Gratis'
                            : plan.priceArs
                                ? `$${plan.priceArs.toLocaleString('es-AR')}`
                                : `$${plan.price}`}
                    </span>
                    {(plan.price > 0 || plan.priceArs) && (
                        <span className="text-muted-foreground">
                            {plan.priceArs ? 'ARS/mes' : '/mes'}
                        </span>
                    )}
                </div>

                <div className="space-y-2 text-sm">
                    {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : (plan.recommended ? "default" : "secondary")}
                    disabled={isCurrent || isLoading || disabled}
                    onClick={() => onSelect && onSelect(plan.id)}
                >
                    {isLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Procesando...</>
                    ) : isCurrent ? (
                        "Plan Actual"
                    ) : disabled ? (
                        "Sin permisos"
                    ) : (
                        "Elegir Plan"
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
