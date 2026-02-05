-- =============================================================================
-- MIGRACIÓN: Sistema de Notificaciones
-- Fecha: 2026-02-05
-- Descripción: Implementa sistema completo de notificaciones en tiempo real
-- =============================================================================

-- 1. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('stock_low', 'new_order', 'payment_received', 'invoice_due', 'system')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- 3. Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- 5. Función para notificaciones de stock bajo
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo notificar si el stock cruza el umbral de 10
  IF NEW.stock <= 10 AND (OLD.stock IS NULL OR OLD.stock > 10) THEN
    INSERT INTO notifications (organization_id, type, title, message, data)
    VALUES (
      NEW.organization_id,
      'stock_low',
      'Stock Bajo',
      'El producto "' || NEW.name || '" tiene stock bajo (' || NEW.stock || ' unidades)',
      jsonb_build_object(
        'product_id', NEW.id,
        'product_name', NEW.name,
        'stock', NEW.stock,
        'sku', NEW.sku
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para stock bajo
DROP TRIGGER IF EXISTS trigger_low_stock ON products;
CREATE TRIGGER trigger_low_stock
AFTER UPDATE OF stock ON products
FOR EACH ROW
EXECUTE FUNCTION notify_low_stock();

-- 7. Función para notificaciones de nuevos pedidos
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
BEGIN
  -- Obtener nombre del cliente
  SELECT name INTO v_customer_name
  FROM customers
  WHERE id = NEW.customer_id;

  INSERT INTO notifications (organization_id, type, title, message, data)
  VALUES (
    NEW.organization_id,
    'new_order',
    'Nuevo Pedido',
    'Nuevo pedido de ' || COALESCE(v_customer_name, 'Cliente') || ' por $' || NEW.total::TEXT,
    jsonb_build_object(
      'order_id', NEW.id,
      'customer_id', NEW.customer_id,
      'customer_name', v_customer_name,
      'total', NEW.total
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para nuevos pedidos (si existe tabla orders)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    DROP TRIGGER IF EXISTS trigger_new_order ON orders;
    CREATE TRIGGER trigger_new_order
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_order();
  END IF;
END $$;

-- 9. Función para notificaciones de pagos recibidos
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
BEGIN
  -- Solo notificar pagos significativos (> $1000)
  IF NEW.amount >= 1000 THEN
    SELECT name INTO v_customer_name
    FROM customers
    WHERE id = NEW.customer_id;

    INSERT INTO notifications (organization_id, type, title, message, data)
    VALUES (
      NEW.organization_id,
      'payment_received',
      'Pago Recibido',
      'Pago de $' || NEW.amount::TEXT || ' recibido de ' || COALESCE(v_customer_name, 'Cliente'),
      jsonb_build_object(
        'payment_id', NEW.id,
        'customer_id', NEW.customer_id,
        'customer_name', v_customer_name,
        'amount', NEW.amount
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Trigger para pagos recibidos (si existe tabla customer_payments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_payments') THEN
    DROP TRIGGER IF EXISTS trigger_payment_received ON customer_payments;
    CREATE TRIGGER trigger_payment_received
    AFTER INSERT ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION notify_payment_received();
  END IF;
END $$;

-- 11. Función helper para crear notificaciones manualmente
CREATE OR REPLACE FUNCTION create_notification(
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_user_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (organization_id, user_id, type, title, message, data)
  VALUES (p_organization_id, p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Función para marcar todas como leídas
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_organization_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE organization_id = p_organization_id
    AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Función para limpiar notificaciones antiguas (más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND read = true;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE notifications IS 'Almacena notificaciones del sistema para usuarios';
COMMENT ON COLUMN notifications.type IS 'Tipo de notificación: stock_low, new_order, payment_received, invoice_due, system';
COMMENT ON COLUMN notifications.data IS 'Datos adicionales en formato JSON para contexto de la notificación';
