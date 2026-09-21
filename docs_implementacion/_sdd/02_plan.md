# SOFTWARE DEVELOPMENT DOCUMENT (SDD)
# 02_PLAN.md

---

# 1. Objetivo del Plan

Plan del HITO-001 (línea base + vertical 1: usuarios/autenticación) y HITO-002
(auth v2: login 3 pasos + roles en tabla + URL runtime + /api/v1). Define alcance, estrategia,
fases y riesgos antes de tocar código (Ley 1 — análisis previo obligatorio).

---

# 2. Alcance del Desarrollo

## 2.1 Alcance Incluido

- Línea base técnica: scaffold backend Quarkus, PostgreSQL en Docker, autenticación JWT local.
- Vertical 1: CRUD de usuarios (3 perfiles, soft delete) + login por `usuario` + cambio de
  contraseña obligatorio (DNI máx 8) + homes mobile por perfil (ADR-A002).

## 2.2 Alcance Excluido

- Web (React/Vite), CI/CD GitHub Actions, programación de stock, requerimientos reales,
  evidencias fotográficas, actas PDF, SMTP, Nginx/HTTPS, refresh token/revocación, rate limiting.



---

# 3. Estrategia de Implementación

Vertical incremental: BD (Flyway V1/V2) → backend (auth JWT + CRUD + tests) → mobile
(navegación + cambio password + homes). Verificación por capa (Ley 5); auditoría integral
(gate review) antes de cerrar el HITO; commit único coherente.

---

# 4. Arquitectura General

```text
mobile (RN CLI) ──► backend API Quarkus (:6113) ──► PostgreSQL 16 (Docker)
       JWT local                          Flyway V1/V2
```



---

# 5. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Quarkus Java |
| Frontend Android | React Native |
| Frontend Web | React + MUI |
| Base de Datos | PostgreSQL |
| Autenticación | JWT + tabla de usuarios local |
| Seguridad | JWT |
| APIs | REST |
| Reverse Proxy | Nginx |
| Contenedorización | Docker |
| Orquestación Contenedores | Docker Compose |
| Control Versiones | GitHub |
| Gestión Proyecto | GitHub |
| CI/CD | GitHub Actions |
| Generación PDF | iText PDF |
| Almacenamiento Fotografías | Filesystem + rutas en base de datos |
| Infraestructura Cloud | VPS Linux (Hetzner / DigitalOcean) |

---

# 6. Estructura de Módulos

| Código | Módulo |
|---|---|
| MOD-01 | Autenticación (JWT local, login por usuario, cambio de contraseña obligatorio) |
| MOD-02 | Usuarios (CRUD, 3 perfiles, soft delete) |

---

# 7. Fases del Proyecto

| Fase | Objetivo |
|---|---|
| F1 — Línea base + Vertical 1 (HITO-001) | Scaffold backend + BD Docker + auth + CRUD usuarios + homes mobile (CERRADO 2026-08-18) |
| F1.5 — Auth v2 (HITO-002) | Login 3 pasos (Perfil→Usuario→DNI), tabla roles, URL runtime + SecureStore + ServerCheck/Settings, /api/v1 + OpenAPI, APK v2 (EN CURSO 2026-08-19, ADR-A003) |
| F2 — Web + CI/CD | Scaffold web React/Vite + GitHub Actions (pendiente) |
| F3 — Módulos funcionales | Requerimientos, programación, evidencias (pendiente, a coordinar) |

---

# 8. Roadmap General



---

# 9. Ambientes del Sistema

| Ambiente | Objetivo |
|---|---|

---

# 10. Estrategia de Seguridad



---

# 11. Estrategia de Auditoría



---

# 12. Estrategia de Fotografías y Archivos



---

# 13. Estrategia de Reportes PDF



---

# 14. Estrategia KPI y Dashboard



---

# 15. Estrategia QA y Testing



---

# 16. Estrategia DevOps y Despliegue



---

# 17. Escalabilidad Futura



---

# 18. Riesgos del Proyecto

| Riesgo | Impacto |
|---|---|

---

# 19. Dependencias del Proyecto



---

# 20. Consideraciones Finales

# 21. Protocolo de Checks con Tiempos (HITO-002 — Orquestación)

> **Fuente única de la regla**: `OPENCode_orquestacion_agentes_proyecto_v2.md` §17.x
> "Protocolo de tiempos: timebox, corte y continuidad" (puede ampliarse aquí solo con valores
> específicos del HITO). Regla global: **todo comando largo con timebox; si se excede → CORTAR,
> diagnosticar el PORQUÉ, documentar (Ley 5) y pasar al siguiente paso**, salvo pasos bloqueantes.

| # | Chequeo | Comando | Timebox | Si excede el timebox |
|---|---|---|---|---|
| C1 | BD Docker arriba | `docker compose ps` | 30 s | Diagnosticar (`docker compose logs postgres`), documentar, reintentar 1×; si sigue caída → bloquear (BD obligatoria) |
| C2 | Backend compila + tests | `.\mvnw.cmd test` (en `backend/`) | **8 min** (cold con Testcontainers) / 3 min (warm) | Cortar → leer logs/junit reports → documentar causa → decidir: fix rápido (Ley 4) o re-auditar; tests obligatorios para cierre |
| C3 | Backend empaqueta | `.\mvnw.cmd clean package -DskipTests` | 6 min | Cortar → revisar errores Maven → documentar; si el jar no se genera, el artefacto queda "pendiente marcado" (Ley 3) |
| C4 | Lint mobile | `npm run lint` (en `mobile/`) | 2 min | Cortar → leer errores → corregir puntuales o documentar deuda (Ley 5) |
| C5 | Tests mobile | `npm test` (en `mobile/`) | 2 min | Cortar → leer reporte → documentar; test obligatorio para cierre |
| C6 | APK release v2 | `gradlew.bat assembleRelease` (en `mobile/android/`) | **12 min cold** (regla AGENTS §6: APK nuevo con módulo nativo keychain = build OBLIGATORIO; si ya existiera un APK v2 y pasara 3 min → cortar y usar artefacto existente) | Cortar → verificar `app-release.apk` timestamp vs código, diagnóstico (¿keychain ndk?, ¿red Gradle?), documentar; artefacto v2 es evidencia de cierre (G-MOB-BUILD/G-APK) |
| C7 | Docs sincronizadas (G-DOC-SYNC) | `grep` versión en package.json/build.gradle/versionHistory/04/05 | 2 min | Corregir discrepancias antes del commit (bloqueante solo al cierre) |
| C8 | Gate review discreción (debido proceso: `npx tsc --noEmit`, `docker compose build`) | discrecional | ≤5 min c/u | Documentar causa y continuar con hallazgo registrado |

Regla de decisión: C2/C5/C8 tienen veredicto **PASS/FAIL** (FAIL bloquea cierre). C3/C6/C7 pueden
dejar **estado pendiente documentado** (Ley 3) y continuar el flujo; se resuelven antes del commit
final. C1/C4 no bloquean el HITO pero se documentan.
