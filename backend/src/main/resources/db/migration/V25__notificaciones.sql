-- V25: Tabla de notificaciones in-app (HITO-018 — ADR-A004)
-- Persiste notificaciones para el centro de notificaciones del mobile.
-- Cada evento de push/email también crea una fila aquí para que el usuario
-- pueda consultar su historial de notificaciones.
CREATE TABLE notificaciones (
    id              BIGSERIAL    PRIMARY KEY,
    usuario_id      BIGINT       NOT NULL REFERENCES usuarios(id),
    titulo          VARCHAR(200) NOT NULL,
    mensaje         TEXT         NOT NULL,
    tipo            VARCHAR(50)  NOT NULL,  -- PROGRAMACION_PUBLICADA, REQUERIMIENTO_CREADO, CAMBIO_ESTADO, REQUERIMIENTO_ENTREGADO
    leido           BOOLEAN      NOT NULL DEFAULT FALSE,
    referencia_tipo VARCHAR(50),            -- PROGRAMACION, REQUERIMIENTO (tabla de origen)
    referencia_id   BIGINT,                -- ID del registro de origen
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_usuario_id       ON notificaciones (usuario_id);
CREATE INDEX idx_notificaciones_usuario_no_leido ON notificaciones (usuario_id) WHERE leido = FALSE;
CREATE INDEX idx_notificaciones_fecha_creacion   ON notificaciones (fecha_creacion DESC);
