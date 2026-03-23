'use client';

import { useState } from 'react';
import { Upload, Play, Loader2, AlertTriangle, CheckCircle2, Download, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface ImportSummary {
  durationMs: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  tablesProcessed: number;
  validations: Array<{ name: string; passed: boolean; expected: number; actual: number }>;
}

interface TableDetail {
  table: string;
  sourceRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export function LegacyImportPanel() {
  const { canEdit } = usePermissions();
  const [bundlePath, setBundlePath] = useState('./exports/system_export_xxx');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedJsonFile, setSelectedJsonFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [tableDetails, setTableDetails] = useState<TableDetail[]>([]);
  const [rawResult, setRawResult] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canRun = canEdit('settings');

  const handleJsonUpload = async () => {
    if (!selectedJsonFile) {
      toast.error('Selecciona un archivo JSON primero');
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setRawResult('');
    setTableDetails([]);

    try {
      const fileContent = await selectedJsonFile.text();

      // Validar que sea JSON válido
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(fileContent);
      } catch {
        toast.error('El archivo no es un JSON válido. Revisá que tenga el formato correcto.');
        return;
      }

      const response = await fetch('/api/legacy-import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedJson }),
      });

      const rawText = await response.text();
      let payload: any = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok || payload?.error || !payload?.success || !payload?.result) {
        const fallbackMessage = rawText?.slice(0, 300) || `HTTP ${response.status}`;
        toast.error(`Importación fallida: ${payload?.error || fallbackMessage}`);
        setRawResult(rawText);
        return;
      }

      const result = payload.result;
      setSummary({
        durationMs: result.durationMs,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        tablesProcessed: result.tablesProcessed,
        validations: result.validations || [],
      });

      if (result.tableResults) {
        setTableDetails(
          result.tableResults.map((t: any) => ({
            table: t.table,
            sourceRows: t.sourceRows,
            inserted: t.inserted,
            updated: t.updated,
            skipped: t.skipped,
            failed: t.failed,
          }))
        );
      }

      setRawResult(JSON.stringify(payload.result, null, 2));

      if (result.failed > 0) {
        toast.warning(`Importación completada con ${result.failed} errores`);
      } else {
        toast.success(`¡Migración exitosa! ${result.inserted} registros importados`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Importación fallida: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRun = async () => {
    if (!bundlePath.trim()) {
      toast.error('Debes ingresar un bundlePath');
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setRawResult('');

    try {
      const { runLegacyImport } = await import('@/actions/legacy-import');
      const response = await runLegacyImport(bundlePath.trim());

      if (response.error || !response.success || !response.result) {
        toast.error(`Importación fallida: ${response.error || 'Error desconocido'}`);
        return;
      }

      const result = response.result;
      setSummary({
        durationMs: result.durationMs,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        tablesProcessed: result.tablesProcessed,
        validations: result.validations,
      });
      setRawResult(JSON.stringify(result, null, 2));

      if (result.failed > 0) {
        toast.warning(`Importación completada con errores (${result.failed})`);
      } else {
        toast.success('Importación completada correctamente');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Importación fallida: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecciona una carpeta/archivos del bundle');
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setRawResult('');

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append('files', file);
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        formData.append('paths', relativePath);
      }

      const response = await fetch('/api/legacy-import', {
        method: 'POST',
        body: formData,
      });

      const rawText = await response.text();
      let payload: any = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok || payload.error || !payload.success || !payload.result) {
        const fallbackMessage = rawText?.slice(0, 240) || `HTTP ${response.status}`;
        toast.error(`Importación fallida: ${payload?.error || fallbackMessage || 'Error desconocido'}`);
        return;
      }

      const result = payload.result as ImportSummary & { validations: ImportSummary['validations'] };
      setSummary({
        durationMs: result.durationMs,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        tablesProcessed: result.tablesProcessed,
        validations: result.validations,
      });
      setRawResult(JSON.stringify(payload.result, null, 2));

      if (result.failed > 0) {
        toast.warning(`Importación completada con errores (${result.failed})`);
      } else {
        toast.success('Importación completada correctamente');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Importación fallida: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadJsonTemplate = () => {
    const template = {
      _info: "Estructura de ejemplo para migración. Rellená cada tabla con los datos de tu sistema anterior.",
      _source_system: "mi_sistema_anterior",
      customers: [
        {
          id: "1",
          name: "Juan Pérez",
          tax_id: "20123456789",
          phone: "1122334455",
          email: "juan@email.com",
          address: "Av. Siempre Viva 742",
          balance: 0,
          service_type: "minorista",
        },
      ],
      products: [
        {
          id: "1",
          name: "Coca Cola 500ml",
          barcode: "7790895000058",
          price: 1500,
          cost_price: 900,
          stock: 100,
          category: "Bebidas",
          brand: "Coca Cola",
        },
      ],
      orders: [
        {
          id: "1",
          customer_id: "1",
          date: "2024-06-15",
          total: 4500,
          status: "delivered",
          notes: "Pedido de ejemplo",
        },
      ],
      order_items: [
        {
          order_id: "1",
          product_id: "1",
          quantity: 3,
          unit_price: 1500,
        },
      ],
      sales: [
        {
          id: "1",
          customer_id: "1",
          date: "2024-06-15",
          total: 4500,
          payment_method: "efectivo",
        },
      ],
      sale_items: [
        {
          sale_id: "1",
          product_id: "1",
          quantity: 3,
          unit_price: 1500,
        },
      ],
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_migracion.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* === SECCIÓN PRINCIPAL: JSON UPLOAD === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Migración Completa desde JSON
          </CardTitle>
          <CardDescription>
            Sube un archivo JSON con toda la información de tu sistema anterior (clientes, productos, ventas, pedidos, etc.) y el sistema los procesará automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canRun && (
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              No tienes permisos para ejecutar importaciones (requiere editar Configuración).
            </div>
          )}

          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/20">
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-medium mb-1">Arrastra o selecciona tu archivo JSON</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Un solo archivo .json con todas las tablas de tu sistema anterior.
            </p>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedJsonFile(file);
                  if (file) toast.info(`Archivo seleccionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
                }}
                disabled={isRunning || !canRun}
              />
              <Button variant="outline" disabled={isRunning || !canRun}>
                Seleccionar archivo .json
              </Button>
            </div>
            {selectedJsonFile && (
              <p className="text-sm text-primary mt-3 font-medium">{selectedJsonFile.name} ({(selectedJsonFile.size / 1024 / 1024).toFixed(2)} MB)</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleJsonUpload}
              disabled={isRunning || !canRun || !selectedJsonFile}
              className="gap-2 flex-1"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Procesando migración...' : 'Iniciar Migración'}
            </Button>
            <Button variant="outline" onClick={downloadJsonTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar plantilla de ejemplo
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 p-3 rounded-md text-sm space-y-1">
            <p className="font-medium">¿Cómo funciona?</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Descargá la plantilla de ejemplo para ver la estructura esperada.</li>
              <li>Reemplazá los datos de ejemplo con los de tu sistema anterior.</li>
              <li>Subí el archivo y hacé clic en &quot;Iniciar Migración&quot;.</li>
              <li>El sistema creará clientes, productos, pedidos y ventas automáticamente.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* === RESULTADOS === */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {summary.failed > 0
                ? <AlertTriangle className="h-5 w-5 text-amber-500" />
                : <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              }
              Resultado de la Migración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{summary.inserted}</p>
                <p className="text-xs text-muted-foreground">Insertados</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{summary.updated}</p>
                <p className="text-xs text-muted-foreground">Actualizados</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{summary.skipped}</p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{summary.tablesProcessed}</p>
                <p className="text-xs text-muted-foreground">Tablas</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Duración: {summary.durationMs} ms</p>

            {tableDetails.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Tabla</th>
                      <th className="text-right p-2 font-medium">Filas</th>
                      <th className="text-right p-2 font-medium">Insertados</th>
                      <th className="text-right p-2 font-medium">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableDetails.map((t) => (
                      <tr key={t.table} className="border-t">
                        <td className="p-2 font-mono text-xs">{t.table}</td>
                        <td className="p-2 text-right">{t.sourceRows}</td>
                        <td className="p-2 text-right text-green-600">{t.inserted}</td>
                        <td className="p-2 text-right text-destructive">{t.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === ADVANCED: BUNDLE PATH / FOLDER UPLOAD === */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? '▾ Ocultar opciones avanzadas' : '▸ Opciones avanzadas (bundle por ruta / carpeta)'}
        </button>
      </div>

      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle>Importación avanzada (Bundle)</CardTitle>
            <CardDescription>
              Ejecuta la ETL desde un bundle exportado por ruta o subiendo una carpeta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bundle-path">Bundle Path</Label>
              <Input
                id="bundle-path"
                value={bundlePath}
                onChange={(event) => setBundlePath(event.target.value)}
                placeholder="./exports/system_export_xxx"
              />
            </div>
            <Button onClick={handleRun} disabled={isRunning || !canRun} className="gap-2">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Ejecutando...' : 'Iniciar por Ruta'}
            </Button>

            <div className="pt-3 border-t border-border space-y-2">
              <Label htmlFor="bundle-upload">Subir carpeta bundle</Label>
              <Input
                id="bundle-upload"
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
              />
              <Button
                variant="outline"
                onClick={handleRunUpload}
                disabled={isRunning || !canRun || selectedFiles.length === 0}
                className="gap-2"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isRunning ? 'Subiendo...' : `Subir y Ejecutar (${selectedFiles.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rawResult && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte JSON</CardTitle>
            <CardDescription>Resumen detallado del último proceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{rawResult}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
