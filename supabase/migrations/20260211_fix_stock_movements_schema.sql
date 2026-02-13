-- Fix: Hacer campos previous_stock y new_stock NULLABLE en stock_movements
-- Estos campos son difíciles de calcular en inserts desde funciones externas

-- Hacer campos opcionales (NULL permitido)
ALTER TABLE stock_movements 
  ALTER COLUMN previous_stock DROP NOT NULL,
  ALTER COLUMN new_stock DROP NOT NULL;

-- Agregar valores por defecto
ALTER TABLE stock_movements 
  ALTER COLUMN previous_stock SET DEFAULT 0,
  ALTER COLUMN new_stock SET DEFAULT 0;

-- Comentarios
COMMENT ON COLUMN stock_movements.previous_stock IS 'Stock anterior (opcional, puede ser NULL si no se calcula)';
COMMENT ON COLUMN stock_movements.new_stock IS 'Stock nuevo (opcional, puede ser NULL si no se calcula)';
