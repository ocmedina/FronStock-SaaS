import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign } from "lucide-react";
import { useState } from "react";

interface CustomerPaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (amount: string, description: string) => Promise<void>;
    saving: boolean;
}

export function CustomerPaymentModal({
    open,
    onOpenChange,
    onSubmit,
    saving,
}: CustomerPaymentModalProps) {
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const handleSubmit = () => {
        onSubmit(amount, description);
        setAmount("");
        setDescription("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Registrar Pago</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Monto
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                className="pl-9"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Descripción
                        </label>
                        <Input
                            placeholder="Pago parcial / Pago total"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!amount || saving}>
                        Confirmar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
