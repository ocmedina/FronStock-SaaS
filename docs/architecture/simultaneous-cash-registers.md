# Cajas simultáneas

La migración `supabase/migrations/20261011_simultaneous_cash_registers.sql` habilita varias cajas abiertas en paralelo dentro de una organización.

## Modelo

- Cada organización tiene una o más cajas activas en `cash_registers`.
- Cada caja puede tener como máximo una sesión abierta.
- Las sesiones se identifican por `cash_sessions.register_id`.
- Los usuarios pueden asignarse a cajas mediante `cash_register_users`.
- Si una caja no tiene asignaciones, los usuarios de la organización pueden utilizarla.
- Dueños, administradores y encargados pueden utilizar todas las cajas de su organización.

## Aplicación de la migración

Ejecutar la migración en Supabase SQL Editor antes de usar la funcionalidad:

```text
supabase/migrations/20261011_simultaneous_cash_registers.sql
```

La migración:

1. Conserva y crea `Caja Principal` cuando una organización todavía no tiene cajas.
2. Cambia la unicidad de sesiones abiertas de organización a caja.
3. Agrega asignaciones de usuarios por caja con RLS.
4. Agrega `cash_session_id` a los cierres.
5. Expone `open_cash_session_for_register` y `close_cash_session_for_register`.

## Flujo actual

- El prompt de apertura consulta las cajas activas y permite elegir una.
- La pantalla de cierre permite seleccionar una caja.
- El cierre se ejecuta sobre la sesión seleccionada.
- Los cierres nuevos se guardan vinculados a `cash_session_id`.

Las ventas y movimientos históricos mantienen compatibilidad. La asociación de cada venta a la sesión seleccionada debe completarse antes de considerar los totales por caja como definitivos para producción.
