# ADR-A002 — Módulo Usuarios y Autenticación (1ª vertical)

- **Estado**: Aprobado
- **Fecha**: 2026-08-18
- **Responsable**: Jose Anyarin (validación de negocio) + Orchestrator

## Contexto

Primera vertical funcional implementable: **CRUD de usuarios + autenticación + navegación por perfil**.
El backend está vacío (sin `pom.xml`) y la base de datos no está en Docker aún; por lo tanto esta
vertical incluye el scaffold del backend (marco del HITO-001) y la creación de la infraestructura de BD.

Decisión de negocio validada manualmente que difiere de la especificación v1.1 (que usaba `email` como
login y roles `admin/user`). Este ADR registra los cambios y delega la reconciliación documental de RF.

## Decisiones

### D-AUTH-1 — Login por `usuario` (username); sin email

- **Decisión**: el identificador de login es el campo `usuario VARCHAR(150) UNIQUE NOT NULL`.
  El campo `email` **queda descartado** de la entidad y del proceso de login.
- **Efecto documental**: ajustar RF-001 (login local), RF-026 (unicidad), RF-191 (seed).

### D-AUTH-2 — Tres perfiles con RBAC definido

| Perfil | Alcance |
|---|---|
| `SUPER_ADMIN` | Controla todo: CRUD de cualquier usuario, visibilidad total |
| `ADMIN` | Gestiona usuarios con perfil `ADMIN` y `USUARIO` (no super admin) |
| `USUARIO` | Operación: autenticación, cambio de contraseña (ingreso de su DNI) |

- Navegación tras login por perfil (diseño de home):
  - `USUARIO` → pantalla con 2 botones: **Nuevo Requerimiento** y **Historial de Requerimiento**.
  - `ADMIN` → pantalla con 2 botones: **Programación** y **Solicitud de Requerimientos**.
  - `SUPER_ADMIN` → pantalla con 2 divs: *div1* «Programación + Solicitud de Requerimientos»,
    *div2* «Nuevo Requerimiento + Historial de Requerimiento».

### D-AUTH-3 — Contraseña por defecto al crear usuario

- Todo usuario creado nace con contraseña `00000000` (ocho ceros) hasheada (BCrypt) y
  `debe_cambiar_password = true`.
- Seed inicial (migración V2): **un solo** usuario `SUPER_ADMIN`, `usuario = 'Admin PowerApps'`,
  contraseña `00000000` hasheada, `debe_cambiar_password = true`, `estado = ACTIVO`.

### D-AUTH-4 — Cambio de contraseña obligatorio: nueva = DNI del usuario

- Al primer login con la contraseña por defecto, el sistema **obliga** a cambiar la contraseña.
- La nueva contraseña es el **DNI** del usuario: solo numérico, **máximo 8 dígitos** (los DNI que
  inician con 0 siempre completan 8 dígitos — por eso `VARCHAR(8)` para preservar ceros a la izquierda).
- Tras el cambio: `debe_cambiar_password = false` y se persiste el `dni`.

### D-AUTH-5 — Soft delete + timestamps

- No existe borrado físico. Eliminar un usuario = `estado = INACTIVO` (soft delete).
- La entidad incluye: `created_at`, `updated_at`, `last_login_at`, `creado_por` (auditoría).

### D-AUTH-6 — Stack/entorno

- Backend Quarkus (Java 17), PostgreSQL 16 en **Docker** (`docker-compose.yml` raíz), Flyway (V1 esquema, V2 seed).
- JWT local (smallrye-jwt), BCrypt (`at.favre.lib:bcrypt`), puerto backend **6113** (mantiene `config.ts` mobile).
- Mobile React Native CLI (sin Expo): react-navigation; pantallas de destino (requerimientos/programación) = placeholders en esta vertical.

## Consecuencias

1. Los RF de `01_especificacion.md` que referencian `email` y roles `admin/user` deben reconciliarse
   (G-DOC-SYNC) en esta misma iteración: RF-001, RF-022, RF-026, RF-191 y la tabla de Roles y Permisos (§6).
2. Cualquier cambio futuro a estos defaults requiere nuevo ADR o reconciliación explícita.
3. Los checks de la vertical son: `mvn test` (backend, vía `mvnw`), `npm run lint`/`npm test` y
   `gradle assembleRelease` (mobile), más `docker-compose up -d` para la BD.

## Referencias

- `AGENTS.md` §8 (coordinación) · `perfil_auditor.md` (gates G-MIG, G-SEC, G-API, G-VAL, G-MOB, G-DOC-SYNC...).
- `01_especificacion.md` (RF-001, RF-018–029, RF-191, §6).
- `mobile/src/services/api.ts`, `mobile/src/config.ts` (base existente).