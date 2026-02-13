# Integración Completa: Órdenes de Compra y Proveedores

## 📋 Resumen de Implementación

Se ha completado la integración completa entre el módulo de **Órdenes de Compra** y **Proveedores**, implementando:

### ✅ Funcionalidades Implementadas

#### 1. **Recepción de Órdenes con Actualización Automática de Stock**
- Modal intuitivo para recibir órdenes (completa o parcialmente)
- Actualización automática del inventario al recibir productos
- Registro de movimientos de stock con referencia a la orden de compra
- Actualización del costo de productos según precio de compra
- Soporte para recepciones parciales (múltiples entregas)

#### 2. **Creación de Órdenes desde Proveedor**
- Botón de "Nueva Orden" directamente en la página de proveedores
- Modal dedicado con autocompletado de datos del proveedor
- Selección de productos con precios sugeridos (costo)
- Cálculo automático de totales

#### 3. **Validación de Límites de Crédito**
- Validación automática al crear órdenes de compra
- Alertas visuales cuando se está cerca del límite (>80%)
- Bloqueo con confirmación cuando se excede el límite
- Actualización automática del balance del proveedor
- Vista de análisis crediticio

## 🗄️ Migraciones a Aplicar

Para activar estas funcionalidades, debes ejecutar las siguientes migraciones en **Supabase SQL Editor** en este orden:

### 1️⃣ Función de Recepción de Órdenes
```bash
supabase/migrations/20260211_receive_purchase_orders.sql
```
**Funcionalidades:**
- `receive_purchase_order()` - Recibir orden completa
- `partial_receive_purchase_order()` - Recibir orden parcialmente
- `get_purchase_order_pending_items()` - Ver items pendientes de recibir
- Triggers automáticos para updated_at
- Índices para mejorar performance

### 2️⃣ Validación de Crédito
```bash
supabase/migrations/20260211_supplier_credit_validation.sql
```
**Funcionalidades:**
- `check_supplier_credit_limit()` - Validar límite antes de crear orden
- `get_supplier_balance()` - Calcular balance actual
- `recalculate_all_supplier_balances()` - Recalcular todos los balances
- Triggers para actualización automática de balances
- Vista `supplier_credit_analysis` con análisis completo
- Columna `balance_updated_at` en suppliers

## 🚀 Cómo Aplicar las Migraciones

### Opción 1: Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **SQL Editor**
3. Crea una nueva query
4. Copia el contenido de cada archivo de migración
5. Ejecuta en orden (primero receive_purchase_orders, luego credit_validation)
6. Verifica que no haya errores

### Opción 2: Supabase CLI

```bash
# Desde la raíz del proyecto
npx supabase migration up

# O específicamente
npx supabase db push
```

### Opción 3: Manual

```bash
# Conectarse a la base de datos
psql postgresql://[TU_CONNECTION_STRING]

# Ejecutar cada archivo
\i supabase/migrations/20260211_receive_purchase_orders.sql
\i supabase/migrations/20260211_supplier_credit_validation.sql
```

## 🔍 Verificar la Instalación

Ejecuta estas queries para verificar que todo esté correcto:

```sql
-- Verificar funciones creadas
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%purchase%' OR routine_name LIKE '%supplier%credit%'
ORDER BY routine_name;

-- Verificar triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%purchase%' OR trigger_name LIKE '%supplier%')
ORDER BY event_object_table;

-- Verificar vista de análisis
SELECT * FROM supplier_credit_analysis LIMIT 1;
```

## 📊 Flujo Completo Implementado

```
┌─────────────┐
│  PROVEEDOR  │
└──────┬──────┘
       │
       │ 1. Crear Orden (con validación de crédito)
       ↓
┌─────────────────────┐
│  ORDEN DE COMPRA    │
│  Status: pending    │
└──────────┬──────────┘
           │
           │ 2. Recibir Productos
           ↓
    ┌──────────────────────┐
    │  ACTUALIZAR STOCK    │
    │  + Movimiento Stock  │
    │  + Actualizar Costo  │
    └──────────┬───────────┘
               │
               ↓
        ┌────────────────┐
        │ ORDEN RECIBIDA │
        └────────────────┘
```

## 🎯 Casos de Uso

### Caso 1: Recibir Orden Completa
1. Ir a **Compras** → Órdenes de Compra
2. Hacer clic en "Ver" en una orden pendiente
3. Clic en "Recibir Orden"
4. Verificar cantidades (por defecto trae las pendientes)
5. Confirmar recepción
6. ✅ Stock actualizado automáticamente

### Caso 2: Recibir Orden Parcialmente
1. Mismo proceso que arriba
2. Modificar cantidades a recibir (recibir menos de lo ordenado)
3. Confirmar
4. ✅ Se registra como "ordered" hasta recibir todo
5. Siguiente entrega: repetir proceso

### Caso 3: Crear Orden desde Proveedor
1. Ir a **Proveedores**
2. Hacer clic en el ícono 🛒 del proveedor
3. Agregar productos y cantidades
4. Se valida automáticamente el límite de crédito
5. ⚠️ Si excede límite: alerta con opción de continuar
6. Confirmar orden
7. ✅ Orden creada y vinculada al proveedor

### Caso 4: Gestión de Crédito
1. Sistema calcula automáticamente balance por facturas pendientes
2. Al crear orden: valida en tiempo real
3. Alertas visuales:
   - 🟢 Verde: crédito OK
   - 🟡 Amarillo: cerca del límite (>80%)
   - 🔴 Rojo: límite excedido
4. Vista de análisis: `supplier_credit_analysis`

## 🛠️ Nuevos Componentes Creados

### Frontend (React/Next.js)

1. **`ReceivePurchaseOrderModal.tsx`**
   - Ubicación: `src/components/purchases/`
   - Modal completo para recepción de órdenes
   - Soporte recepciones parciales
   - Validaciones de cantidad

2. **`CreatePurchaseOrderModal.tsx`**
   - Ubicación: `src/components/purchases/`
   - Crear órdenes desde cualquier lugar
   - Validación de crédito integrada
   - Alertas visuales

3. **Modificaciones en `page.tsx` (Purchases)**
   - Integración del modal de recepción
   - Botón "Recibir Orden" en lugar de simple "Marcar Recibido"
   - Soporte para órdenes en estado "ordered"

4. **Modificaciones en `page.tsx` (Suppliers)**
   - Botón 🛒 para crear orden
   - Modal de creación integrado
   - Callback de éxito

## 📈 Base de Datos

### Nuevas Funciones RPC Disponibles

```typescript
// Recibir orden completa
supabase.rpc('receive_purchase_order', {
  p_purchase_order_id: 'uuid',
  p_items: [
    { product_id: 'uuid', received_quantity: 10 }
  ]
})

// Recibir orden parcialmente
supabase.rpc('partial_receive_purchase_order', {
  p_purchase_order_id: 'uuid',
  p_items: [
    { product_id: 'uuid', received_quantity: 5 }
  ]
})

// Validar límite de crédito
supabase.rpc('check_supplier_credit_limit', {
  p_supplier_id: 'uuid',
  p_order_total: 5000
})

// Ver items pendientes
supabase.rpc('get_purchase_order_pending_items', {
  p_purchase_order_id: 'uuid'
})

// Recalcular todos los balances (mantenimiento)
supabase.rpc('recalculate_all_supplier_balances')
```

## 🔐 Seguridad y Performance

- ✅ Todas las funciones usan `SECURITY DEFINER`
- ✅ RLS (Row Level Security) mantiene aislamiento por organización
- ✅ Índices optimizados para consultas frecuentes
- ✅ Triggers eficientes sin bucles infinitos
- ✅ Transacciones ACID para integridad de datos

## 🐛 Resolución de Problemas

### Error: "Function does not exist"
**Solución:** Asegúrate de ejecutar las migraciones en orden

### Balance del proveedor no actualiza
**Solución:** Ejecuta manualmente:
```sql
SELECT recalculate_all_supplier_balances();
```

### Recepción no actualiza stock
**Solución:** Verifica que existe la tabla `stock_movements` (debe existir por migración previa)

### Validación de crédito no funciona
**Solución:** Verifica que el proveedor tenga `credit_limit` mayor a 0

## 📞 Próximos Pasos Sugeridos

1. **Reportes de Compras:**
   - Análisis por proveedor
   - Histórico de precios
   - Lead time real vs estimado

2. **Notificaciones:**
   - Alertas de pagos vencidos
   - Órdenes retrasadas
   - Límites de crédito

3. **Automatización:**
   - Órdenes automáticas por punto de reorden
   - Sugerencias basadas en histórico
   - Comparación de precios entre proveedores

4. **Integración con Facturación:**
   - Generar factura automática al recibir orden
   - Registro de impuestos
   - Generación de PDFs

## 📚 Documentación Adicional

- [Suppliers.sql](../../supabase/suppliers.sql) - Schema inicial
- [Stock Movements](../../supabase/stock_movements.sql) - Sistema de movimientos
- [Supplier Invoices](../../supabase/migrations/20260131_supplier_invoices_payments.sql) - Facturas y pagos

---

**¡Implementación completada exitosamente! 🎉**

Si tienes alguna duda o necesitas más funcionalidades, no dudes en preguntar.
