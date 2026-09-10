-- V18 — detalle_programaciones.semana: de 1..5 (semana del mes) a semana calendario ISO
-- Basado en fecha. Para filas existentes, recalcula con EXTRACT(WEEK) que en PG es ISO.
UPDATE detalle_programaciones
SET semana = EXTRACT(WEEK FROM fecha)::int
WHERE semana BETWEEN 1 AND 5;
