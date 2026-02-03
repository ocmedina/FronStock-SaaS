"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NewOrderForm } from "@/components/orders/NewOrderForm";
import { useRouter } from "next/navigation";

export default function DeliveryOrderPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col bg-slate-950">
            {/* Mobile Header */}
            <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Link href="/delivery">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-white">Nuevo Pedido</h1>
                        <p className="text-xs text-slate-400">Modo Delivery</p>
                    </div>
                </div>
            </div>

            {/* Form - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 pb-6">
                <NewOrderForm
                    redirectAfterCreate={false}
                    onSuccess={() => {
                        router.push('/delivery');
                    }}
                />
            </div>
        </div>
    );
}
