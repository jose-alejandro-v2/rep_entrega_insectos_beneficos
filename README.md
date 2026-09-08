# Sistema de Control de Entrega de Insectos Benéficos

Sistema de información para el control de stock semanal y la entrega de insectos
benéficos a fundos agrícolas. Cubre la programación semanal de publicación
(EN_PROCESO → PUBLICADO), la proyección mensual, los requerimientos por fundo/lote
(Registrado → Liberado) y el despacho/recepción/liberación en campo con
evidencias fotográficas y acta PDF.

## Stack

| Capa | Tecnología |
|---|---|
| Autenticación | JWT local (tabla `usuarios` + super admin) |
| Backend | Quarkus (Java), PostgreSQL + Flyway, iText PDF, SMTP |
| Mobile | React Native CLI (React Navigation, react-native-paper MD3, React Hook Form + Zod) |
| Web | React 18 + Vite + MUI |
| Infra | Docker / Docker Compose, Nginx, GitHub Actions, VPS Linux |

Decisiones de arquitectura vigentes y decisiones descartadas: ver
[`docs_implementacion/_auditoria/ADRs_AUDITORIA/`](docs_implementacion/_auditoria/ADRs_AUDITORIA/)
(`ADR-A001.md`, `ADR-A002.md`, `ADR-A003.md`).

## Herramientas de documentación

| Herramienta | Uso |
|---|---|
| **Archify** | Generación de diagramas de arquitectura, workflow, sequence, dataflow y lifecycle como HTML interactivo autocontenido |
| **PUML** | Diagramas estáticos UML en `docs_implementacion/_diagramas/` |

Archify está instalado como Agent Skill para OpenCode. Los diagramas generados se guardan en
`docs_implementacion/_diagramas/` y son autocontenidos (HTML interactivo con temas oscuro/claro).

## Estructura del repositorio

```text
backend/      API Quarkus v2 — auth/usuarios bajo /api/v1, login 3 pasos, roles en tabla, programaciones
              (tabla intra-semana Lunes/Jueves reales + Restante), catálogos
              (fundos/variedades/lotes/etapas/plagas/nematodos/patrones), requerimientos,
              fotos de requerimiento, sync offline, cumplimiento de producción,
              despachos/recepciones/liberaciones
              (migraciones V1-V17)
mobile/       App React Native CLI 0.86 / React 19.2.3 — auth v2 (login 3 pasos, URL runtime,
              SecureStore/keychain), módulos Programación (Lunes/Jueves reales + Restante, pull-to-refresh,
              cumplimiento de producción), Requerimientos, Catálogos, fotos de requerimiento
              + hook usePhotoCapture, modo offline (SQLite + outbox + sync) — versión 1.8.0
web/          Frontend React + Vite (pendiente de scaffold)
docs_implementacion/
├── _sdd/                      Especificación, plan, tareas e implementación
├── _perfiles/                 Perfiles de desarrollador y auditor (agentes IA)
├── _auditoria/                Proceso de auditoría y ADRs
├── _diagramas/                Diagramas PUML + PNG
├── _usuario/                  Entregables PPTX/DOCX
├── OPENCode_orquestacion_agentes_proyecto_v2.md
└── transcripcion.md
```

## Estado actual

- **HITO-001 cerrado (2026-08-18) = Infraestructura base**: scaffold backend Quarkus + mobile
  base (auth/navegación) + autenticación JWT local (tabla `usuarios` + super admin).
- **HITO-002 cerrado (2026-08-19) = Auth v2**: login 3 pasos (rol→usuario→DNI), roles en tabla
  (`roles` + `usuarios.rol_id`, Flyway V3), API `/api/v1` + OpenAPI, cambio de contraseña con nuevo
  JWT, SecureStore/keychain + ServerCheck/Settings de URL runtime, Super Admin id=1 inmune
  (ADR-A003). Versión de artefactos: **1.1.0** (32 tests BE · 27 tests MO · APK v2 61.5 MB).
- **HITO-003 cerrado técnicamente (2026-08-19) = UI Vanguard y navegación mobile**: tema con tokens,
  fuentes Poppins, iconos Material Community, componentes base, navegación Home/slot vacío/Catálogos/
  Perfil, Perfil con historial y logout confirmado. Versión de artefactos: **1.2.0**, `versionCode 3`.
- **HITO-004 cerrado (2026-08-21) = Módulo Programación de Stock**: listado por mes, edición con
  restricción de días (lunes/jueves), creación de programaciones (botón "Nuevo"), endpoint
  `POST /api/v1/programaciones` con RBAC y migración V4. Versión de artefactos: **1.3.0**, `versionCode 4`
  (39 tests BE · 63 tests MO).
- **HITO-005 cerrado (2026-08-24) = Módulo de Requerimientos (mobile)**: pantallas de solicitudes
  (panel admin, listado, formulario), nuevo requerimiento con stock en tiempo real, historial y edición
  con alerta de 30h; contrato `ApiClient` del módulo. Versión de artefactos: **1.4.0**, `versionCode 5`
  (77 tests MO).
- **HITO-006/007 cerrados (2026-08-24) = Catálogos agrícolas y de requerimientos**: fundos/variedades/
  lotes normalizados 3NF (V6/V7) y etapas/plagas/nematodos/patrones (V8/V9) con sus endpoints.
- **HITO-008 cerrado (2026-08-25) = Backend de Requerimientos**: migración V10, endpoints
  `/requerimientos` y stock por especie, ciclo de estados, validación de entregas y stock disponible
  (53 tests BE). Sin bump: artefacto mobile en **1.4.0**, `versionCode 5`.
- **HITO-009 cerrado (2026-08-25) = Fix CatalogosScreen**: flakiness en test bajo ejecución paralela,
  resuelto con `--runInBand` (sin bug real).
- **HITO-010 cerrado (2026-08-26) = Fotos backend + mobile API**: migración V11 (`fotos_requerimiento`),
  upload de fotos (max 2, ≤5MB, JPG/PNG, IDOR protection), 11 tests BE; 3 funciones API en mobile + 5 tests.
- **HITO-011 cerrado (2026-08-26) = Wire fotos a screens mobile**: hook `usePhotoCapture` (DRY) e
  integración en Nuevo/Editar/Historial de requerimientos (upload, carga, delete, thumbnails).
  87 tests MO / 18 suites.
- **INC-2 (2026-08-26)**: se quitó la autogeneración de programaciones en el GET — ahora el listado solo
  devuelve las programaciones existentes en BD (la creación se hace manualmente con el botón "Nuevo").
- **HITO-012 cerrado (2026-08-27) = Tabla intra-semana de Programación**: la tabla pasa de 4 semanas fijas
  a una fila por cada Lunes y Jueves reales del mes (variable ~8-9, sin descartar ninguna) + columna
  **Restante** (stock base 5000 − acumulado; puede ser negativo y muestra el excedido en rojo), inputs
  vacíos con valor 0, fondo suave por semana y pull-to-refresh. Migración V12 (`UNIQUE(programacion_id,
  fecha)`, sin columna `dia`). 90 tests MO / 18 suites (versión 1.6.0 / versionCode 7).
- **HITO-013 cerrado (2026-08-30) = Modo Offline Completo**: persistencia SQLite con Drizzle ORM,
  repositories CRUD offline (requerimientos + fotos), motor de sincronización outbox→push→pull,
  UI adaptativa (OfflineBanner, SyncIndicator, SyncToast), hooks (useOnlineStatus, useLiveQuery).
  Suite de testing: 150 tests / 26 suites (0 failures). Corrección de bug en decodificación
  base64url de JWT (`token.ts`). Versión **1.6.1** / versionCode 8.
- **HITO-014 cerrado (2026-09-02) = Módulo de Cumplimiento de Producción**: registro real vs
  programado por semana de programación (papel/sobre). Botón lápiz/lupa en tabla de edición,
  modal de registro y consulta con porcentaje de cumplimiento. Backend: migración V14
  (`cumplimiento_programacion`), entity, repository, DTO, resource con upsert. Offline:
  repository SQLite. Versión **1.7.0** / versionCode 10 (150 tests / 26 suites).
- **Fix V14 (2026-09-03)**: la migración V14 referenciaba tabla `programacion_detalles`
  (inexistente) en vez de `detalle_programaciones` (V4). Flyway abortaba → backend 500 en todos
  los endpoints. Corregido y push `763cd30`.
- **HITO-015 cerrado (2026-09-03) = Flujo Despachos → Recepción → Liberación**: ciclo completo
  de estados APROBADO → ENTREGADO → RECIBIDO → LIBERADO con tablas separadas. Backend: migraciones
  V15-V17 (despachos, recepciones, liberaciones), services, resources, DTOs, 12 tests. Mobile:
  ApiClient + 7 screens (DetalleRequerimiento con acciones contextuales), 3 repos offline,
  SyncManager extendido, offline completo para perfil Usuario. Versión **1.8.0**, versionCode 11
  (150 tests MO / 26 suites · 12 tests BE).
- **Pendientes**: endpoint backend para servir fotos estáticas (requerido para visualización real en `<Image>`),
  validación end-to-end desde mobile contra el backend real, actas PDF, frontend web (React/Vite) y CI/CD
  (GitHub Actions). Ver [`docs_implementacion/_sdd/`](docs_implementacion/_sdd/).

## Base de datos local (desarrollo)

Para desarrollo local se usa PostgreSQL 16 en Docker. Los **parámetros de conexión** están definidos en
[`docker-compose.yml`](docker-compose.yml) (raíz) y en
[`backend/src/main/resources/application.properties`](backend/src/main/resources/application.properties).
Son credenciales de **desarrollo** y no se exponen en este README por seguridad; conéctate a la BD que
levantan esos archivos desde tu gestor (pgAdmin/DBeaver/DataGrip). Las migraciones Flyway `V1..V17`
crean toda la estructura: `usuarios`, `roles`, `fundos`, `variedades`, `lotes`, `etapas_fenologicas`,
`plagas`, `nematodos`, `patrones`, `programaciones`, `requerimientos`, `fotos_requerimiento`,
`sync_log`, `cumplimiento_programacion`, `despachos`, `recepciones` y `liberaciones`.

## Verificación por capa

```text
Backend : mvn test / mvn clean package
Mobile  : npm run lint · npm test · gradle assembleRelease (release cold ≈ 2-6 min)
Web     : npm run lint · npm run build
Docker  : docker-compose build
```

Para agentes de IA (OpenCode): la fuente de verdad operacional es `AGENTS.md`.