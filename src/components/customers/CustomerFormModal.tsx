import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Customer } from "./types";
import { useEffect, useState } from "react";

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
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        reference: "",
        customer_type: "retail" as "retail" | "wholesale",
    });

    useEffect(() => {
        if (editingCustomer) {
            setFormData({
                name: editingCustomer.name || "",
                email: editingCustomer.email || "",
                phone: editingCustomer.phone || "",
                address: editingCustomer.address || "",
                reference: editingCustomer.reference || "",
                customer_type: editingCustomer.customer_type,
            });
        } else {
            setFormData({
                name: "",
                email: "",
                phone: "",
                address: "",
                reference: "",
                customer_type: "retail",
            });
        }
    }, [editingCustomer, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <label
                            htmlFor="name"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                        <div className="grid gap-2">
                            <label
                                htmlFor="phone"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                    </div>
                    <div className="grid gap-2">
                        <label
                            htmlFor="address"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
