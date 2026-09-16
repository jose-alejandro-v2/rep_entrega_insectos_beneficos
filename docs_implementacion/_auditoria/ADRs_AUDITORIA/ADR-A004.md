# ADR-A004 — Notificaciones push: Firebase Cloud Messaging (FCM)

- **Estado**: Aprobado
- **Fecha**: 2026-09-15
- **Responsable**: Jose Anyarin
- **Deroga parcialmente**: ADR-A001 D1 (solo notificaciones push; Firebase Auth/Storage siguen prohibidos)

## Contexto

El sistema necesita notificaciones push en tiempo real para dos eventos críticos del negocio:

1. **Publicación de stock** (RF-146, RN-018): cuando I+D publica una programación, los usuarios
   de Sanidad deben ser notificados inmediatamente sin depender del correo electrónico.
2. **Creación de requerimiento** (RN-027): cuando un usuario crea un requerimiento, todos los
   usuarios del sistema deben enterarse para mantener trazabilidad operativa.

El canal de correo SMTP (HITO-018) está implementado pero presenta limitaciones:
- Dependencia de credenciales de terceros (Microsoft 365 SMTP AUTH).
- Los usuarios no siempre revisan su correo corporativo en tiempo real.
- No hay garantía de entrega inmediata.

El proyecto heredero (`repo_control_equipos_apilamiento_v2`) ya usa Firebase FCM con éxito
comprobado. La prohibición de Firebase en ADR-A001 D1 fue para autenticación y storage,
no específicamente para notificaciones push.

## Decisiones

### D-PUSH-1 — Firebase Admin SDK (backend) solo para FCM

- **Decisión**: se agrega `com.google.firebase:firebase-admin` al backend Quarkus exclusivamente
  para el envío de notificaciones push via FCM.
- **NO se usa** Firebase Auth, Firestore, Firebase Storage, ni ningún otro servicio de Firebase.
- **Configuración**: archivo `firebase-service-account.json` cargado desde variable de entorno
  `GOOGLE_FIREBASE_CREDENTIALS` (contenido JSON inline) o desde archivo montado en
  `/app/config/firebase-service-account.json`.
- **Justificación**: FCM es el servicio de push más maduro y con mejor soporte para Android;
  el proyecto ya tiene experiencia con él.

### D-PUSH-2 — @react-native-firebase/messaging (mobile)

- **Decisión**: se usan las librerías oficiales de Firebase para React Native:
  - `@react-native-firebase/app` (core)
  - `@react-native-firebase/messaging` (FCM)
- **NO se usa** Expo Notifications (prohibido por ADR-A001 D3: sin Expo/EAS).
- **Configuración**: archivo `google-services.json` en `mobile/android/app/`.
- **Justificación**: librerías oficiales, soporte nativo Gradle, consistencia con el stack
  React Native CLI.

### D-PUSH-3 — Registro de tokens por usuario

- **Decisión**: cada dispositivo registra su FCM token al hacer login. La tabla
  `dispositivos_tokens` almacena: `id`, `usuario_id` (FK), `fcm_token` (TEXT UNIQUE),
  `platform` (android/ios/web), `activo` (BOOLEAN), `fecha_registro`, `fecha_actualizacion`.
- Un usuario puede tener múltiples dispositivos (mismo token = mismo dispositivo).
- Al hacer logout o desinstalar, se elimina el token (soft delete: `activo = false`).
- **Endpoint**: `POST /api/v1/dispositivos-token` (registrar), `DELETE /api/v1/dispositivos-token/{token}` (eliminar).

### D-PUSH-4 — Envío broadcast a todos los usuarios activos

- **Decisión**: las notificaciones push se envían a TODOS los usuarios activos que tengan
  al menos un token registrado (activo = true).
- **Eventos de notificación**:

| Evento | Disparador | Destinatarios | Título | Mensaje |
|---|---|---|---|---|
| Programación publicada | `ProgramacionService.publicarProgramacion()` | Todos los usuarios con token | "Nueva programación disponible" | "Se publicó la programación de [especie] para [mes/año]" |
| Requerimiento creado | `RequerimientoService.crear()` | Todos los usuarios con token | "Nuevo requerimiento registrado" | "[usuario] solicitó [cantidad] millares de [especie]" |
| Cambio de estado | `RequerimientoService.actualizar()` | Solicitante (creado_por) | "Estado actualizado" | "Su requerimiento #[id] cambió a [estado]" |

### D-PUSH-5 — Manejo de errores

- **Decisión**: el envío de push es **best-effort** (igual que el correo SMTP).
- Un fallo de FCM se loguea y NUNCA rompe la transacción del negocio.
- Si un token es inválido, se marca como `activo = false` (limpieza automática).
- Los tokens expirados se eliminan en el siguiente intento de envío.

### D-PUSH-6 — Exclusiones conscientes

- **Firebase Auth**: sigue prohibido (ADR-A001 D1 mantiene JWT local).
- **Firebase Storage**: sigue prohibido (ADR-A001 D5 mantiene filesystem server).
- **Firestore**: no se usa (PostgreSQL es la base de datos).
- **Firebase Analytics/Crashlytics**: no se incluye en esta fase.
- **iOS**: FCM funciona con APNs bajo el capó; por ahora solo se configura Android.

## Consecuencias

1. **ADR-A001 D1** queda parcialmente derogado: la prohibición de Firebase aplica solo a
   autenticación y storage. Las notificaciones push via FCM quedan autorizadas.
2. Se requiere crear un **proyecto Firebase** en la consola de Google y descargar:
   - `google-services.json` → `mobile/android/app/`
   - `firebase-service-account.json` → montado en el contenedor Docker backend
3. La migración **V24** crea la tabla `dispositivos_tokens` en PostgreSQL.
4. El `AGENTS.md` §4 (prohibiciones) se actualiza para reflejar la excepción de FCM.
5. Los tests backend usan mocks de Firebase (no se conecta a FCM real en tests).
6. Los tests mobile usan mocks de `@react-native-firebase/messaging`.
7. El contenedor Docker backend necesita la variable de entorno `GOOGLE_FIREBASE_CREDENTIALS`
   en `docker-compose.yml` (desde `.env`, igual que el mailer).

## Referencias

- `docs_implementacion/_sdd/01_especificacion.md` — RF-132, RF-146, RF-166, RN-018, RN-027, RNF-013.
- `docs_implementacion/_sdd/05_hito_018.md` — línea 16-18 (Fase 2 pendiente, requiere ADR-A004).
- `AGENTS.md` §2 (stack), §4 (prohibiciones), §7 (hitos).
- `repo_control_equipos_apilamiento_v2` — proyecto heredero con FCM funcional.
