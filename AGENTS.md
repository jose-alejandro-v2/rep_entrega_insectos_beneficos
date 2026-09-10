# AGENTS.md — Sistema de Control de Entrega de Insectos Benéficos

Fuente de verdad **operacional** de este repositorio para agentes de IA (OpenCode).
Define identidad, stack, estructura, comandos de verificación, leyes de desarrollo,
convenciones de documentación y coordinación de agentes.

> Las fuentes funcionales/técnicas de detalle viven en `docs_implementacion/_sdd/`
> y en `docs_implementacion/_perfiles/`; este archivo las **resume y referencia**,
> no las duplica. Si algo contradice a otra fuente, detente y solicita reconciliación;
> nunca resuelvas por prueba/error.

---

## 1. Identidad del proyecto

| Dato | Valor |
|---|---|
| Nombre | Sistema de Control de Entrega de Insectos Benéficos |
| Tipo | Sistema de información para control de stock semanal y entrega de insectos benéficos a fundos agrícolas |
| Repositorio | `C:\repos\rep_entrega_insectos_beneficos` (Windows) |
| Doc. 1.1 | `docs_implementacion/_sdd/01_especificacion.md` (2026-07-13, responsable Jose Anyarin) |

### 1.1 Dominio (resumen del flujo operativo)

1. **Publicación de stock**: programación semanal `EN_PROCESO` → `PUBLICADO` (lunes y jueves);
   papel con postura / sobre con cascarilla de arroz.
2. **Proyección mensual**: base de 5,000 millares + proyecciones adicionales (fundo o lote).
3. **Requerimiento por fundo/lote**: estados de solicitud
   `Registrado → Pendiente → Aprobado → Entregado → Recibido → Liberado`
   (colores `#9E9E9E/#FFC107/#4CAF50/#2196F3/#009688/#9C27B0`).
4. **Despacho, recepción y liberación en campo** con evidencias fotográficas:
   metadatos no editables, JPG/PNG ≤ 5 MB, hasta 2 fotos por requerimiento,
   acta PDF por solicitud.
5. Roles: **admin i+d** (publicación/configuración) y **user sanidad** (operación en campo).

## 2. Stack confirmado (decisiones vigentes — ver `ADR-A001`)

| Capa | Tecnología |
|---|---|
| Autenticación | **JWT local** (tabla `usuarios` + super admin). Descartados: Microsoft Entra ID / OAuth / OIDC / Firebase |
| Backend | Quarkus (Java), PostgreSQL + Flyway, iText PDF, envío de correos SMTP |
| Mobile | React Native CLI + Gradle (NO Expo/EAS), React Navigation, react-native-paper (MD3), React Hook Form + Zod |
| Web | React 18 + Vite + MUI |
| Infra | Docker / Docker Compose, Nginx, GitHub Actions, VPS Linux |
| Almacenamiento evidencias | Filesystem server + metadatos inmutables (sin Firebase) |

## 2.1 Herramientas de documentación

| Herramienta | Uso |
|---|---|
| **Archify** | Generación de diagramas de arquitectura, workflow, sequence, dataflow y lifecycle como HTML interactivo autocontenido |

Archify está instalado globalmente como Agent Skill (`~/.agents/skills/archify/`).
Solo el agente **orchestrator** tiene permisos para usar la skill `archify` (configurado en `opencode.json`).

Comandos útiles desde el orchestrator:
```bash
node ~/.agents/skills/archify/bin/archify.mjs doctor          # Verificar instalación
node ~/.agents/skills/archify/bin/archify.mjs guide "scenario" # Guión de diagrama
```

Los diagramas generados se guardan en `docs_implementacion/_diagramas/`.

## 3. Estructura del repositorio

```text
AGENTS.md
README.md
docker-compose.yml              (proyecto `repo_registro_insectos_beneficos`: postgres:16 + backend + nginx)
nginx/nginx.conf                (proxy 8080 → backend:6101)
backend/                     (API Quarkus v2 — auth/usuarios bajo /api/v1, Flyway V1-V20, Dockerfile multi-stage,
                              89 tests; imagen `repo_registro_insectos_beneficos-backend`, TZ America/Lima)
mobile/                      (React Native CLI 0.86 / React 19.2.3 — auth v2: login 3 pasos,
                              ApiClient.ts + keychain, ServerCheck/Settings, 127 tests)
web/                         (React + Vite — pendiente de scaffold)
docs_implementacion/
├── _perfiles/
│   ├── perfil_desarrollador.md   (Leyes 1-5, metodología SDD)
│   └── perfil_auditor.md          (catálogo de 32 gates, protocolo)
├── _auditoria/
│   ├── README.md                  (proceso de auditoría)
│   └── ADRs_AUDITORIA/
│       └── ADR-A001.md .. ADR-A003.md (decisiones vigentes)
├── _sdd/
│   ├── 01_especificacion.md
│   ├── 02_plan.md
│   ├── 03_tareas.md
│   ├── 04_implementacion.md       (NOTA: singular — fuente del historial de implementación)
│   └── 05_hito_NNN.md             (por cada hito cerrado)
├── _diagramas/                    (PUML + PNG)
├── _usuario/                      (PPTX/DOCX entregables)
├── OPENCode_orquestacion_agentes_proyecto_v2.md
└── transcripcion.md
```

`backend/` es la API Quarkus v2 (auth/usuarios bajo `/api/v1`, login 3 pasos rol→usuario→DNI,
tabla `roles` + `usuarios.rol_id` V3, Super Admin id=1 inmune, 32 tests con Testcontainers,
multi-select lotes/plagas V19 + fotos BYTEA en BD V20, 89 tests con Testcontainers);
`mobile/` es la app RN CLI v2 (`src/services/ApiClient.ts` → `/api/v1`, token y URL en SecureStore
vía keychain, ServerCheck/Settings de URL runtime, login 3 pasos, 127 tests).
**HITO-001 = Infraestructura base** (cerrado) y **HITO-002 = Auth v2** (ver §7).
El backend corre dockerizado (compose proyecto `repo_registro_insectos_beneficos`): postgres:16 +
imagen `repo_registro_insectos_beneficos-backend` (puerto 6101) + nginx (proxy 8080 → 6101),
zona horaria `America/Lima` en el contenedor (HITO-016).

## 4. No usar (prohibido por decisión vigente)

- Microsoft Entra ID / OAuth / OIDC / Firebase (autenticación, evidencias o notificaciones push).
- Expo / EAS para mobile.
- Rebasear el historial con fines estéticos (Ley 2).
- Inventar gates fuera del catálogo del perfil auditor.

> Nota: la palabra "offline" aparece en el perfil desarrollador solo en una nota MVP
> (la capa offline no está implementada). No usar como justificación de nueva dependencia.

## 5. Leyes del desarrollo (resumen — detalle en `perfil_desarrollador.md`)

- **🇱 1 Análisis previo obligatorio**: prohibido trial/error. Plan y verificación definidos antes de tocar código.
- **🇱 2 Estado en disco**: git limpio o estado documentado (`04_implementacion.md` / hito). Nunca depender de memoria.
- **🇱 3 Trazabilidad de versión**: bump + `versionHistory.js` + docs en el mismo commit; artefacto reconstruido o pendiente marcado.
- **🇱 4 Eficiencia / mínimo diff / DRY**: cambios mínimos, patrones existentes primero.
- **🇱 5 Verificación obligatoria**: verificar con comandos reales; fallos pre-existentes documentados en el análisis.

## 6. Comandos de verificación por capa (contrato de comunicación)

```text
Backend : mvn test / mvn clean package          (Quarkus, dentro de backend/)
Mobile  : npm run lint · npm test · gradle assembleRelease · KBuild
```

### Regla de tiempo de build (obligatoria)

> El **protocolo completo de timebox/corte** para TODOS los comandos de verificación
> (mvn test/package, lint, npm test, tsc, docker) está definido en
> `OPENCode_orquestacion_agentes_proyecto_v2.md` §17.x "Protocolo de tiempos: timebox, corte y
> continuidad". Principio: **no quemar tiempo innecesario** — excedido el timebox → CORTAR,
> diagnosticar el porqué, documentar (Ley 5) y pasar a la siguiente tarea.

- `gradle assembleRelease` (release cold ≈ 2-6 min): **si el APK release ya existe**
  (`mobile/android/app/build/outputs/apk/release/app-release.apk`) y el comando supera los
  **3 minutos**, el build debe **detenerse** y pasar a la siguiente tarea sin recompilar.
- El artefacto ya construido se considera **válido como evidencia** (Ley 3: artefacto existente
  marcado como reconstruido; no re-compilar sin necesidad).
- Excepción: si la tarea agrega un **módulo nativo nuevo** (ej. `react-native-keychain`), el APK
  existente queda desactualizado → el build es OBLIGATORIO (timebox 12 min cold; si excede, cortar,
  diagnosticar y marcar artefacto pendiente — Ley 3).
- Si el APK NO existe y la tarea requiere APK, el build es obligatorio (timeout acorde, NO cortar).

Si un comando no está disponible o falla por causa pre-existente, documentarlo en el análisis (Ley 5)
y reportar al Orchestrator; no "arreglarlo" en silencio.

## 7. Hitos e infraestructura actual

- **HITO-001 (cerrado, 2026-08-18) = Infraestructura base**: scaffold backend (Quarkus) +
  mobile base (auth/navegación) + autenticación JWT local (tabla `usuarios` + super admin) +
  convenciones verificadas (versión 1.0.0).
- **HITO-002 (cerrado, 2026-08-19) = Auth v2**: login 3 pasos (rol→usuario→DNI), roles en tabla
  (`roles` + `usuarios.rol_id`, Flyway V3), API `/api/v1` + OpenAPI, cambio de contraseña con nuevo
  JWT, SecureStore/keychain + ServerCheck/Settings de URL runtime, Super Admin id=1 inmune
  (ADR-A003); versión 1.1.0 + APK v2 (32 tests BE · 27 tests MO).
- **HITO-003 (cerrado, 2026-08-19) = UI Vanguard**: tema con tokens, Poppins, componentes base,
  navegación Home/slot/Catálogos/Perfil (versión 1.2.0 / versionCode 3).
- **HITO-004 (cerrado, 2026-08-21) = Módulo Programación de Stock**: listado/edición/creación de
  programaciones + `POST /api/v1/programaciones` + migración V4 (versión 1.3.0 / versionCode 4).
- **HITO-005 (cerrado, 2026-08-24) = Módulo de Requerimientos (mobile)**: pantallas de solicitudes,
  nuevo requerimiento con stock, historial y edición con alerta de 30h; contrato `ApiClient`
  (versión 1.4.0 / versionCode 5; 77 tests MO).
- **HITO-006 (cerrado, 2026-08-24) = Catálogos agrícolas**: fundos/variedades/lotes (6/11/157)
  normalizados 3NF (V6/V7); endpoints `/fundos`, `/variedades`, `/lotes?fundoId=`.
- **HITO-007 (cerrado, 2026-08-24) = Catálogos de requerimientos**: etapas fenológicas (7), plagas
  (5), nematodos (5), patrones (5) (V8/V9); endpoints `/etapas-fenologicas`, `/plagas`, `/nematodos`,
  `/patrones`. *(Comiteado junto a HITO-006 como "HITO-007 — catálogos").*
- **HITO-008 (cerrado, 2026-08-25) = Backend de Requerimientos**: migración V10 (`requerimientos`) +
  endpoints `/requerimientos` (GET/POST/PUT) + `/programaciones/{especieId}/stock`; ciclo de estados,
  validación papel+sobre=cantidad (RF-165), stock disponible (versión 1.4.0 sin cambio; 53 tests BE).
- **HITO-009 (cerrado, 2026-08-25) = Fix CatalogosScreen**: flakiness en test CatalogosScreen bajo
  ejecución paralela (sin bug real, solo incompatibilidad con `--forceExit`; resuelto con `--runInBand`).
- **HITO-010 (cerrado, 2026-08-26) = Fotos backend + mobile API**: migración V11 (`fotos_requerimiento`),
  entity/repository/DTO/service/resource para upload de fotos (max 2, ≤5MB, JPG/PNG, IDOR protection);
  11 tests BE. Mobile: 3 funciones API (subir/listar/eliminar fotos) + 5 tests MO.
- **HITO-011 (cerrado, 2026-08-26) = Wire fotos a screens mobile**: hook `usePhotoCapture` (DRY),
  integración en NuevoRequerimientoScreen (upload post-crear), EditarRequerimientoScreen (carga server +
  upload + delete), HistorialRequerimientoScreen (thumbnails en modal). 87 tests MO / 18 suites
  (versión 1.5.0 / versionCode 6).
- **HITO-012 (cerrado, 2026-08-27) = Tabla intra-semana de Programación**: la tabla pasa de 4 semanas
  fijas a **una fila por cada Lunes y Jueves reales del mes** (variable ~8-9; NINGUNA se descarta,
  incluida la del último Lunes que cierra el mes). Nueva columna **Restante** (stock base 5000 −
  acumulado cronológico; puede ser negativo y muestra el excedido en rojo), inputs vacíos cuando el
  valor es 0, fondo suave alternado por semana, y **pull-to-refresh** en el listado. Migración V12
  (`UNIQUE(programacion_id, fecha)`, sin columna `dia`). El botón "Enviar stock" mantiene su
  comportamiento (publica + bloquea). 90 tests MO / 18 suites (versión 1.6.0 / versionCode 7).
- **HITO-013 (cerrado, 2026-08-30) = Modo Offline Completo** *(DESCARTADO — código implementado pero no se usa en producción)*:
  persistencia SQLite con Drizzle ORM, repositories CRUD offline (requerimientos + fotos), motor
  de sincronización outbox→push→pull, UI adaptativa (OfflineBanner, SyncIndicator, SyncToast),
  hooks (useOnlineStatus, useLiveQuery). Suite completa: **150 tests / 26 suites, 0 failures**.
  Corrección de bug de producción en `token.ts` base64UrlDecode (padding bug). Versión **1.6.1** /
  versionCode 8. *(Decision descarte: §63 en 04_implementacion.md)*
- **HITO-014 (cerrado, 2026-09-02) = Módulo de Cumplimiento de Producción** *(DESCARTADO — depende de offline)*:
  registro real vs programado por semana de programación (papel/sobre). Botón lápiz/lupa en tabla
  de edición, modal de registro y consulta con porcentaje de cumplimiento. Backend: migración V14
  (`cumplimiento_programacion`), entity, repository, DTO, resource con upsert. Offline:
  repository SQLite. Versión **1.7.0** / versionCode 10 (150 tests / 26 suites).
- **HITO-015 (cerrado, 2026-09-03) = Flujo Despachos → Recepción → Liberación** *(DESCARTADO — depende de offline)*:
  ciclo completo de estados APROBADO → ENTREGADO → RECIBIDO → LIBERADO con tablas separadas.
  Backend: migraciones V15-V17 (despachos, recepciones, liberaciones), services, resources, DTOs,
  12 tests. Mobile: ApiClient + 7 screens (DetalleRequerimiento con acciones contextuales), 3 repos
  offline, SyncManager extendido, offline completo para perfil Usuario. Versión **1.8.0**,
  versionCode 11 (150 tests MO / 26 suites · 12 tests BE).
- **HITO-016 (cerrado, 2026-09-09) = Docker del sistema + creación de programación todos los días + TZ fix**:
  `docker-compose.yml` (proyecto `repo_registro_insectos_beneficos`) con postgres + backend +
  nginx; backend quarks corre en contenedor desde BD limpia (Flyway V1-V17). **Creación** de
  programación disponible cualquier día (el PUT inicial del flujo crear envía `esCreacionInicial:true`
  y omite la restricción L/J; la **edición** sigue restringida a Lunes/Jueves). UX: al entrar a
  "Nuevo" la tabla del mes se muestra inmediatamente habilitada (sin esperar a seleccionar especie;
  la especie solo habilita "Enviar stock" y ya no regenera la tabla). Zona horaria del contenedor
  `America/Lima` (ENV TZ + `-Duser.timezone`). Versión **1.10.0** / versionCode 13.
- **v1.11.0 (2026-09-09) = Multi-select Lotes/Plagas + Stock último L/J + Evidencia Aprobado + Fotos BYTEA**:
  Selección múltiple de lotes y plagas con tablas pivote (V19 `requerimiento_lotes`, `requerimiento_plagas`).
  Componente `MultiSelectField` con checkboxes y chips. Stock disponible del último L o J (no mensual 5000).
  Fotos deshabilitadas al crear requerimiento (solo en recepción/despacho). Evidencia de entrega
  (cámara/galería) disponible en edición con estado **APROBADO** o **Entregado**; botones "Ver Detalle"
  (historial) y "Acta PDF" (formulario admin) eliminados; el detalle muestra todos los lotes/plagas.
  **Fotos en BYTEA en BD** (migración V20 `contenido` nullable, patrón
  `repo_control_equipos_apilamiento_v2`; fallback a disco para fotos legacy V11).
  Backend: 89 tests BE · Mobile: 127 tests MO. Antes de este hito: su primer commit documentaba solo
  multi-select (V19) como entrada v1.11.0; esta entrada unifica el alcance completo de la versión.
- Web (React/Vite) y CI/CD siguen pendientes (próxima fase).
- **Endpoint backend para servir fotos** ya está cubierto por el flujo BYTEA
  (`/api/v1/requerimientos/{id}/fotos/contenido`, Ordenable en Response). La validación
  end-to-end desde mobile contra el backend real y actas PDF siguen pendientes (próxima fase).
- Los hitos se cierran con **auditoría integral PASS + verificación + `05_hito_NNN.md` + commit** coherente.
- `versionHistory.js` es la fuente del historial visible al usuario (mobile existente); web la adoptará.

## 8. Coordinación de agentes OpenCode

Arquitectura definida en `OPENCode_orquestacion_agentes_proyecto_v2.md`:

| Agente | Rol | Permisos |
|---|---|---|
| `orchestrator` | Session principal: descompone hitos/tareas, delega `task`, valida ciclos 1/2/3, bloquea y coordina humanos | Primary |
| `developer` | Ejecuta análisis anterior, implementa tareas, verifica (Leyes 1-5) | Subagente, edición permitida |
| `auditor` | Gate review objetivo por tarea/HITO; registra hallazgos; JAMÁS modifica código | Subagente, `edit: deny` (enforced) |

Reglas de operación no negociables:

1. No duplicar tareas (un solo Developer en ejecución por tarea).
2. Tarea dependiente no se ejecuta antes que su predecesora cierre (developer + auditor).
3. Excepción de coordinación: código idéntico compartido (mobile/web) se puede paralelizar solo bajo coordinación explícita del Orchestrator.
4. El gate list proviene del perfil auditor (32 gates); el Auditor no inventa criterios.
5. Los bloqueos humanos detienen la automatización (nunca se silencian).
6. El commit solo ocurre después del gate review integral PASS (Ley 3 + perfiles).
7. **Push automático a GitHub**: tras el commit único de cierre del HITO, el Orchestrator
   **debe `git push origin main`** de inmediato (no es opcional). El remoto es
   `https://github.com/jaanyarin/rep_entrega_insectos_beneficos.git`. El push NO se
   hace por cada commit intermedio/WIP, solo al cierre validado del HITO (coherencia con el
   commit único). Verificar con `git status -sb` (sin "ahead") y `git log origin/main..HEAD` (vacío).

Estado del trabajo se recupera **desde disco** (docs + git), no de memoria de sesión.

## 9. Convenciones de documentación y commit

- SDD (singular): `01_especificacion.md`, `02_plan.md`, `03_tareas.md`, `04_implementacion.md`, `05_hito_NNN.md` dentro de `docs_implementacion/_sdd/`.
- El catálogo de gates vive SOLO en `perfil_auditor.md`; otros docs lo referencian.
- Rutas antiguas (`docs_sdd/`, `docs_diagramas/`, `docs_usuario/`, `perfil_desarrollador.md` suelto)
  quedaron **reemplazadas** por las carpetas `_`-prefijadas; no recrear las antiguas.
- Commit al cierre del HITO (único, coherente). WIP opcional `feat(wip,n):` documentado.
- Tras el commit único de cierre del HITO, **push automático `git push origin main`** (obligatorio).
- `README.md` raíz describe el proyecto (estado actual, stack y pendientes); se actualiza al cierre de hitos.