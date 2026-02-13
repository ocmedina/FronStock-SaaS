# 🧪 Cómo Probar el Sistema Offline

## ⚠️ IMPORTANTE: El problema que tuviste

Si ves "Sin conexión a Internet" en la pantalla de login (como en tu screenshot), es porque el modo **Offline en DevTools bloquea TODO, incluso localhost**.

---

## ✅ Forma Correcta de Probar

### **Método 1: Bloquear solo Supabase** (Más realista)

1. **NO USES** "Offline" en Network tab
2. En su lugar:
   - DevTools → Tab **Network** 
   - Network → **Online** (importante!)
   - Click derecho en cualquier request
   - Select **"Block request domain"**
   - Agrega: `*.supabase.co`
   - Agrega: `supabase.co`

3. Ahora localhost funciona, pero Supabase no
4. ✅ Esto simula exactamente lo que pasa cuando se cae Supabase

---

### **Método 2: Probar después de login**

```
PASO 1: Login con conexión
├─ Network → Online
├─ Inicia sesión
└─ Entra al Dashboard

PASO 2: Ahora sí, desconectar
├─ DevTools → Network → Offline
├─ Ve a Ventas
├─ Haz ventas (funcionan!)
└─ Network → Online (se sincronizan!)
```

---

### **Método 3: Desconectar WiFi Real** (Ideal)

1. Loguéate normalmente
2. Entra al Dashboard → Ventas
3. **Desconecta tu WiFi físicamente**
4. ✅ Banner rojo: "Sin conexión"
5. Haz 2-3 ventas
6. ✅ Toast: "Venta guardada offline"
7. **Reconecta WiFi**
8. ✅ Banner azul: "Sincronizando..."
9. ✅ Banner verde: "Sincronizado"

---

## 🎯 Tests Específicos

### **Test 1: Venta Offline Básica**

```bash
✓ Login (con internet)
✓ Ir a Ventas
✓ Esperar 5 segundos (cachea productos)
✓ [Network → Offline] o [Desconectar WiFi]
✓ Buscar producto → Debería funcionar
✓ Agregar al carrito
✓ Procesar venta
✓ Toast: "Venta guardada offline"
✓ [Network → Online] o [Reconectar WiFi]
✓ Banner: "Sincronizando..."
✓ Banner: "Todas las ventas sincronizadas"
```

---

### **Test 2: Caché de Productos**

```bash
✓ Login (con internet)
✓ Ir a Ventas
✓ Abrir DevTools → Application → IndexedDB
✓ Buscar "FrontStockOfflineDB"
✓ Ver tabla "products"
✓ Deberías ver tus productos cacheados
```

---

### **Test 3: Panel de Debug**

```bash
✓ Ir a Configuración
✓ Tab "Sistema Offline"
✓ Ver estadísticas:
  - Productos en caché
  - Clientes en caché
  - Ventas pendientes
✓ Hacer ventas offline
✓ Refrescar panel
✓ Ver ventas listadas como "pending_sync"
✓ Click "Sincronizar ahora"
✓ Ventas cambian a "synced"
```

---

## ❌ Errores Comunes

### Error 1: "No hay productos en caché"
**Causa:** Te desconectaste antes de que termine de cachear
**Solución:** 
1. Conectate
2. Ve a Configuración → Sistema Offline
3. Click "Actualizar Caché"
4. Espera 10 segundos
5. Ahora desconectate

---

### Error 2: "Página en blanco en login"
**Causa:** Modo Offline en DevTools
**Solución:** 
1. Network → **Online**
2. Recarga página
3. Loguéate
4. Ahora sí desconecta

---

### Error 3: "Ventas no se sincronizan"
**Causa:** Supabase RPC no está funcionando
**Solución:**
1. Verificar consola de errores
2. Ir a Panel Offline
3. Ver mensaje de error específico
4. Verificar que el RPC 'process_sale' existe en Supabase

---

## 🔍 Debugging

### Ver qué hay en IndexedDB:

```javascript
// En consola del navegador:
async function debugOfflineDB() {
  const { offlineDB } = await import('/src/lib/offline/db.ts');
  
  const products = await offlineDB.products.toArray();
  console.log('Productos en caché:', products.length);
  
  const pending = await offlineDB.pendingSales
    .where('status').equals('pending_sync')
    .toArray();
  console.log('Ventas pendientes:', pending);
  
  return { products, pending };
}

debugOfflineDB();
```

---

### Forzar sincronización desde consola:

```javascript
// En consola:
document.querySelector('button:has-text("Sincronizar ahora")')?.click();
```

---

## 📊 Verificar que funcionó

### 1. Ver en Supabase:
- Ir a Supabase Dashboard
- Tabla `sales`
- Las ventas offline aparecen con sale_number secuencial
- `created_at` es cuando se sincronizó, no cuando se hizo offline

### 2. Ver en IndexedDB:
- DevTools → Application → IndexedDB
- `FrontStockOfflineDB`
- Tabla `pendingSales`
- Status debe ser "synced"

### 3. Ver en el panel:
- Configuración → Sistema Offline
- "Ventas Sync" debe incrementarse
- "Ventas Pendientes" debe ser 0

---

## 🎓 Para usuarios finales

No necesitan saber nada de esto. Solo:

```
🔴 Rojo = sin internet, seguí vendiendo
🟢 Verde = todo bien, sincronizado
```

---

## 💡 Tips

1. **Siempre loguéate WITH internet primero**
2. No uses "Offline" en DevTools para login
3. Espera 5-10 segundos después de login (para que cachee)
4. Bloquear solo Supabase es más realista que "Offline" completo
5. El panel de Debug es tu mejor amigo

---

## 🆘 Si nada funciona

1. Borra toda la base de datos local:
   ```javascript
   indexedDB.deleteDatabase('FrontStockOfflineDB');
   ```

2. Recarga la app

3. Loguéate nuevamente

4. Espera que cachee

5. Prueba nuevamente

---

**✅ RECUERDA:** El sistema es un **prototipo funcional**. Si encuentras bugs, es normal. Anótalos y los arreglamos juntos.
