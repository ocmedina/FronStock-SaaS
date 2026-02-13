# Configuración del Logo para PDFs

## Problema
El logo no aparece en los PDFs de facturas y órdenes de compra.

## Solución Implementada

Se ha implementado conversión automática de imágenes a Base64 para resolver problemas de CORS en @react-pdf/renderer.

### 1. Crear el Bucket de Storage en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **Storage** en el menú lateral
3. Haz clic en **New bucket**
4. Configura el bucket:
   - **Name**: `organization-logos`
   - **Public bucket**: ✅ **Activado** (MUY IMPORTANTE)
   - **File size limit**: 2 MB (o según necesites)
   - **Allowed MIME types**: `image/*`

5. Haz clic en **Create bucket**

### 2. Configurar Políticas de Acceso (RLS)

Si el bucket no es completamente público, agrega estas políticas:

```sql
-- Política para permitir lectura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'organization-logos' );

-- Política para permitir subida a usuarios autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir actualización
CREATE POLICY "Users can update own organization logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND auth.role() = 'authenticated'
);
```

### 3. Subir el Logo desde la Aplicación

1. En tu aplicación, ve a **Settings → General**
2. Haz clic en el círculo del logo (dice "Subir Logo" o "Cambiar")
3. Selecciona tu imagen:
   - Formato recomendado: PNG con fondo transparente
   - Tamaño recomendado: 200x200 px (cuadrado)
   - Peso máximo: 2 MB
4. Espera a que diga "Logo subido. Guarda los cambios para confirmar."
5. Haz clic en **Guardar Cambios**

### 4. Verificar que Funciona

1. Ve a **Facturación** o **Compras**
2. Haz clic en el botón de PDF de cualquier factura u orden
3. El logo debería aparecer en la esquina superior izquierda

### 5. Debugging

Si el logo no aparece:

#### Opción A: Verificar en la Consola del Navegador
- Abre DevTools (F12)
- Ve a la pestaña Console
- Deberías ver: `✅ Logo convertido a base64 para PDF`
- Si ves `❌ Error cargando imagen para PDF:`, revisa:
  - Que el bucket sea público
  - Que la URL del logo sea correcta
  - Que la imagen exista en Supabase Storage

#### Opción B: Verificar la URL del Logo
```javascript
// En la consola del navegador:
// 1. Ve a Settings
// 2. Abre la consola
// 3. Ejecuta:
console.log(organization.logo_url);
```

La URL debería verse así:
```
https://[tu-proyecto].supabase.co/storage/v1/object/public/organization-logos/[organization-id]/logo-[timestamp].png
```

#### Opción C: Probar la URL Directamente
- Copia la URL del logo
- Pégala en una nueva pestaña del navegador
- Si no carga, el problema está en Supabase Storage (permisos o bucket no público)

### 6. Alternativa: Usar Logo desde URL Externa

Si prefieres usar un logo alojado en otro lugar:

1. Asegúrate de que la URL tenga CORS habilitado
2. La URL debe ser HTTPS
3. El servidor debe permitir requests desde tu dominio

**Ejemplo de URL válida:**
```
https://tu-sitio.com/logo.png
```

### 7. Migración SQL (Agregar Columnas Missing)

Si necesitas agregar phone y email a organizations:

```sql
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

COMMENT ON COLUMN organizations.phone IS 'Company phone number';
COMMENT ON COLUMN organizations.email IS 'Company email address';
```

## Archivos Modificados

- `src/hooks/useImageToBase64.ts` - Hook para convertir imágenes a base64
- `src/components/purchases/DownloadPurchaseOrderButton.tsx` - Usa conversión base64
- `src/app/(dashboard)/dashboard/invoices/page.tsx` - Usa conversión base64
- `src/types/database.types.ts` - Agregados campos phone y email
- `src/hooks/index.ts` - Export del nuevo hook

## Flujo Técnico

```
1. Usuario sube logo → Supabase Storage
2. URL guarda en organizations.logo_url
3. Componente PDF se renderiza:
   ↓
4. useImageToBase64 hook detecta logo_url
   ↓
5. Fetch de la imagen desde Supabase
   ↓
6. Conversión a Base64
   ↓
7. Base64 se pasa al componente PDF
   ↓
8. @react-pdf/renderer puede renderizar Base64 sin problemas de CORS
```

## Notas Importantes

- ⚠️ El bucket DEBE ser público para que funcione
- ⚠️ La conversión a base64 agrega unos segundos al tiempo de generación del PDF
- ✅ Una vez convertido, no hay problemas de CORS
- ✅ El logo se cachea hasta que cambie la URL

## Soporte

Si sigues teniendo problemas:
1. Revisa los logs de la consola del navegador
2. Verifica que el bucket `organization-logos` existe y es público
3. Prueba la URL del logo directamente en el navegador
4. Asegúrate de guardar los cambios después de subir el logo
