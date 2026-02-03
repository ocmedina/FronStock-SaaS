"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useOrganization } from "@/contexts/OrganizationContext";
import { OrderSummary } from "./OrderSummary";

interface OrderCartProps {
    items: { product: any, quantity: number }[];
    customer: any | null;
    onReset: () => void;
    onSuccess?: (saleId: string) => void;
}

export function OrderCart({ items, customer, onReset, onSuccess }: OrderCartProps) {
    const [open, setOpen] = useState(false);
    const { organizationId } = useOrganization();

    const subtotal = items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const count = items.reduce((acc, item) => acc + item.quantity, 0);

    if (count === 0) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur border-t border-slate-800 z-50 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-14 rounded-xl shadow-lg shadow-emerald-900/20 text-lg font-bold flex justify-between items-center px-6">
                        <div className="flex items-center gap-3">
                            <span className="bg-emerald-800/50 px-2 py-0.5 rounded text-sm text-emerald-200">{count} items</span>
                            <span>Ver Pedido</span>
                        </div>
                        <span>${subtotal.toLocaleString()}</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[90vh] bg-slate-950 border-t border-slate-800 rounded-t-[2rem] p-0">
                    <div className="h-full flex flex-col p-6">
                        <SheetHeader className="mb-6">
                            <SheetTitle className="text-white text-xl font-bold flex items-center gap-2">
                                <Truck className="text-emerald-500" />
                                Confirmar Reparto
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-hidden">
                            <OrderSummary
                                items={items}
                                customer={customer}
                                onReset={onReset}
                                onClose={() => setOpen(false)}
                                onSuccess={onSuccess}
                            />
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
