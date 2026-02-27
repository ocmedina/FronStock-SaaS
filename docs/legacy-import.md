# Legacy ETL Import

## Instalación

1. Configura variables de entorno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Opcionales:
  - `LEGACY_IMPORT_BATCH_SIZE` (default `500`)
  - `LEGACY_IMPORT_TOLERANT` (default `true`)
  - `LEGACY_IMPORT_SOURCE_SYSTEM` (default `legacy_system`)

2. Instala dependencias:

```bash
npm install
```

## Ejecución

### Desde la UI (Configuración → Importación)

- Opción 1: ejecutar por `bundlePath` (ruta local en el servidor).
- Opción 2: **Subir carpeta bundle** desde el navegador y ejecutar ETL en el servidor.

Nota: para equipos diferentes, usa la opción de subida. El servidor reconstruye el bundle en un directorio temporal y luego ejecuta `importLegacyBundle`.

### CLI (requerido por el proceso)

```bash
node import-legacy --bundle ./exports/system_export_xxx
```

### Script npm equivalente

```bash
npm run import-legacy -- --bundle ./exports/system_export_xxx
```

## Estructura esperada del bundle

- `all_tables.xlsx` (opcional)
- `csv/*.csv` por tabla
- `json/*.json` por tabla
- `mapping_template.csv`
- `integrity_summary.json`
- `import_order.txt`
- `export_report.json`

Prioridad de lectura por tabla: `csv > json > all_tables.xlsx`.

## Ejemplo real de mapeo

Archivo: `src/lib/legacy-import/examples/mapping_template.example.csv`

Incluye ejemplos para:

- `customers`
- `products`
- `sales`
- `payments`

## Diseño técnico implementado

Módulos:

- `loadBundle`
- `parseMapping`
- `transformRow`
- `resolveRelations`
- `upsertBatch`
- `validateIntegrity`
- `buildReport`
- `importLegacyBundle`

Características:

- Upsert idempotente por `source_system + legacy_id`
- Trazabilidad con `legacy_id` y `source_system`
- Aislamiento multi-tenant: desde la UI/API se fuerza `organization_id` a la organización actual (evita mezcla entre organizaciones)
- Resolución de FK por diccionario `legacy_id -> new_id`
- Procesamiento por lotes configurable
- Modo tolerante por fila (`LEGACY_IMPORT_TOLERANT=true`)
- Logs estructurados JSON
- Validación final contra `integrity_summary.json`

## Checklist pre-migración

- [ ] Verificar respaldo completo de base destino.
- [ ] Confirmar que todas las tablas destino tienen columnas `legacy_id` y `source_system` (o ajustar config/env).
- [ ] Validar `mapping_template.csv` con campos requeridos.
- [ ] Confirmar orden en `import_order.txt` (maestros antes que transaccionales).
- [ ] Ejecutar dry run en entorno staging.
- [ ] Revisar tamaño de lotes (`LEGACY_IMPORT_BATCH_SIZE`).

## Checklist post-migración

- [ ] Revisar `ImportResult.failed` y `tableResults[].rowErrors`.
- [ ] Validar checks de `validations` (conteos y totales).
- [ ] Auditar muestra de FK resueltas (customers/products/sales/payments).
- [ ] Comparar saldos de deuda proveedores/clientes vs origen.
- [ ] Confirmar idempotencia relanzando el mismo bundle (sin duplicados).

## Tests

```bash
npm run test:legacy-import
```
