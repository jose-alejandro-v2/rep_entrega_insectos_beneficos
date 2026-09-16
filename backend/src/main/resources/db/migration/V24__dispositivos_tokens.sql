-- V24__dispositivos_tokens.sql
-- ADR-A004: notificaciones push Firebase Cloud Messaging (FCM).
-- Tabla para registrar los tokens FCM de cada dispositivo por usuario.
-- Un usuario puede tener multiples dispositivos (android/ios/web).

CREATE TABLE dispositivos_tokens (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fcm_token     TEXT NOT NULL,
    platform      VARCHAR(20) NOT NULL DEFAULT 'android',
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unicidad: un token no puede estar duplicado (mismo dispositivo = mismo token).
CREATE UNIQUE INDEX uq_dispositivos_tokens_fcm ON dispositivos_tokens (fcm_token);

-- Buscar tokens activos de un usuario.
CREATE INDEX idx_dispositivos_tokens_usuario ON dispositivos_tokens (usuario_id, activo);

-- Buscar todos los tokens activos (broadcast).
CREATE INDEX idx_dispositivos_tokens_activo ON dispositivos_tokens (activo) WHERE activo = TRUE;
