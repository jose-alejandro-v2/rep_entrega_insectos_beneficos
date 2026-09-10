-- V20__fotos_requerimiento_contenido_bytea.sql
-- Almacenamiento de imágenes en BD (patrón BYTEA, igual que repo_control_equipos_apilamiento_v2).
-- Se agrega la columna `contenido` con los bytes crudos de la imagen (JPEG/PNG).
-- Es NULLABLE para no romper las fotos legacy V11 (que guardaban la ruta en
-- filesystem); las nuevas fotos se guardan en BD.
-- La columna `ruta` queda como metadata de respaldo (sin NOT NULL nuevo).

ALTER TABLE fotos_requerimiento
    ADD COLUMN contenido BYTEA;