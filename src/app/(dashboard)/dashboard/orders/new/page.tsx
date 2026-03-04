"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export default function NewOrderPage() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-6">
            <div
                className="max-w-4xl mx-auto space-y-6 bg-background text-foreground"
                style={{
                    ['--background' as any]: '#f8fafc',
                    ['--foreground' as any]: '#0f172a',
                    ['--card' as any]: '#ffffff',
                    ['--card-foreground' as any]: '#0f172a',
                    ['--popover' as any]: '#ffffff',
                    ['--popover-foreground' as any]: '#0f172a',
                    ['--muted' as any]: '#f1f5f9',
                    ['--muted-foreground' as any]: '#64748b',
                    ['--accent' as any]: '#f1f5f9',
                    ['--accent-foreground' as any]: '#0f172a',
                    ['--border' as any]: '#e2e8f0',
                    ['--input' as any]: '#e2e8f0',
                    ['--ring' as any]: '#94a3b8',
                }}
            >
                {/* Header */}
                <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/orders">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Nuevo Pedido</h1>
                            <p className="text-muted-foreground mt-1 text-sm md:text-base">Crea un pedido de delivery</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground border-border shrink-0">
                        Borrador
                    </Badge>
                </div>

                {/* Form */}
                <NewOrderForm redirectAfterCreate={true} />
            </div>
        </div>
    );
}
