-- =============================================================================
-- MIGRACIÓN DE MANTENIMIENTO: Campos de auditoría
-- =============================================================================
-- El sistema intenta actualizar 'updated_at' al guardar cambios.
-- Si esta columna falta, la edición fallará.
-- =============================================================================

-- 1. Agregar updated_at a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Agregar updated_at a customers (por si acaso también falta)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Trigger para actualizar updated_at automáticamente (opcional pero recomendado)
-- Crea la función si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Trigger para customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
