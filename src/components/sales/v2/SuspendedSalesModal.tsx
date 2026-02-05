'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SuspendedSalesPanel } from '@/components/sales/SuspendedSalesPanel';

interface SuspendedSalesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suspendedSales: any[];
    onResume: (id: string) => void;
    onDelete: (id: string) => void;
}

export function SuspendedSalesModal({
    open,
    onOpenChange,
    suspendedSales,
    onResume,
    onDelete,
}: SuspendedSalesModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Ventas Suspendidas</DialogTitle>
                    <DialogDescription>
                        Gestiona las ventas que has pausado temporalmente
                    </DialogDescription>
                </DialogHeader>
                <SuspendedSalesPanel
                    suspendedSales={suspendedSales}
                    onResume={(id) => {
                        onResume(id);
                        onOpenChange(false);
                    }}
                    onDelete={onDelete}
                />
            </DialogContent>
        </Dialog>
    );
}
