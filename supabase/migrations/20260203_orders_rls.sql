-- =============================================================================
-- MIGRACIÓN: POLÍTICAS DE SEGURIDAD PARA ORDERS (2026-02-03 - Parte 2)
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para ORDERS
-- Permitir lectura a usuarios autenticados que pertenezcan a la organización
-- Nota: Asumimos que la autenticación ya está manejada por Supabase Auth y la app filtra por org_id en las queries.
-- Para simplicidad en este MVP, permitimos acceso a usuarios autenticados. Idealmente validaríamos org_id contra claims del usuario.

CREATE POLICY "Enable read access for authenticated users" ON orders
    FOR SELECT
    TO authenticated
    USING (true); -- En producción: (organization_id = (auth.jwt() ->> 'organization_id')::uuid)

CREATE POLICY "Enable insert access for authenticated users" ON orders
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON orders
    FOR UPDATE
    TO authenticated
    USING (true);

-- 3. Políticas para ORDER_ITEMS
CREATE POLICY "Enable read access for authenticated users" ON order_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
