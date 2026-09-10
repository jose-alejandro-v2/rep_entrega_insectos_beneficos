-- V19__create_requerimiento_lotes_plagas.sql
-- Tablas pivote para selección múltiple de lotes y plagas en requerimientos.
-- Cada requerimiento puede tener N lotes y N plagas (separados por comma en UI,
-- tablas pivote en BD para integridad referencial).
-- Las columnas lote_id/plaga_id en la tabla requerimientos se mantienen por
-- compatibilidad (lote/plaga primario del legacy).

CREATE TABLE requerimiento_lotes (
    id BIGSERIAL PRIMARY KEY,
    requerimiento_id BIGINT NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
    lote_id BIGINT NOT NULL REFERENCES lotes(id),
    UNIQUE(requerimiento_id, lote_id)
);

CREATE TABLE requerimiento_plagas (
    id BIGSERIAL PRIMARY KEY,
    requerimiento_id BIGINT NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
    plaga_id BIGINT NOT NULL REFERENCES plagas(id),
    UNIQUE(requerimiento_id, plaga_id)
);

CREATE INDEX idx_requerimiento_lotes_requerimiento ON requerimiento_lotes(requerimiento_id);
CREATE INDEX idx_requerimiento_plagas_requerimiento ON requerimiento_plagas(requerimiento_id);
