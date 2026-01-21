-- Agregar columna reference a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS reference text;

-- Comentario para documentación
COMMENT ON COLUMN customers.reference IS 'Referencia de dirección o notas para rutas de entrega';
