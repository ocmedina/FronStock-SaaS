'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const shortcuts = [
    { key: 'F1', description: 'Buscar producto', category: 'Navegación' },
    { key: 'F2', description: 'Seleccionar cliente', category: 'Navegación' },
    { key: 'F3', description: 'Aplicar descuento', category: 'Acciones' },
    { key: 'F8', description: 'Suspender venta', category: 'Acciones' },
    { key: 'F9', description: 'Recuperar venta suspendida', category: 'Acciones' },
    { key: 'F12', description: 'Procesar venta (Efectivo)', category: 'Pago' },
    { key: 'Esc', description: 'Cancelar/Limpiar', category: 'Navegación' },
    { key: 'Enter', description: 'Agregar producto', category: 'Acciones' },
    { key: '+', description: 'Aumentar cantidad', category: 'Carrito' },
    { key: '-', description: 'Disminuir cantidad', category: 'Carrito' },
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

export function KeyboardShortcutsHelp({
    open,
    onOpenChange,
}: KeyboardShortcutsHelpProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Atajos de Teclado
                    </DialogTitle>
                    <DialogDescription>
                        Usa estos atajos para trabajar más rápido en el POS
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {categories.map((category) => (
                        <div key={category}>
                            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                                {category}
                            </h3>
                            <div className="space-y-2">
                                {shortcuts
                                    .filter((s) => s.category === category)
                                    .map((shortcut) => (
                                        <div
                                            key={shortcut.key}
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="text-sm">{shortcut.description}</span>
                                            <Badge variant="outline" className="font-mono">
                                                {shortcut.key}
                                            </Badge>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                        💡 Tip: Los atajos no funcionan cuando estás escribiendo en un campo de texto
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
