-- =============================================================================
-- MIGRACIÓN: INTEGRACIÓN DE PEDIDOS CON RUTAS B2B (2026-02-12)
-- =============================================================================
-- Vincula orders con routes para gestión logística completa

-- 1. Agregar campos de ruta a orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS route_stop_id uuid REFERENCES route_stops(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scheduled_date date, -- Fecha programada de entrega
ADD COLUMN IF NOT EXISTS scheduled_time_slot text, -- Franja horaria: '08:00-10:00', '10:00-12:00', etc
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0 CHECK (priority >= 0 AND priority <= 3), -- 0=normal, 1=alta, 2=urgente, 3=crítica
ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IN ('counter', 'delivery')); -- Tipo de servicio del pedido

-- 2. Extender delivery_status con nuevos estados B2B
-- Estados: draft → confirmed → preparing → packed → assigned_to_route → out_for_delivery → delivered → invoiced
-- Eliminar el CHECK constraint anterior si existe (para agregar nuevos estados)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_status_check 
CHECK (delivery_status IN (
    'draft', 'pending', 'confirmed', 'preparing', 'packed', 
    'assigned_to_route', 'ready', 'out_for_delivery', 'delivered', 
    'cancelled', 'returned'
));

-- 3. Comentarios
COMMENT ON COLUMN orders.route_id IS 'Ruta a la que está asignado este pedido';
COMMENT ON COLUMN orders.route_stop_id IS 'Parada específica dentro de la ruta';
COMMENT ON COLUMN orders.scheduled_date IS 'Fecha programada para la entrega';
COMMENT ON COLUMN orders.scheduled_time_slot IS 'Franja horaria de entrega programada';
COMMENT ON COLUMN orders.priority IS 'Prioridad: 0=normal, 1=alta, 2=urgente, 3=crítica';
COMMENT ON COLUMN orders.service_type IS 'Tipo: counter (mostrador rápido) o delivery (reparto planificado)';

-- 4. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_orders_route ON orders(route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_route_stop ON orders(route_stop_id) WHERE route_stop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON orders(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority DESC) WHERE priority > 0;
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);

-- Índice compuesto para pedidos pendientes de asignar a ruta
CREATE INDEX IF NOT EXISTS idx_orders_pending_route 
ON orders(organization_id, service_type, scheduled_date, priority DESC) 
WHERE delivery_status IN ('confirmed', 'preparing', 'packed') 
  AND route_id IS NULL 
  AND service_type = 'delivery';

-- 5. Función: Asignar múltiples pedidos a una ruta
CREATE OR REPLACE FUNCTION assign_orders_to_route(
    p_order_ids uuid[],
    p_route_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assigned_count integer := 0;
    v_route_exists boolean;
    v_order_id uuid;
BEGIN
    -- Validar que la ruta existe
    SELECT EXISTS(SELECT 1 FROM routes WHERE id = p_route_id) INTO v_route_exists;
    
    IF NOT v_route_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La ruta no existe'
        );
    END IF;

    -- Asignar cada pedido
    FOREACH v_order_id IN ARRAY p_order_ids
    LOOP
        UPDATE orders
        SET 
            route_id = p_route_id,
            delivery_status = CASE 
                WHEN delivery_status IN ('confirmed', 'preparing', 'packed') 
                THEN 'assigned_to_route'
                ELSE delivery_status
            END
        WHERE id = v_order_id
          AND (route_id IS NULL OR route_id = p_route_id); -- Evitar reasignar si ya está en otra ruta
        
        IF FOUND THEN
            v_assigned_count := v_assigned_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'assigned_count', v_assigned_count
    );
END;
$$;

COMMENT ON FUNCTION assign_orders_to_route IS 'Asigna múltiples pedidos a una ruta específica';

-- 6. Función: Obtener pedidos sin asignar para una zona y fecha
CREATE OR REPLACE FUNCTION get_unassigned_orders(
    p_org_id uuid,
    p_zone text DEFAULT NULL,
    p_scheduled_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    order_id uuid,
    customer_id uuid,
    customer_name text,
    customer_address text,
    customer_zone text,
    total numeric,
    priority integer,
    scheduled_time_slot text,
    delivery_status text,
    items_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as order_id,
        o.customer_id,
        c.name as customer_name,
        COALESCE(o.delivery_address, c.address) as customer_address,
        c.zone as customer_zone,
        o.total,
        o.priority,
        o.scheduled_time_slot,
        o.delivery_status,
        COUNT(oi.id) as items_count
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.organization_id = p_org_id
      AND o.service_type = 'delivery'
      AND o.route_id IS NULL
      AND o.delivery_status IN ('confirmed', 'preparing', 'packed')
      AND (p_scheduled_date IS NULL OR o.scheduled_date = p_scheduled_date)
      AND (p_zone IS NULL OR c.zone = p_zone)
    GROUP BY o.id, c.name, c.address, c.zone
    ORDER BY o.priority DESC, o.scheduled_time_slot NULLS LAST, o.created_at;
END;
$$;

COMMENT ON FUNCTION get_unassigned_orders IS 'Obtiene pedidos delivery sin asignar a ruta, filtrados por zona y fecha';

-- 7. Vista: Resumen de pedidos por ruta
CREATE OR REPLACE VIEW orders_by_route AS
SELECT 
    r.id as route_id,
    r.name as route_name,
    r.created_at::date as route_date,
    r.status as route_status,
    COUNT(o.id) as orders_count,
    SUM(o.total) as total_value,
    COUNT(o.id) FILTER (WHERE o.delivery_status = 'delivered') as delivered_count,
    COUNT(o.id) FILTER (WHERE o.delivery_status IN ('assigned_to_route', 'out_for_delivery')) as pending_count,
    ARRAY_AGG(o.id ORDER BY rs.stop_order) FILTER (WHERE o.id IS NOT NULL) as order_ids,
    r.organization_id
FROM routes r
LEFT JOIN orders o ON o.route_id = r.id
LEFT JOIN route_stops rs ON o.route_stop_id = rs.id
GROUP BY r.id, r.name, r.created_at, r.status, r.organization_id;

COMMENT ON VIEW orders_by_route IS 'Resumen estadístico de pedidos agrupados por ruta';

-- 8. Trigger: Auto-asignar service_type basado en customer
CREATE OR REPLACE FUNCTION auto_set_order_service_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no tiene service_type, inferirlo del cliente
    IF NEW.service_type IS NULL AND NEW.customer_id IS NOT NULL THEN
        SELECT 
            CASE 
                WHEN c.service_type = 'counter' THEN 'counter'
                WHEN c.service_type IN ('delivery', 'both') AND NEW.delivery_address IS NOT NULL THEN 'delivery'
                ELSE 'counter' -- Por defecto mostrador si no está claro
            END
        INTO NEW.service_type
        FROM customers c
        WHERE c.id = NEW.customer_id;
    END IF;
    
    -- Si aún es NULL, usar delivery si tiene dirección, sino counter
    IF NEW.service_type IS NULL THEN
        NEW.service_type := CASE 
            WHEN NEW.delivery_address IS NOT NULL THEN 'delivery'
            ELSE 'counter'
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_set_order_service_type ON orders;
CREATE TRIGGER trigger_auto_set_order_service_type
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_order_service_type();

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION assign_orders_to_route TO authenticated;
GRANT EXECUTE ON FUNCTION get_unassigned_orders TO authenticated;
