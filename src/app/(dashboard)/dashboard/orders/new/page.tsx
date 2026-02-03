"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export default function NewOrderPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/orders">
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">Nuevo Pedido</h1>
                            <p className="text-slate-400 mt-1 text-sm md:text-base">Crea un pedido de delivery</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-slate-400 border-slate-700">
                        Borrador
                    </Badge>
                </div>

                {/* Form */}
                <NewOrderForm redirectAfterCreate={true} />
            </div>
        </div>
    );
}
