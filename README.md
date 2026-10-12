# FrontStock

Sistema de gestión de inventario, ventas, compras, proveedores y entregas construido con Next.js, React, TypeScript y Supabase.

## Requisitos

- Node.js compatible con Next.js 16
- Una instancia de Supabase
- Variables de entorno configuradas en `.env.local`

Las variables principales son:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Para habilitar el panel global del desarrollador, agregá también en el entorno del servidor:

```env
DEVELOPER_USER_ID=uuid-de-tu-usuario-en-supabase
```

El UUID debe corresponder a tu usuario de `auth.users`. Esta variable no debe comenzar con
`NEXT_PUBLIC_`, porque el panel y sus operaciones administrativas se validan exclusivamente
en el servidor.

## Desarrollo

```bash
npm install
npm run dev
```

Comandos útiles:

```bash
npm run build
npm run lint
npm run test:legacy-import
```

## Estructura

- `src/app/`: rutas y páginas de la aplicación.
- `src/actions/`: acciones de servidor.
- `src/components/`: componentes reutilizables.
- `src/lib/`: servicios, Supabase, modo offline e importación legacy.
- `supabase/`: migraciones y configuración de base de datos.
- `public/`: logo, iconos y recursos PWA.
- `docs/`: documentación operativa y técnica.
- `exports/`: bundles de datos para importaciones legacy; no contiene datos de producción en el repositorio.

## Importación de datos legacy

La importación se documenta en [docs/legacy-import.md](docs/legacy-import.md).

Para ejecutar un bundle local:

```bash
npm run import-legacy -- --bundle ./exports/system_export_xxx
```

Los bundles reales deben mantenerse fuera del repositorio y respaldarse en un almacenamiento privado.

## Configuración adicional

La documentación sobre el modo offline y las operaciones del sistema está disponible en `docs/`.
