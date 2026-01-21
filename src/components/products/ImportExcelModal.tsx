'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportExcelModalProps {
    open: boolean;
    onClose: () => void;
    onImport: (products: ImportedProduct[]) => Promise<void>;
}

export interface ImportedProduct {
    name: string;
    sku: string | null;
    price: number;
    stock: number;
}

interface ColumnMapping {
    name: string;
    sku: string;
    price: string;
    stock: string;
}

const REQUIRED_FIELDS = ['name'] as const;
const OPTIONAL_FIELDS = ['sku', 'price', 'stock'] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

export function ImportExcelModal({ open, onClose, onImport }: ImportExcelModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
        name: '',
        sku: '',
        price: '',
        stock: '',
    });
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done'>('upload');
    const [errors, setErrors] = useState<string[]>([]);
    const [importedCount, setImportedCount] = useState(0);

    const resetState = () => {
        setFile(null);
        setRawData([]);
        setHeaders([]);
        setColumnMapping({ name: '', sku: '', price: '', stock: '' });
        setStep('upload');
        setErrors([]);
        setImportedCount(0);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

                if (jsonData.length === 0) {
                    setErrors(['El archivo está vacío o no tiene datos válidos']);
                    return;
                }

                const fileHeaders = Object.keys(jsonData[0]);
                setHeaders(fileHeaders);
                setRawData(jsonData);

                // Auto-detect column mapping
                const autoMapping: ColumnMapping = { name: '', sku: '', price: '', stock: '' };
                fileHeaders.forEach((header) => {
                    const lowerHeader = header.toLowerCase();
                    if (lowerHeader.includes('nombre') || lowerHeader === 'name' || lowerHeader === 'producto') {
                        autoMapping.name = header;
                    } else if (lowerHeader.includes('sku') || lowerHeader.includes('codigo') || lowerHeader.includes('código') || lowerHeader.includes('barcode')) {
                        autoMapping.sku = header;
                    } else if (lowerHeader.includes('precio') || lowerHeader === 'price') {
                        autoMapping.price = header;
                    } else if (lowerHeader.includes('stock') || lowerHeader.includes('cantidad') || lowerHeader.includes('inventario')) {
                        autoMapping.stock = header;
                    }
                });

                setColumnMapping(autoMapping);
                setStep('mapping');
                setErrors([]);
            } catch {
                setErrors(['Error al leer el archivo. Asegúrate de que sea un archivo Excel válido.']);
            }
        };

        reader.readAsArrayBuffer(selectedFile);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            const input = document.createElement('input');
            input.type = 'file';
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(droppedFile);
            input.files = dataTransfer.files;
            handleFileChange({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
        }
    }, [handleFileChange]);

    const validateMapping = (): boolean => {
        const newErrors: string[] = [];
        if (!columnMapping.name) {
            newErrors.push('Debes seleccionar la columna para "Nombre"');
        }
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleContinueToPreview = () => {
        if (validateMapping()) {
            setStep('preview');
        }
    };

    const getMappedProducts = (): ImportedProduct[] => {
        return rawData.map((row) => ({
            name: String(row[columnMapping.name] || '').trim(),
            sku: columnMapping.sku ? String(row[columnMapping.sku] || '').trim() || null : null,
            price: columnMapping.price ? parseFloat(String(row[columnMapping.price])) || 0 : 0,
            stock: columnMapping.stock ? parseInt(String(row[columnMapping.stock])) || 0 : 0,
        })).filter((p) => p.name); // Filter out empty names
    };

    const handleImport = async () => {
        const products = getMappedProducts();
        if (products.length === 0) {
            setErrors(['No hay productos válidos para importar']);
            return;
        }

        setStep('importing');
        try {
            await onImport(products);
            setImportedCount(products.length);
            setStep('done');
        } catch {
            setErrors(['Error al importar los productos']);
            setStep('preview');
        }
    };

    const previewProducts = getMappedProducts().slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Importar Productos desde Excel
                    </DialogTitle>
                </DialogHeader>

                {/* Errors */}
                {errors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                        {errors.map((error, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    >
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">
                            Arrastra un archivo Excel aquí o haz clic para seleccionar
                        </p>
                        <Input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            className="max-w-xs mx-auto"
                        />
                        <p className="text-xs text-muted-foreground mt-4">
                            Formatos soportados: .xlsx, .xls, .csv
                        </p>
                    </div>
                )}

                {/* Step 2: Column Mapping */}
                {step === 'mapping' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Archivo: <span className="font-medium text-foreground">{file?.name}</span>
                            {' '}({rawData.length} filas)
                        </p>

                        <div className="grid gap-4">
                            {ALL_FIELDS.map((field) => (
                                <div key={field} className="flex items-center gap-4">
                                    <label className="w-24 text-sm font-medium capitalize">
                                        {field === 'name' ? 'Nombre *' : field === 'sku' ? 'SKU' : field === 'price' ? 'Precio' : 'Stock'}
                                    </label>
                                    <Select
                                        value={columnMapping[field as keyof ColumnMapping]}
                                        onValueChange={(v) => setColumnMapping({ ...columnMapping, [field]: v })}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Seleccionar columna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">-- No importar --</SelectItem>
                                            {headers.map((h) => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={resetState} className="flex-1">
                                Volver
                            </Button>
                            <Button onClick={handleContinueToPreview} className="flex-1">
                                Continuar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Vista previa de los primeros {previewProducts.length} productos de {getMappedProducts().length}:
                        </p>

                        <div className="rounded-lg border max-h-64 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead className="text-right">Precio</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewProducts.map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{p.sku || '-'}</TableCell>
                                            <TableCell className="text-right">${p.price.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{p.stock}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" onClick={() => setStep('mapping')} className="flex-1">
                                Volver
                            </Button>
                            <Button onClick={handleImport} className="flex-1">
                                Importar {getMappedProducts().length} productos
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Importing */}
                {step === 'importing' && (
                    <div className="py-12 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                        <p className="text-muted-foreground">Importando productos...</p>
                    </div>
                )}

                {/* Step 5: Done */}
                {step === 'done' && (
                    <div className="py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                        <p className="text-lg font-medium mb-2">¡Importación completada!</p>
                        <p className="text-muted-foreground mb-6">
                            Se importaron {importedCount} productos correctamente.
                        </p>
                        <Button onClick={handleClose}>Cerrar</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
