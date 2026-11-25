-- Inventario sintético para la prueba de rampa (solo base local desechable mercado-k6-db).
-- Una fila por producto publicado: stock físico 0-200, sin reservas.
INSERT INTO inventarios (id, producto_id, puesto_id, stock_fisico, stock_reservado)
SELECT gen_random_uuid(), p.id, p."puestoId", floor(random()*201)::int, 0 FROM productos p
ON CONFLICT DO NOTHING;
