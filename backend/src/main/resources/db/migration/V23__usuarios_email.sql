-- V23__usuarios_email.sql
-- HITO-018: correo de notificaciones SMTP (Columnas de notificación).
-- Nullable: los usuarios existentes (seed incluido) no tienen correo hasta que
-- el Admin lo cargue desde Catálogos > Usuarios (Campo nuevo). UNIQUE admite
-- multiples NULL en Postgres (varios usuarios sin correo es válido).
ALTER TABLE usuarios ADD COLUMN email VARCHAR(191) NULL;
ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_email UNIQUE (email);