import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Customer } from "./types";
import { useEffect, useState } from "react";
import { Store, Truck } from "lucide-react";

interface CustomerFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (formData: any) => Promise<void>;
    editingCustomer: Customer | null;
    saving: boolean;
}

export function CustomerFormModal({
    open,
    onOpenChange,
    onSubmit,
    editingCustomer,
    saving,
}: CustomerFormModalProps) {
    const [creditEnabled, setCreditEnabled] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        reference: "",
        customer_type: "retail" as "retail" | "wholesale",
        service_type: "both" as "counter" | "delivery" | "both",
        credit_limit: "",
        payment_terms: "contado",
    });

    const handleCreditEnabledChange = (enabled: boolean) => {
        setCreditEnabled(enabled);
        if (enabled) {
            setFormData((prev) => ({
                ...prev,
                payment_terms: prev.payment_terms === "contado" ? "30_dias" : prev.payment_terms,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            payment_terms: "contado",
        }));
    };

    useEffect(() => {
        if (editingCustomer) {
            const limit = Number(editingCustomer.credit_limit || 0);
            const paymentTerms = editingCustomer.payment_terms || "contado";
            const hasCreditConfigured = limit > 0 || paymentTerms !== "contado";
            setCreditEnabled(hasCreditConfigured);
            setFormData({
                name: editingCustomer.name || "",
                email: editingCustomer.email || "",
                phone: editingCustomer.phone || "",
                address: editingCustomer.address || "",
                reference: editingCustomer.reference || "",
                customer_type: editingCustomer.customer_type,
                service_type: editingCustomer.service_type || "both",
                credit_limit: limit > 0 ? String(limit) : "",
                payment_terms: hasCreditConfigured ? (paymentTerms === "contado" ? "30_dias" : paymentTerms) : "contado",
            });
        } else {
            setCreditEnabled(false);
            setFormData({
                name: "",
                email: "",
                phone: "",
                address: "",
                reference: "",
                customer_type: "retail",
                service_type: "both",
                credit_limit: "",
                payment_terms: "contado",
            });
        }
    }, [editingCustomer, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedLimit = Number(formData.credit_limit || 0);
        onSubmit({
            ...formData,
            credit_limit: creditEnabled ? (Number.isFinite(parsedLimit) ? parsedLimit : 0) : 0,
            payment_terms: creditEnabled
                ? (formData.payment_terms === "contado" ? "30_dias" : formData.payment_terms)
                : "contado",
        });
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="name"
                                className="text-sm font-medium leading-none"
                            >
                                Nombre
                            </label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium leading-none"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="phone"
                                className="text-sm font-medium leading-none"
                            >
                                Teléfono
                            </label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({ ...formData, phone: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <label
                                htmlFor="service"
                                className="text-sm font-medium leading-none"
                            >
                                Tipo de Servicio
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, service_type: "counter" })}
                                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                                        formData.service_type === "counter"
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background border-input hover:bg-muted"
                                    }`}
                                >
                                    <Store className="h-3 w-3 inline mr-1" />Mostrador
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, service_type: "delivery" })}
                                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                                        formData.service_type === "delivery"
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background border-input hover:bg-muted"
                                    }`}
                                >
                                    <Truck className="h-3 w-3 inline mr-1" />Reparto
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, service_type: "both" })}
                                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                                        formData.service_type === "both"
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background border-input hover:bg-muted"
                                    }`}
                                >
                                    <Store className="h-3 w-3 inline mr-1" /><Truck className="h-3 w-3 inline mr-1" />Ambos
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <label
                            htmlFor="address"
                            className="text-sm font-medium leading-none"
                        >
                            Dirección
                        </label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) =>
                                setFormData({ ...formData, address: e.target.value })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <label
                            htmlFor="reference"
                            className="text-sm font-medium leading-none"
                        >
                            Referencia (para rutas)
                        </label>
                        <Input
                            id="reference"
                            placeholder="Entre calles, color de reja, etc."
                            value={formData.reference}
                            onChange={(e) =>
                                setFormData({ ...formData, reference: e.target.value })
                            }
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium leading-none">
                            Tipo de Cliente
                        </label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm font-normal cursor-pointer leading-none">
                                <input
                                    type="radio"
                                    name="type"
                                    checked={formData.customer_type === "retail"}
                                    onChange={() =>
                                        setFormData({ ...formData, customer_type: "retail" })
                                    }
                                />
                                Minorista
                            </label>
                            <label className="flex items-center gap-2 text-sm font-normal cursor-pointer leading-none">
                                <input
                                    type="radio"
                                    name="type"
                                    checked={formData.customer_type === "wholesale"}
                                    onChange={() =>
                                        setFormData({ ...formData, customer_type: "wholesale" })
                                    }
                                />
                                Mayorista
                            </label>
                        </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Habilitar crédito (fiado)</p>
                                <p className="text-xs text-muted-foreground">
                                    Activa cuenta corriente para este cliente.
                                </p>
                            </div>
                            <Switch
                                checked={creditEnabled}
                                onCheckedChange={handleCreditEnabledChange}
                            />
                        </div>

                        {creditEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <label
                                        htmlFor="credit_limit"
                                        className="text-sm font-medium leading-none"
                                    >
                                        Límite de Crédito
                                    </label>
                                    <Input
                                        id="credit_limit"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.credit_limit}
                                        onChange={(e) =>
                                            setFormData({ ...formData, credit_limit: e.target.value })
                                        }
                                        placeholder="Ej: 50000 (vacío o 0 = sin límite)"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label
                                        htmlFor="payment_terms"
                                        className="text-sm font-medium leading-none"
                                    >
                                        Condición de Pago
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { value: "7_dias", label: "7 días" },
                                            { value: "15_dias", label: "15 días" },
                                            { value: "30_dias", label: "30 días" },
                                        ].map((term) => (
                                            <button
                                                key={term.value}
                                                id="payment_terms"
                                                type="button"
                                                onClick={() => setFormData({ ...formData, payment_terms: term.value })}
                                                className={`px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                                                    formData.payment_terms === term.value
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background border-input hover:bg-muted"
                                                }`}
                                            >
                                                {term.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
