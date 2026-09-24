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
| Backend | Quarkus (Java), PostgreSQL + Flyway, iText PDF, SMTP (notificaciones, relay interno `10.13.10.10:25`), Firebase FCM (push) |
| Mobile | React Native CLI (React Navigation, react-native-paper MD3, React Hook Form + Zod) |
| Web | React 18 + Vite + MUI |
| Infra | Docker / Docker Compose, Nginx, GitHub Actions, VPS Linux |

Decisiones de arquitectura vigentes y decisiones descartadas: ver
[`docs_implementacion/_auditoria/ADRs_AUDITORIA/`](docs_implementacion/_auditoria/ADRs_AUDITORIA/)
(`ADR-A001.md`, `ADR-A002.md`, `ADR-A003.md`, `ADR-A004.md`).

## Herramientas de documentación

| Herramienta | Uso |
|---|---|
| **Archify** | Generación de diagramas de arquitectura, workflow, sequence, dataflow y lifecycle como HTML interactivo autocontenido |
| **PUML** | Diagramas estáticos UML en `docs_implementacion/_diagramas/` |

Archify está instalado como Agent Skill para OpenCode. Los diagramas generados se guardan en
`docs_implementacion/_diagramas/` y son autocontenidos (HTML interactivo con temas oscuro/claro).

## Estructura del repositorio

```text
docker-compose.yml   Proyecto `repo_registro_insectos_beneficos`: postgres:16 + backend + nginx
nginx/nginx.conf     Proxy 8080 → backend:6113
backend/      API Quarkus v2 — auth/usuarios bajo /api/v1, login 3 pasos, roles en tabla, programaciones
              (tabla intra-semana Lunes/Jueves reales + Restante), catálogos
              (fundos/variedades/lotes/etapas/plagas/nematodos/patrones), requerimientos
              (multi-select lotes/plagas con tablas pivote),
              fotos de requerimiento (bytes BYTEA en BD, V20), sync offline,
              cumplimiento de producción, despachos/recepciones/liberaciones,
              notificaciones multi-canal (SMTP relay interno + Firebase FCM + in-app V25),
              dispositivos FCM (V24), CRUD catálogos simples (V1-V25, sin migración nueva),
              Dockerfile multi-stage, TZ America/Lima)
mobile/       App React Native CLI 0.86 / React 19.2.3 — auth v2 (login 3 pasos, URL runtime,
              SecureStore/keychain), módulos Programación (Lunes/Jueves reales + Restante, pull-to-refresh,
              cumplimiento de producción), Requerimientos (multi-select lotes/plagas, evidencia de entrega
              en estado Aprobado), Catálogos (Usuarios con correo electrónico), CRUD de catálogos simples
              + Eliminar con dependencias + tabs lectura Fundos/Variedades/Lotes
              + hook usePhotoCapture, notificaciones in-app + FCM — versión 1.17.0
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
- **HITO-015 cerrado (2026-09-03) = Flujo Despachos → Recepción → Liberación** *(DESCARTADO — depende de offline)*: ciclo completo
  de estados APROBADO → ENTREGADO → RECIBIDO → LIBERADO con tablas separadas. Backend: migraciones
  V15-V17 (despachos, recepciones, liberaciones), services, resources, DTOs, 12 tests. Mobile:
  ApiClient + 7 screens (DetalleRequerimiento con acciones contextuales). Versión **1.8.0**, versionCode 11
  (12 tests BE).
- **v1.9.0 (2026-09-08) = Sincronización + Tests flujo crítico**: versiones sincronizadas (package.json,
  build.gradle versionCode 12, appVersion.ts), tests e2e de flujo login (13), requerimiento (11) y
  ciclo-entrega (13). Suite total: **127 tests / 22 suites**. Documentación: descarte offline (§63),
  endpoint fotos verificado, keystore verificado.
- **HITO-016 cerrado (2026-09-09) = Docker del sistema + creación de programación todos los días + TZ fix**:
  backend dockerizado completo (docker-compose proyecto `repo_registro_insectos_beneficos`: postgres 16 +
  imagen backend `:6113` + nginx `:8080`, desde BD limpia con Flyway V1-V17). **Creación** de programación
  disponible cualquier día (el flujo crear envía `esCreacionInicial:true` y omite la restricción L/J;
  la **edición** sigue restringida a Lunes/Jueves). En "Nuevo" la tabla del mes aparece inmediatamente
  habilitada, sin esperar a seleccionar especie; la especie solo habilita "Enviar stock". Zona horaria del
  contenedor `America/Lima` (ENV TZ + `-Duser.timezone`). Versión **1.10.0**, versionCode 13.
- **v1.11.0 (2026-09-09) = Multi-select Lotes/Plagas + Stock último L/J + Evidencia Aprobado + Fotos BYTEA + Liberación por Lote**:
  selección múltiple de lotes y plagas con tablas pivote (V19 `requerimiento_lotes`,
  `requerimiento_plagas`), componente `MultiSelectField` con checkboxes y chips, stock disponible
  del último L o J (no mensual 5000), fotos deshabilitadas al crear requerimiento. Evidencia de
  entrega (cámara/galería) ahora también en estado **Aprobado**; botones "Ver Detalle" y "Acta PDF"
  eliminados; el detalle muestra todos los lotes/plagas. Fotos almacenadas como **bytes BYTEA en BD**
  (migración V20, con fallback a disco para fotos legacy V11). **Liberación por lote** (V21):
  columna `liberado` en `requerimiento_lotes`, `papel_con_postura`/`sobre_con_cascarilla` por
  liberación, flujo multi-estado admin/user (Screen 7/8/12/13). Suite: **89 tests BE + 127 tests MO**.
- **v1.12.0 (2026-09-14) = Liberación parcial acumulada + plagas por liberación (V22)**:
  En el flujo usuario (Screen 12 → Screen 13), la **Cantidad (millares)** de "Liberar
  Requerimiento" ya no muestra el total pedido sino el **pendiente**: `cantidad pedida −
  Σ(papel + sobre)` de las liberaciones ya registradas. Ejemplo validado: requerimiento de 140
  millares con 2 lotes; tras liberar 60 (papel) + 20 (sobre), al reingresar ("Por Liberar 1 de 2")
  se muestra **60**. Papel/sobre se pre-llenan con el restante por presentación; se bloquea
  "Guardar liberación" si la suma excede el pendiente; pendiente 0 bloquea Guardar. `cantidadLiberada`
  persistida = `papel + sobre` de esa liberación (coherente con RF-165). Backend: migración
  **V22** (`liberacion_plagas`, pivote N:N liberaciones↔plagas), `CrearLiberacionRequest` con
  `plagas: List<Long>` y `fechaLiberacion` editable (el requerimiento toma la fecha de la
  liberación, no `now()`), `LiberacionDto.plagas`, test `LiberacionResourceTest` ampliado.
  Suite: 144 tests MO (132 pass / 12 fallas pre-existentes verificadas contra HEAD) · 95 tests BE (0 fallas).
- **v1.13.0 (2026-09-14) = Notificaciones por correo SMTP + email en usuarios**:
  Se conectan los correos que la spec exige (RF-137/146/166, RN-018/027/039) sobre
  `usuarios.email` (migración **V23**). Evento 1: al **publicar** una programación se notifica
  a TODOS los usuarios rol **Usuario** (Sanidad) activos con correo cargado. Evento 2: al marcar un
  requerimiento como **ENTREGADO**, se notifica al **solicitante**. Backend: `quarkus-mailer`,
  `NotificacionService` best-effort. Mobile: campo **Correo electrónico** en Catálogos > Usuarios.
  Suite: **102 tests BE (0 fallas) · 145 tests MO**.
- **v1.14.0 (2026-09-16) = Notificaciones multi-canal + Firebase FCM + Notificaciones in-app**:
  Ampliación del HITO-018 con tres componentes: (1) **SMTP relay interno** — Exchange interno
  `10.13.10.10:25` (sin TLS, sin AUTH, relay abierto). Verificado con curl desde contenedor
  (`250 2.6.0 Queued mail for delivery`). (2) **Firebase Cloud Messaging** — autorizado por
  ADR-A004. Backend: `FirebasePushService` (service account montada como volumen read-only) +
  `DispositivoToken` (V24). Mobile: `@react-native-firebase/messaging` v26 (modular API),
  `NotificationService.ts`, `NotificacionesScreen.tsx`. Paquete Android corregido a
  `com.insectosbeneficos`. (3) **Notificaciones in-app** — tabla `notificaciones` (V25),
  entity, repository, resource, DTO. 4 eventos: programación publicada, requerimiento creado,
  cambio de estado, requerimiento entregado. **Permisos obligatorios**: pantalla PermissionsScreen
  solicita cámara + notificaciones la primera vez. **Canal notificaciones Android**: push estilo
  WhatsApp. **Popups éxito**: Alert al enviar requerimiento o publicar programación.
  Suite: **102 tests BE (0 fallas) · 145 tests MO**.
- **v1.14.3 (2026-09-21) = Unificación de puerto 6113**: backend Quarkus ahora escucha en
  puerto 6113 en todos los ambientes (dev y Docker prod). URL por defecto:
  `http://10.13.10.24:6113/api/v1`. Solo cambia la IP entre ambientes.
  Versión **1.14.3** / versionCode 20. Mobile: 22 tests MO · Backend: 102 tests (0 fallas).
- **v1.14.4 (2026-09-21) = Icono de notificación personalizado Vanguard**: isotipo Vanguard
  (silueta blanca) como small icon en la barra de notificaciones Android, tanto en foreground
  (`notifee.displayNotification` con `smallIcon: 'ic_stat_vanguard'`) como en background/killed
  (`AndroidManifest` meta-data `default_notification_icon`). Density buckets mdpi→xxxhdpi
  generados desde el isotipo blanco transparente. Versión **1.14.4** / versionCode 21.
  Mobile: 145 tests · Backend: 102 tests (0 fallas).
- **v1.14.5 (2026-09-21) = Permisos robustos**: pantalla de permisos con 3 estados
  (granted/askable/blocked) y botón "Abrir ajustes" cuando bloqueado. Verificación pasiva
  en RootNavigator (ya no dispara diálogos al solo checar). Re-validación al volver de
  background (AppState). "Continuar" bloqueado hasta ambos permisos otorgados.
  Versión **1.14.5** / versionCode 22. Mobile: 145 tests · Backend: 102 tests (0 fallas).
- **v1.15.0 (2026-09-22) = CRUD de catálogos simples**: alta, edición, desactivación
  y reactivación de Especies, Nematodos, Plagas y Patrones desde la app (mismas
  pantallas y experiencia que Usuarios). Nuevas pestañas solo para Admin/Super Admin,
  con búsqueda y filtros de estado; desactivación con confirmación y reactivación en
  un toque. Backend: endpoints CRUD protegidos por rol con validación de duplicados.
  Fix de la suite Jest (mocks de Firebase Messaging y notifee): ahora corren las 23
  suites. Versión **1.15.0** / versionCode 23. Backend: 134 tests (0 fallas) ·
  Mobile: 153 tests (138 pass / 15 fallos latentes pre-existentes, sin regresiones).
- **v1.16.0 (2026-09-23) = Eliminar con dependencias + tabs lectura Fundos/Variedades/Lotes**:
  botón **"Eliminar"** en Usuarios y catálogos Especies/Nematodos/Plagas/Patrones que solo
  se muestra si no hay dependencias (flag `puedeEliminar`; hide en UI si `false`). Backend:
  `DependenciasService` con conteos batch + 409 `REGISTRO_CON_DEPENDENCIAS` en `eliminar()`
  y transición ACTIVO→INACTIVO en `actualizar()`. Usuarios: deps = `creadoPor` SOLO en
  requerimientos/despachos/recepciones/liberaciones/cumplimiento (excluye notificaciones,
  dispositivos_tokens, usuarios.creado_por). Catálogos: deps = usos en programaciones/
  requerimientos. **Nuevo tab solo lectura** `CatalogoLecturaTab` para Fundos, Variedades y
  Lotes: Admin ve **9 tabs**; no-admin ve **4 tabs** (Perfiles, Fundos, Variedades, Lotes);
  barra de tabs siempre visible. Versión **1.16.0** / versionCode 24. Backend: 140 tests
  (0 fallas) · Mobile: 159 tests (144 pass / 15 fallos latentes en 7 suites sin tocar;
  CatalogosScreen 24/24 PASS).
- **v1.17.0 (2026-09-23) = Fix bucle de permisos + notificación de cumplimiento**:
  fix del bucle de permisos de notificaciones (clasificación `askable` en Android 13+,
  requests serializados, `POST_NOTIFICATIONS` nativo, canal creado antes del check);
  notificación multi-canal (push + in-app + correo HTML) al guardar o actualizar un
  registro de cumplimiento de producción, excluyendo al admin que guarda.
  Versión **1.17.0** / versionCode 25. Backend: 142 tests (0 fallas) · Mobile:
  158 tests (143 pass / 15 fallos latentes pre-existentes; lint 0 errores).
  APK release pendiente (no build en esta sesión).
- **Pendientes**: frontend web (React/Vite) y CI/CD (GitHub Actions).
  Ver [`docs_implementacion/_sdd/`](docs_implementacion/_sdd/).

## Base de datos local (desarrollo)

Para desarrollo local se usa PostgreSQL 16 en Docker. Los **parámetros de conexión** están definidos en
[`docker-compose.yml`](docker-compose.yml) (raíz) y en
[`backend/src/main/resources/application.properties`](backend/src/main/resources/application.properties).
Son credenciales de **desarrollo** y no se exponen en este README por seguridad; conéctate a la BD que
levantan esos archivos desde tu gestor (pgAdmin/DBeaver/DataGrip). Las migraciones Flyway `V1..V25`
crean toda la estructura: `usuarios` (con `email` V23), `roles`, `fundos`, `variedades`, `lotes`, `etapas_fenologicas`,
`plagas`, `nematodos`, `patrones`, `programaciones`, `requerimientos` (+ pivotes `requerimiento_lotes` con `liberado` V21 y `requerimiento_plagas`),
`fotos_requerimiento` (bytes BYTEA V20), `sync_log`, `cumplimiento_programacion`, `despachos`,
`recepciones`, `liberaciones` (+ `papel_con_postura`/`sobre_con_cascarilla` V21 y pivote
`liberacion_plagas` V22), `dispositivos_tokens` (V24, FCM tokens) y `notificaciones` (V25, in-app center).

## Verificación por capa

```text
Backend : mvn test / mvn clean package
Mobile  : npm run lint · npm test · gradle assembleRelease (release cold ≈ 2-6 min)
Web     : npm run lint · npm run build
Docker  : docker-compose build
```

Para agentes de IA (OpenCode): la fuente de verdad operacional es `AGENTS.md`.