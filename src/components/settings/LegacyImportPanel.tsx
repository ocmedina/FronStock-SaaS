'use client';

import { useState } from 'react';
import { Play, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

export function LegacyImportPanel() {
  const { canEdit } = usePermissions();
  const [bundlePath, setBundlePath] = useState('./exports/system_export_xxx');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rawResult, setRawResult] = useState<string>('');

  const canRun = canEdit('settings');

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Importación de datos legados</CardTitle>
          <CardDescription>
            Ejecuta la ETL desde un bundle exportado. Este proceso usa mapeo, resolución de relaciones,
            upsert idempotente y validación de integridad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canRun && (
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              No tienes permisos para ejecutar importaciones (requiere editar Configuración).
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bundle-path">Bundle Path</Label>
            <Input
              id="bundle-path"
              value={bundlePath}
              onChange={(event) => setBundlePath(event.target.value)}
              placeholder="./exports/system_export_xxx"
            />
            <p className="text-xs text-muted-foreground">
              Ejemplo: ./exports/system_export_xxx o ruta absoluta del servidor.
            </p>
          </div>

          <Button onClick={handleRun} disabled={isRunning || !canRun} className="gap-2">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? 'Ejecutando importación...' : 'Iniciar por Ruta'}
          </Button>

          <div className="pt-3 border-t border-border space-y-2">
            <Label htmlFor="bundle-upload">Subir carpeta bundle (equipo remoto)</Label>
            <Input
              id="bundle-upload"
              type="file"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
              {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
            />
            <p className="text-xs text-muted-foreground">
              Selecciona la carpeta raíz del export (incluyendo csv/json/mapping_template.csv).
            </p>
            <Button
              variant="outline"
              onClick={handleRunUpload}
              disabled={isRunning || !canRun || selectedFiles.length === 0}
              className="gap-2"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Subiendo y ejecutando...' : `Subir y Ejecutar (${selectedFiles.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Resultado de importación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Duración: {summary.durationMs} ms</p>
            <p>Tablas procesadas: {summary.tablesProcessed}</p>
            <p>Insertados: {summary.inserted}</p>
            <p>Actualizados: {summary.updated}</p>
            <p>Omitidos: {summary.skipped}</p>
            <p>Errores: {summary.failed}</p>
            <p>
              Validaciones OK: {summary.validations.filter((item) => item.passed).length}/
              {summary.validations.length}
            </p>
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
