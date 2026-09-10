-- V21__liberacion_por_lote.sql
-- Liberación por lote: columna liberado en requerimiento_lotes,
-- papel/sobre por liberación en liberaciones.

-- Marca si un lote ya fue liberado dentro de un requerimiento.
ALTER TABLE requerimiento_lotes ADD COLUMN liberado BOOLEAN NOT NULL DEFAULT FALSE;

-- Presentaciones entregadas por liberación (por lote).
ALTER TABLE liberaciones ADD COLUMN papel_con_postura NUMERIC(10,2);
ALTER TABLE liberaciones ADD COLUMN sobre_con_cascarilla NUMERIC(10,2);
