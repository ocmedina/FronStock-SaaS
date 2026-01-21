-- Actualización de la tabla products para incluir nuevos campos
-- Ejecutar en Supabase SQL Editor

-- Agregar columna de código de barras
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Agregar columna de precio de costo
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);

-- Agregar columna de precio mayorista
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2);

-- Agregar columna de stock mínimo para alertas
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock INTEGER;

-- Agregar columna de descripción
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Crear índice para búsqueda por código de barras
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Crear índice para búsqueda por SKU
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Comentarios en las columnas (documentación)
COMMENT ON COLUMN products.barcode IS 'Código de barras EAN/UPC del producto';
COMMENT ON COLUMN products.cost_price IS 'Precio de costo/compra del producto';
COMMENT ON COLUMN products.wholesale_price IS 'Precio de venta mayorista';
COMMENT ON COLUMN products.min_stock IS 'Stock mínimo para alertas de reposición';
COMMENT ON COLUMN products.description IS 'Descripción detallada del producto';
COMMENT ON COLUMN products.price IS 'Precio de venta minorista';
