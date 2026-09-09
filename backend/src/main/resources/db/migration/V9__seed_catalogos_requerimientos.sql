-- V9__seed_catalogos_requerimientos.sql
-- Seed de catálogos del módulo de requerimientos (HITO-007).
-- Solo nombre; estado default 'ACTIVO'.
-- Correcciones del usuario: "CUAJA" -> "FLORACIÓN Y CUAJA"; "CRECIMIENTO DE
-- BAYAS" completo; "Lepidópteros larva" -> "LEPIDÓPTEROS LARVA".

INSERT INTO etapas_fenologicas (nombre) VALUES
    ('Formación'),
    ('Post Cosecha'),
    ('Brotación'),
    ('Floración y Cuaja'),
    ('Crecimiento de Bayas'),
    ('Envero'),
    ('Cosecha');

INSERT INTO plagas (nombre) VALUES
    ('Pseudococcidae'),
    ('Trips'),
    ('Arañita Roja'),
    ('Lepidópteros Larva'),
    ('Ácaro Hialino');

INSERT INTO nematodos (nombre) VALUES
    ('Meloidogyne spp.'),
    ('Xiphinema index'),
    ('Longidorus spp.'),
    ('Pratylenchus spp.'),
    ('Tylenchulus semipenetrans');

INSERT INTO patrones (nombre) VALUES
    ('SALT CREEK'),
    ('FREEDOM'),
    ('MGT 101-14'),
    ('MGT 101-15'),
    ('MGT 101-16');
