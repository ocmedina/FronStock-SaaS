'use client';

import { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { Button } from '@/components/ui/button';
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
import { Tag, Printer } from 'lucide-react';

interface LabelModalProps {
    open: boolean;
    onClose: () => void;
    products: LabelProduct[];
}

export interface LabelProduct {
    id: string;
    name: string;
    sku: string | null;
    price: number;
}

type LabelSize = 'small' | 'medium' | 'large';

const LABEL_SIZES: Record<LabelSize, { width: string; height: string; barcodeWidth: number; barcodeHeight: number; fontSize: string }> = {
    small: { width: '50mm', height: '25mm', barcodeWidth: 1.2, barcodeHeight: 30, fontSize: '8px' },
    medium: { width: '60mm', height: '30mm', barcodeWidth: 1.5, barcodeHeight: 40, fontSize: '10px' },
    large: { width: '80mm', height: '40mm', barcodeWidth: 2, barcodeHeight: 50, fontSize: '12px' },
};

function generateInternalCode(productId: string): string {
    // Generate a short internal code based on product ID
    const shortId = productId.slice(-6).toUpperCase();
    return `FS-${shortId}`;
}

export function LabelModal({ open, onClose, products }: LabelModalProps) {
    const [labelSize, setLabelSize] = useState<LabelSize>('medium');
    const [showPrice, setShowPrice] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const size = LABEL_SIZES[labelSize];

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiquetas - FrontStock</title>
                <style>
                    @page {
                        size: ${size.width} ${size.height};
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .label {
                        width: ${size.width};
                        height: ${size.height};
                        padding: 2mm;
                        box-sizing: border-box;
                        page-break-after: always;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }
                    .label:last-child {
                        page-break-after: avoid;
                    }
                    .product-name {
                        font-size: ${size.fontSize};
                        font-weight: 600;
                        text-align: center;
                        margin-bottom: 2mm;
                        max-width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .product-price {
                        font-size: calc(${size.fontSize} + 2px);
                        font-weight: 700;
                        margin-bottom: 2mm;
                    }
                    .barcode-container svg {
                        max-width: 100%;
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    const size = LABEL_SIZES[labelSize];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        Generar Etiquetas
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Se generarán etiquetas para <span className="font-medium text-foreground">{products.length}</span> productos.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tamaño de etiqueta</label>
                            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Pequeña (50x25mm)</SelectItem>
                                    <SelectItem value="medium">Mediana (60x30mm)</SelectItem>
                                    <SelectItem value="large">Grande (80x40mm)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mostrar precio</label>
                            <Select value={showPrice ? 'yes' : 'no'} onValueChange={(v) => setShowPrice(v === 'yes')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="yes">Sí</SelectItem>
                                    <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm font-medium mb-3">Vista previa (primeros 3):</p>
                        <div ref={printRef} className="flex flex-wrap gap-3">
                            {products.slice(0, 3).map((product) => {
                                const code = product.sku || generateInternalCode(product.id);
                                return (
                                    <div
                                        key={product.id}
                                        className="label bg-white border rounded p-2 flex flex-col items-center justify-center"
                                        style={{ width: size.width, minHeight: size.height }}
                                    >
                                        <div className="product-name text-xs font-semibold text-center truncate max-w-full">
                                            {product.name}
                                        </div>
                                        {showPrice && (
                                            <div className="product-price text-sm font-bold">
                                                ${product.price.toFixed(2)}
                                            </div>
                                        )}
                                        <div className="barcode-container">
                                            <Barcode
                                                value={code}
                                                width={size.barcodeWidth}
                                                height={size.barcodeHeight}
                                                fontSize={parseInt(size.fontSize)}
                                                displayValue={true}
                                                margin={2}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {products.length > 3 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                ... y {products.length - 3} etiquetas más
                            </p>
                        )}
                    </div>

                    {/* Hidden print content with all labels */}
                    <div className="hidden">
                        <div ref={printRef}>
                            {products.map((product) => {
                                const code = product.sku || generateInternalCode(product.id);
                                return (
                                    <div key={product.id} className="label">
                                        <div className="product-name">{product.name}</div>
                                        {showPrice && (
                                            <div className="product-price">${product.price.toFixed(2)}</div>
                                        )}
                                        <div className="barcode-container">
                                            <Barcode
                                                value={code}
                                                width={size.barcodeWidth}
                                                height={size.barcodeHeight}
                                                fontSize={parseInt(size.fontSize)}
                                                displayValue={true}
                                                margin={2}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button onClick={handlePrint} className="flex-1">
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir Etiquetas
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
