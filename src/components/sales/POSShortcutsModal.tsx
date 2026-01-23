import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface POSShortcutsModalProps {
    open: boolean;
    onClose: () => void;
}

export function POSShortcutsModal({ open, onClose }: POSShortcutsModalProps) {
    const shortcuts = [
        { key: "F2", action: "Pagar / Procesar Venta" },
        { key: "F3", action: "Buscar Producto (Catálogo)" },
        { key: "F4", action: "Nueva Venta / Pestaña" },
        { key: "ESC", action: "Cerrar Pestaña / Cancelar" },
        { key: "DEL", action: "Eliminar item seleccionado" },
    ];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Atajos de Teclado
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {shortcuts.map((shortcut) => (
                        <div
                            key={shortcut.key}
                            className="flex items-center justify-between border-b pb-2 last:border-0"
                        >
                            <span className="font-medium">{shortcut.action}</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                <span className="text-xs">{shortcut.key}</span>
                            </kbd>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
