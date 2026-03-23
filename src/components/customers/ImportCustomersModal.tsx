"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportCustomersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

type ImportStep = "upload" | "mapping" | "preview";

const TARGET_FIELDS = [
    { id: "name", label: "Nombre / Razón Social", required: true },
    { id: "tax_id", label: "DNI / CUIT", required: false },
    { id: "email", label: "Email", required: false },
    { id: "phone", label: "Teléfono", required: false },
    { id: "address", label: "Dirección", required: false },
    { id: "balance", label: "Deuda / Saldo Inicial", required: false },
    { id: "customer_type", label: "Tipo (Minorista/Mayorista)", required: false },
];

export function ImportCustomersModal({ open, onOpenChange, onSuccess }: ImportCustomersModalProps) {
    const [step, setStep] = useState<ImportStep>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

    const resetState = () => {
        setStep("upload");
        setFile(null);
        setHeaders([]);
        setRawData([]);
        setMapping({});
        setImportResult(null);
        setIsLoading(false);
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) resetState();
        onOpenChange(newOpen);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsLoading(true);

        try {
            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convertir a JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            if (jsonData.length < 2) {
                toast.error("El archivo está vacío o no tiene encabezados");
                return;
            }

            // Filtrar filas vacías
            const nonEmptyRows = jsonData.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ""));

            const fileHeaders = nonEmptyRows[0].map(String);
            const fileData = nonEmptyRows.slice(1).map(row => {
                const rowData: Record<string, any> = {};
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });
                return rowData;
            });

            setHeaders(fileHeaders);
            setRawData(fileData);

            // Intentar auto-mapear
            const initialMapping: Record<string, string> = {};
            fileHeaders.forEach(header => {
                const lower = header.toLowerCase().trim();
                if (lower.includes("nom") || lower.includes("raz")) initialMapping["name"] = header;
                else if (lower.includes("cuit") || lower.includes("dni")) initialMapping["tax_id"] = header;
                else if (lower.includes("email") || lower.includes("correo")) initialMapping["email"] = header;
                else if (lower.includes("tel")) initialMapping["phone"] = header;
                else if (lower.includes("dir") || lower.includes("domicilio")) initialMapping["address"] = header;
                else if (lower.includes("saldo") || lower.includes("bal") || lower.includes("deuda")) initialMapping["balance"] = header;
                else if (lower.includes("tipo") || lower.includes("mayor") || lower.includes("minor")) initialMapping["customer_type"] = header;
            });
            setMapping(initialMapping);
            setStep("mapping");
        } catch (error) {
            console.error(error);
            toast.error("Error al leer el archivo. Asegúrate de que es un CSV o Excel válido.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMappingChange = (targetField: string, sourceHeader: string) => {
        setMapping(prev => {
            const newMapping = { ...prev };
            // Remove previous mapping for this source header to ensure 1-1
            Object.keys(newMapping).forEach(key => {
                if (newMapping[key] === sourceHeader) delete newMapping[key];
            });
            if (sourceHeader !== "ignore") {
                newMapping[targetField] = sourceHeader;
            } else {
                delete newMapping[targetField];
            }
            return newMapping;
        });
    };

    const handleContinueToPreview = () => {
        if (!mapping.name) {
            toast.error("El campo Nombre / Razón Social es obligatorio.");
            return;
        }
        setStep("preview");
    };

    const handleImport = async () => {
        setIsLoading(true);

        // Preparar datos
        const mappedData = rawData.map(row => {
            const customer: Record<string, any> = {};
            Object.entries(mapping).forEach(([targetField, sourceHeader]) => {
                let value = row[sourceHeader];
                if (targetField === "balance") {
                    value = parseFloat(String(value).replace(/[^0-9.-]+/g,"")) || 0;
                }
                customer[targetField] = value;
            });
            return customer;
        }).filter(c => c.name); // Asegurar que tengan nombre

        try {
            const response = await fetch("/api/customers/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customers: mappedData })
            });

            const result = await response.json();

            if (!response.ok) {
                toast.error(result.error || "Error al importar clientes");
                return;
            }

            setImportResult({ success: result.successCount, failed: result.errorCount });
            toast.success(`${result.successCount} clientes importados correctamente`);
            if (result.successCount > 0) {
                setTimeout(() => {
                    handleOpenChange(false);
                    onSuccess();
                }, 2000);
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error inesperado al importar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Importar Clientes</DialogTitle>
                    <DialogDescription>
                        Importa múltiples clientes a la vez desde un archivo Excel o CSV.
                    </DialogDescription>
                </DialogHeader>

                {/* Paso 1: Subida */}
                {step === "upload" && (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Sube tu archivo</h3>
                        <p className="text-sm text-muted-foreground text-center mb-6">
                            Formatos soportados: .csv, .xlsx, .xls<br />
                            La primera fila debe contener los nombres de las columnas.
                        </p>
                        <div className="relative mb-4">
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileUpload}
                                disabled={isLoading}
                            />
                            <Button disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Seleccionar archivo
                            </Button>
                        </div>
                        <a 
                            href="/templates/plantilla_clientes.csv" 
                            download="plantilla_clientes.csv" 
                            className="text-primary text-sm hover:underline"
                        >
                            Descargar plantilla de ejemplo
                        </a>
                    </div>
                )}

                {/* Paso 2: Mapeo */}
                {step === "mapping" && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm mb-4 flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p>Asocia las columnas de tu archivo con los campos del sistema. El Nombre es obligatorio.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 font-medium px-2 text-sm text-muted-foreground">
                            <div>Campo del Sistema</div>
                            <div>Columna de tu Archivo</div>
                        </div>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto p-1">
                            {TARGET_FIELDS.map(field => (
                                <div key={field.id} className="grid grid-cols-2 gap-4 items-center">
                                    <Label className="flex items-center gap-2">
                                        {field.label}
                                        {field.required && <span className="text-destructive">*</span>}
                                    </Label>
                                    <Select
                                        value={mapping[field.id] || "ignore"}
                                        onValueChange={(val) => handleMappingChange(field.id, val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Ignorar / No mapear" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ignore" className="text-muted-foreground italic">
                                                No mapear este campo
                                            </SelectItem>
                                            {headers.map(header => (
                                                <SelectItem key={header} value={header}>
                                                    {header}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between pt-4 border-t">
                            <Button variant="outline" onClick={() => setStep("upload")}>Volver</Button>
                            <Button onClick={handleContinueToPreview}>
                                Continuar <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Paso 3: Preview e Importación */}
                {step === "preview" && (
                    <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Resumen de Importación</h4>
                            <ul className="text-sm space-y-1">
                                <li><strong>Total de filas a procesar:</strong> {rawData.length}</li>
                                <li><strong>Campos mapeados:</strong> {Object.keys(mapping).length} de {TARGET_FIELDS.length}</li>
                            </ul>
                        </div>

                        {importResult ? (
                            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                                {importResult.success > 0 && (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                        <CheckCircle2 className="h-8 w-8" />
                                        <span className="text-lg font-medium">{importResult.success} clientes importados.</span>
                                    </div>
                                )}
                                {importResult.failed > 0 && (
                                    <div className="flex items-center gap-2 text-destructive">
                                        <AlertTriangle className="h-6 w-6" />
                                        <span>Hubo {importResult.failed} errores de importación (posibles duplicados o formato inválido).</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="border rounded-md">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            {Object.keys(mapping).slice(0, 4).map(key => (
                                                <th key={key} className="text-left p-2 font-medium">
                                                    {TARGET_FIELDS.find(f => f.id === key)?.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rawData.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-t">
                                                {Object.entries(mapping).slice(0, 4).map(([targetField, sourceHeader]) => (
                                                    <td key={targetField} className="p-2 text-muted-foreground truncate max-w-[150px]">
                                                        {String(row[sourceHeader] || '')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {rawData.length > 3 && (
                                    <div className="p-2 text-center text-xs text-muted-foreground border-t bg-muted/50">
                                        Mostrando 3 de {rawData.length} filas
                                    </div>
                                )}
                            </div>
                        )}

                        {!importResult && (
                            <div className="flex justify-between pt-4 border-t">
                                <Button variant="outline" onClick={() => setStep("mapping")} disabled={isLoading}>Volver</Button>
                                <Button onClick={handleImport} disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Confirmar Importación
                                </Button>
                            </div>
                        )}
                        {importResult && (
                            <div className="flex justify-end pt-4">
                                <Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
