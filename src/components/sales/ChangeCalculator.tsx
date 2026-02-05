'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { DollarSign, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangeCalculatorProps {
    total: number;
    onAmountChange?: (amount: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

const BILLS = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export function ChangeCalculator({ total, onAmountChange }: ChangeCalculatorProps) {
    const [received, setReceived] = useState<string>('');
    const change = received ? parseFloat(received) - total : 0;

    useEffect(() => {
        if (onAmountChange && received) {
            onAmountChange(parseFloat(received) || 0);
        }
    }, [received, onAmountChange]);

    const handleQuickAmount = (amount: number) => {
        setReceived(amount.toString());
    };

    const handleExact = () => {
        setReceived(total.toString());
    };

    const calculateBillBreakdown = (amount: number) => {
        const breakdown: { bill: number; count: number }[] = [];
        let remaining = amount;

        for (const bill of BILLS) {
            if (remaining >= bill) {
                const count = Math.floor(remaining / bill);
                breakdown.push({ bill, count });
                remaining -= bill * count;
            }
        }

        return breakdown;
    };

    const billBreakdown = change > 0 ? calculateBillBreakdown(change) : [];

    return (
        <div className="space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
                <Label htmlFor="received">Efectivo Recibido</Label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="received"
                        type="number"
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                        className="pl-9 text-lg font-medium"
                        placeholder="0.00"
                        autoFocus
                    />
                </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleExact}
                    className="h-12"
                >
                    Exacto
                </Button>
                {QUICK_AMOUNTS.slice(0, 5).map((amount) => (
                    <Button
                        key={amount}
                        type="button"
                        variant="outline"
                        onClick={() => handleQuickAmount(amount)}
                        className="h-12"
                    >
                        ${amount.toLocaleString()}
                    </Button>
                ))}
            </div>

            {/* Change Display */}
            {received && (
                <Card className={cn(
                    'p-4',
                    change >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'
                )}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Cambio:</span>
                        <span className={cn(
                            'text-2xl font-bold',
                            change >= 0 ? 'text-emerald-600' : 'text-destructive'
                        )}>
                            ${Math.abs(change).toLocaleString('es-AR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                    </div>

                    {change < 0 && (
                        <p className="text-xs text-destructive">
                            ⚠️ Falta: ${Math.abs(change).toLocaleString('es-AR')}
                        </p>
                    )}

                    {/* Bill Breakdown */}
                    {change > 0 && billBreakdown.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Calculator className="h-3 w-3" />
                                Sugerencia de billetes:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {billBreakdown.map(({ bill, count }) => (
                                    <span
                                        key={bill}
                                        className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                    >
                                        {count}x ${bill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Summary */}
            <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">
                        ${total.toLocaleString('es-AR')}
                    </span>
                </div>
                {received && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Recibido:</span>
                        <span className="font-medium">
                            ${parseFloat(received).toLocaleString('es-AR')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
