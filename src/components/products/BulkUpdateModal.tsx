'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Edit3 } from 'lucide-react';

interface BulkUpdateModalProps {
    open: boolean;
    onClose: () => void;
    selectedCount: number;
    onUpdate: (updates: BulkUpdateData) => Promise<void>;
}

export interface BulkUpdateData {
    field: 'price' | 'stock';
    operation: 'set' | 'add' | 'subtract' | 'percentage';
    value: number;
}

export function BulkUpdateModal({ open, onClose, selectedCount, onUpdate }: BulkUpdateModalProps) {
    const [field, setField] = useState<'price' | 'stock'>('price');
    const [operation, setOperation] = useState<'set' | 'add' | 'subtract' | 'percentage'>('percentage');
    const [value, setValue] = useState('');
    const [updating, setUpdating] = useState(false);

    const handleUpdate = async () => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        setUpdating(true);
        try {
            await onUpdate({ field, operation, value: numValue });
            onClose();
        } finally {
            setUpdating(false);
        }
    };

    const getOperationLabel = () => {
        switch (operation) {
            case 'set': return `Establecer ${field === 'price' ? 'precio' : 'stock'} a`;
            case 'add': return `Aumentar ${field === 'price' ? 'precio' : 'stock'} en`;
            case 'subtract': return `Reducir ${field === 'price' ? 'precio' : 'stock'} en`;
            case 'percentage': return `Cambiar ${field === 'price' ? 'precio' : 'stock'} en %`;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit3 className="h-5 w-5" />
                        Actualización Masiva
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Se actualizarán <span className="font-medium text-foreground">{selectedCount}</span> productos seleccionados.
                    </p>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Campo a actualizar</label>
                        <Select value={field} onValueChange={(v) => setField(v as 'price' | 'stock')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="price">Precio</SelectItem>
                                <SelectItem value="stock">Stock</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Operación</label>
                        <Select value={operation} onValueChange={(v) => setOperation(v as 'set' | 'add' | 'subtract' | 'percentage')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="set">Establecer valor fijo</SelectItem>
                                <SelectItem value="add">Aumentar</SelectItem>
                                <SelectItem value="subtract">Reducir</SelectItem>
                                {field === 'price' && <SelectItem value="percentage">Cambiar porcentaje (%)</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{getOperationLabel()}</label>
                        <div className="flex items-center gap-2">
                            {field === 'price' && operation !== 'percentage' && <span className="text-muted-foreground">$</span>}
                            <Input
                                type="number"
                                step={field === 'price' ? '0.01' : '1'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={operation === 'percentage' ? 'Ej: 10 para +10%' : '0'}
                            />
                            {operation === 'percentage' && <span className="text-muted-foreground">%</span>}
                        </div>
                        {operation === 'percentage' && (
                            <p className="text-xs text-muted-foreground">
                                Usa valores positivos para aumentar (ej: 10 = +10%) o negativos para reducir (ej: -15 = -15%)
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdate} disabled={!value || updating} className="flex-1">
                            {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                            {updating ? 'Actualizando...' : 'Aplicar Cambios'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
