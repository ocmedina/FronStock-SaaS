-- =============================================================================
-- MIGRACIÓN: SISTEMA DE RUTAS Y PLANIFICACIÓN (2026-02-12)
-- =============================================================================
-- Crea tablas para gestionar rutas de reparto planificadas y sus paradas

-- 1. Tabla: ROUTES (Rutas planificadas)
CREATE TABLE IF NOT EXISTS routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identificación
    name text NOT NULL, -- "Zona Norte - Lunes", "Ruta Centro - Martes"
    code text, -- Código corto: "ZN-L", "RC-M" (opcional)
    
    -- Configuración
    zone text, -- "norte", "sur", "este", "oeste", "centro"
    visit_day integer, -- 0=Domingo, 1=Lunes, 2=Martes ... 6=Sábado
    
    -- Asignación
    driver_id uuid REFERENCES profiles(id), -- Repartidor asignado
    vehicle_info text, -- "Camión Iveco AA123BB", etc (opcional)
    
    -- Estado y ejecución
    status text DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
    started_at timestamptz,
    completed_at timestamptz,
    
    -- Métricas
    estimated_duration_mins integer, -- Duración estimada en minutos
    total_distance_km numeric(10,2), -- Distancia total en km
    total_stops integer DEFAULT 0, -- Total de paradas
    
    -- Notas
    notes text,
    
    -- Auditoría
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES profiles(id)
);

-- Índices para routes
CREATE INDEX IF NOT EXISTS idx_routes_org ON routes(organization_id);
CREATE INDEX IF NOT EXISTS idx_routes_driver ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_visit_day ON routes(visit_day);
CREATE INDEX IF NOT EXISTS idx_routes_zone ON routes(zone);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(started_at) WHERE started_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE routes IS 'Rutas de reparto planificadas';
COMMENT ON COLUMN routes.visit_day IS '0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado';
COMMENT ON COLUMN routes.status IS 'planned: Planificada | in_progress: En ejecución | completed: Completada | cancelled: Cancelada';

-- 2. Tabla: ROUTE_STOPS (Paradas de la ruta)
CREATE TABLE IF NOT EXISTS route_stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Orden y timing
    stop_order integer NOT NULL, -- 1, 2, 3... (orden de visita)
    estimated_arrival time, -- 08:00, 08:30, 09:00...
    estimated_duration_mins integer DEFAULT 15, -- Tiempo estimado en la parada
    
    -- Ejecución real
    visited_at timestamptz, -- Timestamp real de visita
    visit_duration_mins integer, -- Duración real
    
    -- Resultado de la visita
    visit_status text DEFAULT 'pending', -- 'pending', 'visited', 'not_home', 'closed', 'skipped'
    sale_id uuid REFERENCES sales(id), -- Venta realizada (si hubo)
    
    -- Ubicación (snapshot al momento de crear la ruta)
    address_snapshot text, -- Dirección en ese momento
    lat_snapshot double precision,
    lng_snapshot double precision,
    
    -- Notas
    visit_notes text, -- "No estaba", "Cerrado por vacaciones", "Pidió volver mañana"
    internal_notes text, -- Notas para uso interno
    
    -- Auditoría
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para route_stops
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_customer ON route_stops(customer_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sale ON route_stops(sale_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON route_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON route_stops(visit_status);

-- Constraint: stop_order único por ruta
CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_unique_order 
ON route_stops(route_id, stop_order);

COMMENT ON TABLE route_stops IS 'Paradas individuales dentro de una ruta';
COMMENT ON COLUMN route_stops.visit_status IS 'pending: Pendiente | visited: Visitado | not_home: No estaba | closed: Cerrado | skipped: Omitido';

-- 3. Función: Crear ruta automática desde clientes
CREATE OR REPLACE FUNCTION create_route_from_customers(
    p_org_id uuid,
    p_route_name text,
    p_zone text DEFAULT NULL,
    p_visit_day integer DEFAULT NULL,
    p_driver_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_route_id uuid;
    v_customer record;
    v_stop_order integer := 1;
BEGIN
    -- Crear la ruta
    INSERT INTO routes (
        organization_id,
        name,
        zone,
        visit_day,
        driver_id,
        status
    ) VALUES (
        p_org_id,
        p_route_name,
        p_zone,
        p_visit_day,
        p_driver_id,
        'planned'
    ) RETURNING id INTO v_route_id;
    
    -- Agregar clientes como paradas (ordenados por route_order)
    FOR v_customer IN 
        SELECT id, address, lat, lng, preferred_visit_time
        FROM customers
        WHERE organization_id = p_org_id
          AND is_active = true
          AND (p_zone IS NULL OR zone = p_zone)
          AND (p_visit_day IS NULL OR visit_day = p_visit_day)
        ORDER BY route_order NULLS LAST, name
    LOOP
        INSERT INTO route_stops (
            route_id,
            customer_id,
            stop_order,
            estimated_arrival,
            address_snapshot,
            lat_snapshot,
            lng_snapshot
        ) VALUES (
            v_route_id,
            v_customer.id,
            v_stop_order,
            v_customer.preferred_visit_time,
            v_customer.address,
            v_customer.lat,
            v_customer.lng
        );
        
        v_stop_order := v_stop_order + 1;
    END LOOP;
    
    -- Actualizar total de paradas
    UPDATE routes
    SET total_stops = v_stop_order - 1
    WHERE id = v_route_id;
    
    RETURN v_route_id;
END;
$$;

COMMENT ON FUNCTION create_route_from_customers IS 'Crea una ruta automáticamente con los clientes filtrados por zona/día';

-- 4. Función: Iniciar ruta
CREATE OR REPLACE FUNCTION start_route(p_route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE routes
    SET 
        status = 'in_progress',
        started_at = now(),
        updated_at = now()
    WHERE id = p_route_id
      AND status = 'planned';
    
    RETURN FOUND;
END;
$$;

-- 5. Función: Finalizar ruta
CREATE OR REPLACE FUNCTION complete_route(p_route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE routes
    SET 
        status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_route_id
      AND status = 'in_progress';
    
    RETURN FOUND;
END;
$$;

-- 6. Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_routes_updated_at ON routes;
CREATE TRIGGER trigger_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_route_timestamp();

DROP TRIGGER IF EXISTS trigger_route_stops_updated_at ON route_stops;
CREATE TRIGGER trigger_route_stops_updated_at
    BEFORE UPDATE ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_route_timestamp();

-- 7. Vista útil: Rutas activas con detalle
CREATE OR REPLACE VIEW active_routes_summary AS
SELECT 
    r.id,
    r.name,
    r.zone,
    r.visit_day,
    r.status,
    r.started_at,
    r.total_stops,
    p.full_name as driver_name,
    COUNT(rs.id) FILTER (WHERE rs.visit_status = 'visited') as completed_stops,
    COUNT(rs.id) FILTER (WHERE rs.visit_status = 'pending') as pending_stops,
    r.organization_id
FROM routes r
LEFT JOIN profiles p ON r.driver_id = p.id
LEFT JOIN route_stops rs ON r.id = rs.route_id
WHERE r.status IN ('planned', 'in_progress')
GROUP BY r.id, r.name, r.zone, r.visit_day, r.status, r.started_at, r.total_stops, p.full_name, r.organization_id;

COMMENT ON VIEW active_routes_summary IS 'Resumen de rutas activas con progreso';

-- 8. RLS Policies
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Policies para routes
CREATE POLICY "Users can view routes from their organization"
  ON routes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage routes from their organization"
  ON routes FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Policies para route_stops
CREATE POLICY "Users can view route_stops from their organization"
  ON route_stops FOR SELECT
  USING (route_id IN (
    SELECT id FROM routes WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage route_stops from their organization"
  ON route_stops FOR ALL
  USING (route_id IN (
    SELECT id FROM routes WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));
