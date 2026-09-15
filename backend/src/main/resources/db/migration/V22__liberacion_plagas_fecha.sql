-- V22__liberacion_plagas_fecha.sql
-- Persistencia de plagas por liberación (tabla pivote) y fechaLiberacion editable.

-- Tabla pivote: relación N:N entre liberaciones y plagas.
CREATE TABLE IF NOT EXISTS liberacion_plagas (
    liberacion_id BIGINT NOT NULL REFERENCES liberaciones(id) ON DELETE CASCADE,
    plaga_id BIGINT NOT NULL REFERENCES plagas(id),
    PRIMARY KEY (liberacion_id, plaga_id)
);

CREATE INDEX idx_liberacion_plagas_plaga ON liberacion_plagas(plaga_id);
