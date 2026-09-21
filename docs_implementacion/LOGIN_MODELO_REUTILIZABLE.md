# GUÍA DE REUTILIZACIÓN — LÓGICA DE LOGIN / AUTENTICACIÓN LOCAL

> **Propósito:** Documentar de forma EXPLÍCITA y CONCRETA la lógica de autenticación local (perfiles + usuarios + contraseña + cambio de contraseña + URL de conexión configurable en runtime) implementada en el proyecto *Control de Equipos de Apilamiento*, para ser replicada tal cual en otra aplicación.
>
> **Audiencia:** Agente de IA / desarrollador que debe reimplementar el mismo planteamiento en un nuevo proyecto. Cada sección explica QUÉ hace, CÓMO lo hace y DÓNDE está el código fuente de referencia.

---

## 1. RESULTADO DESEADO (qué se logra)

Al replicar esta lógica se obtiene:

1. Login **sin correo ni contraseña digitada del usuario final obligatoria** → el usuario elige **Perfil (rol)** y luego **Usuario** desde listas desplegables, y solo digita la **contraseña numérica de 8 dígitos** (DNI).
2. **URL del servidor configurable en runtime** desde la propia app (sin hardcodear IP en código). Se almacena en almacenamiento seguro y se aplica automáticamente a todas las llamadas HTTP vía interceptor.
3. Validación de conexión automática al abrir la app (pantalla `ServerCheck`).
4. Primer login con contraseña predeterminada (`00000000`) → obliga al **cambio de contraseña** antes de usar la app.
5. Emisión de **JWT** con claims del usuario (nombre, correo, rol, rolId, área, dni, passwordResetRequired).
6. Protección de endpoints: cada request autenticado requiere `Authorization: Bearer <token>`.
7. Permisos por rol (Super Admin, Admin, Usuario) para mostrar/ocultar secciones en la UI.

---

## 2. DIAGRAMA DE FLUJO GENERAL

```
┌────────────────────────────────────────────────────────────────────────┐
│                           APP MOBILE (React Native)                    │
│                                                                        │
│  [AppNavigator]                                                        │
│   └── user == null ?  →  AuthNavigator (ServerCheck → Login)           │
│   └── user.passwordResetRequired == true ? → PasswordChangeScreen      │
│   └── else → MainNavigator (tabs: Inicio, Equipos, Perfil, ...)        │
└────────────────────────────────────────────────────────────────────────┘
              │  HTTP (axios)  con/ sin  "Authorization: Bearer <jwt>"
              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Quarkus JAX-RS)                           │
│                                                                        │
│  GET   /api/v1/auth/roles               → lista perfiles activos       │
│  GET   /api/v1/auth/usuarios-by-rol/{id} → lista usuarios de un perfil │
│  POST  /api/v1/auth/local-login         → valida BCrypt → emite JWT    │
│  POST  /api/v1/auth/change-password     → BCrypt hash → nuevo JWT      │
│                                                                        │
│  OTROS ENDPOINTS: JwtFilter exige "Bearer <jwt>", verifica rol con     │
│  @RolesAllowed({"Super Admin","Admin","Usuario"})                     │
└────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         BASE DE DATOS PostgreSQL                       │
│  dim_usuarios (id, nombre, correo, dni, password_hash, rol_id,         │
│                password_reset_required, estado_activo, ...)            │
│  dim_roles    (id, nombre, estado_activo)                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MODELO DE DATOS (PostgreSQL)

### 3.1 Tabla de usuarios — `dim_usuarios`

Campos mínimos requeridos para que funcione el login local:

| Columna | Tipo | Obligatorio | Propósito |
|---|---|---|---|
| `id` | BIGSERIAL PK | sí | Identificador del usuario (enviado al login) |
| `nombre` | VARCHAR(255) | sí | Nombre visible del usuario |
| `correo` | VARCHAR(255) | no | Opcional (queda nullable en login local) |
| `dni` | VARCHAR(20) | no | DNI = base de la contraseña predeterminada |
| `password_hash` | VARCHAR(255) | sí (para login) | Hash **BCrypt** de la contraseña |
| `password_reset_required` | BOOLEAN | sí (default TRUE) | Si `true` → obliga a cambiar contraseña al primer ingreso |
| `rol_id` | BIGINT FK → `dim_roles.id` | sí | Perfil del usuario |
| `estado_activo` | BOOLEAN | sí (default TRUE) | `false` → login denegado ("Usuario no activo") |
| `area` | VARCHAR(255) | no | Área/ubicación mostrada en el selector (etiqueta del usuario) |

**Reglas operativas:**
- La contraseña **NUNCA se guarda en texto plano**, siempre BCrypt.
- El Super Admin (usuario id=1 o `id_microsoft='seed-superadmin'`) está protegido: no se puede modificar ni eliminar.

**Referencia de migración real:** `backend/src/main/resources/db/migration/V8__login_local.sql`

```sql
ALTER TABLE dim_usuarios ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE dim_usuarios ADD COLUMN dni VARCHAR(20);
ALTER TABLE dim_usuarios ADD COLUMN password_reset_required BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON dim_usuarios(dni);
```

**Backfill de contraseñas predeterminadas** (V12): a todo usuario sin hash se le asigna `crypt('00000000', gen_salt('bf'))` y `password_reset_required = TRUE`.

```sql
UPDATE dim_usuarios
SET password_hash = crypt('00000000', gen_salt('bf')),
    password_reset_required = TRUE,
    fecha_actualizacion = CURRENT_TIMESTAMP
WHERE password_hash IS NULL OR btrim(password_hash) = '';
```

### 3.2 Tabla de roles — `dim_roles`

| Columna | Tipo | Propósito |
|---|---|---|
| `id` | BIGSERIAL PK | Identificador del rol |
| `nombre` | VARCHAR(255) | Nombre del perfil: **Super Admin**, **Admin**, **Usuario** |
| `estado_activo` | BOOLEAN | Solo se listan roles activos en el login |

> Los nombres de rol son **exactamente** `"Super Admin"`, `"Admin"`, `"Usuario"`. Los checks de permisos en backend y mobile usan estos strings literales.

---

## 4. LÓGICA MULTI-PASO DEL LOGIN (QUÉ UELEZA-QUÉ SE HACE)

El login NO pide correo: usa **3 pasos en cascada** que la app resuelve con 2 llamadas previas y 1 llamada final:

### Paso A — Cargar perfiles (roles)
`GET /api/v1/auth/roles` → devuelve `[{id, nombre}, ...]` de roles con `estado_activo = true`. No requiere JWT (el filtro excluye `/auth/`).

### Paso B — Cargar usuarios de un perfil
`GET /api/v1/auth/usuarios-by-rol/{rolId}` → devuelve `[{id, nombre, area, rolId, passwordResetRequired}, ...]`. Cada usuario trae `passwordResetRequired`; si es `true`, la app **autocompleta** la contraseña con `00000000` para que el usuario solo presione "Iniciar sesión". Solo lista usuarios activos.

### Paso C — Autenticar
`POST /api/v1/auth/local-login` con body `{ "usuarioId": <Long>, "password": "<8 dígitos>" }`.

1. Busca el usuario por `id`.
2. Valida `estado_activo == true`.
3. Valida que `password_hash` no sea nulo.
4. Compara con `BCrypt.checkpw(password, passwordHash)`.
5. Si todo OK: actualiza `ultimo_acceso` y `fecha_actualizacion`, **genera el JWT** y responde `{ "token": "<jwt>", "passwordResetRequired": <bool> }`.
6. Si falla → error 401 con `{ "error": "<mensaje>" }` (mensajes ubicables: "Contraseña incorrecta", "Usuario no activo", etc.).

### Paso D — (Opcional si `passwordResetRequired`) Cambiar contraseña
`POST /api/v1/auth/change-password` con body `{ "newPassword": "<8 dígitos>" }` y header `Authorization: Bearer <token>`.

1. Valida que la nueva contraseña tenga **exactamente 8 dígitos** (`^\d{8}$`).
2. Valida que sea **diferente** de la actual (`!BCrypt.checkpw(new, currentHash)`).
3. Guarda `BCrypt.hashpw(new, BCrypt.gensalt())`, pone `password_reset_required = false`.
4. Genera **un nuevo JWT** (sin el flag de reset) y responde `{ "token": "<jwt>", "message": "Contraseña actualizada correctamente" }`.
5. Nota: No se pide la contraseña actual porque solo se llega aquí por primera vez (reset obligatorio).

---

## 5. ENDPOINTS DEL BACKEND (ESPECIFICACIÓN EXACTA)

Base URL: `/api/v1` · Formato JSON · Los endpoints de auth están en `@Path("/auth")` con `@PermitAll` a nivel de clase (el control de JWT se hace manual en `change-password` con SecurityContext).

### 5.1 `GET /auth/roles`
- **Auth:** Ninguna (pública).
- **Respuesta 200:** array plano de roles: `[{"id": 1, "nombre": "Super Admin"}, {"id": 2, "nombre": "Admin"}]`.
- **Backend:** `LocalAuthService.getRolesActivos()` → `rolRepository.list("estadoActivo", true)`.

### 5.2 `GET /auth/usuarios-by-rol/{rolId}`
- **Path param:** `rolId` (Long).
- **Auth:** Ninguna (pública; la acción de listar se hace antes de loguear y no expone datos sensibles, solo `id/nombre/area/rolId/passwordResetRequired`).
- **Respuesta 200:** `[{"id": 3, "nombre": "Juan Perez", "area": "Lima", "rolId": 2, "passwordResetRequired": true}]`.
- **Backend:** `UsuarioRepository.findByRolId(rolId)` → `list("rolId = ?1 and estadoActivo = true", rolId)`.

### 5.3 `POST /auth/local-login`
- **Body request:**
  ```json
  { "usuarioId": 3, "password": "00000000" }
  ```
- **Respuesta 200:**
  ```json
  { "token": "eyJhbGciOi...", "passwordResetRequired": true }
  ```
- **Errores:**
  - `400` → `{"error":"usuarioId y password requeridos"}` / `{"error":"usuarioId inválido"}`.
  - `401` → `{"error":"Contraseña incorrecta"}` o `"Usuario no activo"` o `"Usuario sin contraseña configurada"`.

### 5.4 `POST /auth/change-password`
- **Header:** `Authorization: Bearer <token>`.
- **Roles permitidos:** `@RolesAllowed({"Super Admin", "Admin", "Usuario"})`.
- **Body request:**
  ```json
  { "newPassword": "74125896" }
  ```
- **Respuesta 200:**
  ```json
  { "token": "eyJhbGciOi...", "message": "Contraseña actualizada correctamente" }
  ```
- **Errores:**
  - `400` → `{"error":"La nueva contraseña debe tener exactamente 8 dígitos numéricos"}` (validado también por Jakarta Validation en el DTO), o `{"error":"La nueva contraseña debe ser diferente de la contraseña actual"}`.
  - `401` → si el token no tiene `subject` válido.

### 5.5 Protección del resto de la API (JwtFilter)
- `JwtFilter` (ContainerRequestFilter, Prioridad AUTHENTICATION) **excluye** los paths que empiezan con `/auth/`, `/q/`, `/swagger`, `/health`.
- Para cualquier otro path exige `Authorization: Bearer <token>`; si falta → `401 {"error":"Token JWT requerido"}`.
- Quote de referencia: `JwtFilter.java:19`

---

## 6. GENERACIÓN Y CONTENIDO DEL JWT

Clase: `JwtService` (`backend/src/main/java/.../service/JwtService.java`). Expiración: **8 horas** (`Duration.ofHours(8)`).

| Claim | Valor | Uso en la app |
|---|---|---|
| `iss` | `https://apilamiento.internal` | Identificacióón de emisor |
| `sub` | `String.valueOf(usuario.getId())` | **Lo usa `SecurityUtil.getUsuarioId()`** para saber qué usuario hace la petición (auditoría, trazabilidad, change-password) |
| `upn` | correo o nombre | Identificación |
| `groups` | `Set.of(user.getRol().getNombre())` → ej. `["Admin"]` | Mapeado por Quarkus a roles JAX-RS (`@RolesAllowed`) |
| `nombre` | nombre del usuario | Mostrado en Perfil |
| `correo` | correo o `""` | Mostrado en Perfil |
| `rolId` | `user.getRolId()` | Checks de permisos |
| `area` | área o `""` | Mostrado en Perfil |
| `dni` | DNI o `""` | Mostrado en Perfil |
| `passwordResetRequired` | bool (default `true`) | **Controla la pantalla de cambio de contraseña** |
| `exp` | 8h | Expiración |

Firma: `io.smallrye.jwt.build.Jwt` (SmallRye JWT, configurado en `application.properties` con la clave privada). Validación del token en cada request: `JWTParser.parse(token)` + `@RolesAllowed`.

Cómo se obtiene el `usuarioId` desde el token en un controller:
`SecurityUtil.getUsuarioId(securityContext)` → `Long.parseLong(jsonWebToken.getSubject())`.

---

## 7. LADO MOBILE — URL DE CONEXIÓN CONFIGURABLE EN RUNTIME (PIEZA CLAVE)

Objetivo: **el usuario final configura la URL del backend desde la app**, guardada en almacenamiento seguro, y **todas** las llamadas HTTP la usan sin tocar código ni recompilar el APK.

### 7.1 Módulo central: `mobile/src/api.js`

El archivo `api.js` contiene TODA la magia:

```js
import axios from 'axios'
import * as Keychain from 'react-native-keychain'

const TOKEN_KEY = 'accessToken'
const API_URL_KEY = 'apiUrl'

// URL por defecto (solo fallback, se sobreescribe con la guardada)
const LAN_API_URL = 'http://10.13.18.168:6113/api/v1'
  const DEBUG_API_URL = 'http://127.0.0.1:6113/api/v1'
const IS_DEVELOPMENT = typeof __DEV__ !== 'undefined' && __DEV__
const FALLBACK_API_URL = IS_DEVELOPMENT ? DEBUG_API_URL : LAN_API_URL
export const BUILT_IN_API_URL = normalizeApiUrl(process.env.API_URL || FALLBACK_API_URL)

let _cachedApiUrl = null   // cache en memoria de la URL
let _cachedToken = null    // cache en memoria del token

function normalizeApiUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')   // quita espacios y '/'
}
```

**Lectura/escritura de URL y token (SecureStore):** se usa `react-native-keychain` vía `getGenericPassword({service})` y `setGenericPassword(user, pass, {service})`, donde `service` identifica cada dato (`accessToken` vs `apiUrl`).

```js
export async function loadApiUrl() { /* lee Keychain(apiUrl) o BUILT_IN_API_URL */ }
export async function setApiUrl(url) { /* normaliza, guarda en Keychain, actualiza cache */ }
export async function getToken() { /* lee Keychain(accessToken) */ }
export async function setToken(token) { /* guarda en Keychain, actualiza cache */ }
export async function removeToken() { /* elimina de Keychain */ }
```

> **Regla de seguridad:** el JWT se guarda **SIEMPRE** en SecureStore (react-native-keychain). NO usar AsyncStorage para tokens.

**Interceptor de axios (clave del runtime):** en CADA request el interceptor lee la URL guardada y el token, y los aplica dinámicamente. Así, cambiar la URL en la pantalla de configuración **aplica a la siguiente petición sin reiniciar la app**.

```js
api.interceptors.request.use(async (config) => {
  const [apiUrl, token] = await Promise.all([loadApiUrl(), getToken()])
  config.baseURL = apiUrl                     // ← URL dinámica por request
  if (token) config.headers.Authorization = `Bearer ${token}`  // ← JWT
  return config
})
```

**Interceptor de respuesta (manejo de 401):** si cualquier respuesta devuelve `401`, se borra el token cacheado y de Keychain (la sesión caducó / token inválido).

```js
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      _cachedToken = null
      void removeToken()
    }
    return Promise.reject(error)
  }
)
```

**Tiempo de espera:** `timeout: 15000` en la instancia axios.

> ⚠️ **IMPORTANTE para replicar:** en el nuevo proyecto, el framework (React Native CLI, React, Kotlin/Java con Retrofit, Flutter con Dio, etc.) debe implementar el MISMO patrón: un **lector de URL persistente** + **interceptor/header dinámico por request**. La URL es un dato de runtime, NO una constante compilada.

### 7.2 Pantalla `ServerCheck` (valida conexión al abrir la app)

Archivo: `mobile/src/screens/ServerCheckScreen.js`. Es la pantalla inicial del flujo de autenticación.

Qué hace:
1. Al montar, lee la URL guardada (`loadApiUrl()`).
2. Hace `api.get('/auth/roles', { timeout: 5000, baseURL: urlToTest })` para **probar conectividad**.
3. Si OK → navega a `Login`. Si falla → muestra el error y un formulario con **"URL de la API"** + botones `Restablecer` y `Guardar y probar`.
4. `Guardar y probar`: llama `setApiUrl(normalized)`, prueba de nuevo; si pasa, navega a Login.
5. Mensajes de error tipificados: timeout (`ECONNABORTED`) → "Tiempo de espera agotado...".

### 7.3 Pantalla `Settings` (configuración desde dentro de la app)

Archivo: `mobile/src/screens/SettingsScreen.js`. Accesible desde el menú (solo Super Admin en el flujo actual). Tiene el campo `URL de la API` con botones `Restablecer` (vuelve a `BUILT_IN_API_URL`) y `Guardar` (`setApiUrl`). También el LoginScreen tiene un botón colapsable **"Configurar servidor"** con el mismo input (duplicación deliberada para casos de primer uso sin servidor).

---

## 8. LADO MOBILE — FLUJO COMPLETO (Screens, Context, Navigation)

### 8.1 Estado de autenticación global: `mobile/src/AuthContext.js`

Provee a toda la app (`useAuth()`) con:
- `user`: objeto decodificado del JWT (o `null` si no hay sesión).
- `loading`: `true` mientras se lee el token persistido al arrancar.
- `refreshUser(token)`: decodifica el JWT, actualiza `user`.
- `logout()`: elimina token push + borra el JWT de Keychain + `setUser(null)`.

Al arrancar:
```js
const token = await getToken()
if (token) {
  setUser(parseToken(token))   // decodifica claims sin llamar al backend
  await registerPushToken()    // (opcional) registra FCM push
}
```

### 8.2 Decodificación del JWT: `api.js → parseToken(token)`

El payload se decodifica en el cliente (base64url del 2º segmento) para obtener:
```js
return {
  nombre: payload.nombre || 'Usuario',
  correo: payload.correo || payload.upn || '',
  rol: (payload.groups || [])[0] || '',
  rolNombre: (payload.groups || [])[0] || '',
  rolId: payload.rolId || null,
  sub: payload.sub || null,
  area: payload.area || '',
  dni: payload.dni || '',
  passwordResetRequired: payload.passwordResetRequired !== false,
}
```

> `passwordResetRequired` se interpreta como `true` por defecto (más seguro: si el claim falta, se obliga a cambiar la contraseña).

### 8.3 Navegación condicional: `mobile/src/navigation/AppNavigator.js`

Decisión de flujo (LÍNEA CLAVE):

```js
const navigationState = !user
  ? 'login'
  : user.passwordResetRequired
    ? `password-change-${user.sub || 'user'}`
    : `authenticated-${user.sub || 'user'}`
```

Render:
```jsx
{user ? (
  user.passwordResetRequired ? (
    <AuthNavigator initialRouteName="PasswordChange" />  // forzado a cambiar contraseña
  ) : (
    <MainNavigator />  // app normal
  )
) : (
  <AuthNavigator initialRouteName="ServerCheck" />  // 1º ServerCheck, luego Login
)}
```

- `AuthStack`: `ServerCheck` → `Login` → `PasswordChange`.
- `MainStack`: `MainTabs` (BottomTabs: Inicio, Equipos, Catálogos [solo Admin], Perfil) + pantallas secundarias.

### 8.4 Pantalla `LoginScreen` (mobile/src/LoginScreen.js)

Estado del componente: `roles`, `usuarios`, `selectedRolId`, `selectedUsuarioId`, `password`, `loading`, `error`, `showServerConfig`, `apiUrl`.

**Efecto inicial:** carga la URL guardada y llama `fetchRoles()`.

**fetchRoles (GET /auth/roles):**
```js
const r = await api.get('/auth/roles')
setRoles(Array.isArray(r.data) ? r.data : (r.data?.data || []))
```
> Nota: el backend devuelve array plano, pero el helper tolera también el wrapper `ApiResponse` (`data.data`).

**Al elegir perfil (selectedRolId):** limpia usuario y contraseña, luego:
```js
api.get(`/auth/usuarios-by-rol/${selectedRolId}`)
  .then(r => setUsuarios(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
```

**Al elegir usuario:** si `selected.passwordResetRequired` es `true` → `setPassword('00000000')` (autocompletado de la contraseña predeterminada).

**Input de contraseña:** solo numérico, máximo 8 caracteres, filtro de no-dígitos:
```jsx
onChangeText={value => setPassword(value.replace(/[^0-9]/g, '').slice(0, 8))}
```

**handleLogin (POST /auth/local-login):**
```js
const { data } = await api.post('/auth/local-login', {
  usuarioId: selectedUsuarioId,
  password,
})
await setToken(data.token)      // guarda JWT en SecureStore
await refreshUser(data.token)   // decodifica → user en contexto → navegación decide PasswordChange o Main
```

**Errores:** `e.response?.data?.error || 'Error al iniciar sesión'` (el backend manda `{error}` en los 401).

### 8.5 Pantalla `PasswordChangeScreen` (mobile/src/screens/PasswordChangeScreen.js)

Se muestra cuando `user.passwordResetRequired === true`.

- Valida `newPassword` contra `/^\d{8}$/` y que coincida con la confirmación.
- `POST /auth/change-password` con `{ newPassword }`.
- Al éxito: `setToken(data.token)` (el nuevo token ya trae `passwordResetRequired: false`) y `refreshUser(data.token)` → la navegación cambia automáticamente a `MainNavigator`.
- Botón "Cancelar" → `logout()` (vuelve al Login).
- Texto guía: "Use su número de DNI (8 dígitos) como nueva contraseña".

---

## 9. PERMISOS POR ROL (PERFILES)

### 9.1 Backend

- `@RolesAllowed({"Super Admin", "Admin", "Usuario"})` sobre el endpoint protegido (ej. `change-password`, `AuthMeResource`).
- El `groups` del JWT mapea el rol del usuario; JAX-RS/Quarkus valida contra `@RolesAllowed`.

### 9.2 Mobile — utilitario `mobile/src/utils/roles.js`

```js
export function isSuperAdmin(user) {
  return String(user?.rolNombre || user?.rol || '').trim().toLowerCase() === 'super admin'
}
export function isAdminOrSuperAdmin(user) {
  const role = String(user?.rolNombre || user?.rol || '').trim().toLowerCase()
  return role === 'admin' || role === 'super admin'
}
```

Uso real en la UI (ej. `AppNavigator`):
- Tab **Catálogos**: solo renderizado si `isAdminOrSuperAdmin(user)`.
- Sección **Sistema** (Roles/Usuarios/Auditoría/Configuración): solo si `isSuperAdmin(user)`.
- Botón "+" de PSR: solo si `hasPsrAdminRole(user)` (admin/super admin).

---

## 10. REGLAS DE NEGOCIO RESUMEN (NO OLVIDAR)

| # | Regla | Dónde se valida |
|---|---|---|
| 1 | Contraseña = **exactamente 8 dígitos** numéricos | Backend regex `^\d{8}$` (LocalAuthService + ChangePasswordRequest) y mobile (filtro input + regex) |
| 2 | Contraseña predeterminada = `00000000` | Backend al crear usuario (`BCrypt.hashpw("00000000", ...)`) y V12 backfill |
| 3 | Primer login obliga a cambiar contraseña | Flag `password_reset_required=true`; mobile redirige a PasswordChange |
| 4 | Nueva contraseña ≠ contraseña actual | `BCrypt.checkpw(new, hash)` en changePassword |
| 5 | Hash siempre BCrypt (nunca texto plano) | `org.mindrot.jbcrypt.BCrypt` |
| 6 | Token → SecureStore (nunca AsyncStorage) | `react-native-keychain` |
| 7 | URL API → persistida en SecureStore y aplicada por interceptor por request | `api.js` interceptor + `setApiUrl` |
| 8 | Usuario inactivo no puede loguear | `estado_activo == true` en loginLocal |
| 9 | User sin password_hash no puede loguear | `"Usuario sin contraseña configurada"` |
| 10 | 401 en cualquier endpoint → borra token y fuerza relogin | Interceptor de respuesta |
| 11 | JWT expira en 8 horas | `Duration.ofHours(8)` |
| 12 | Super Admin (id=1 / seed-superadmin) inmune a edición/eliminación | `UsuarioService.esSuperAdminProtegido` |

---

## 11. CHECKLIST DE REPLICACIÓN PASO A PASO

### Backend (Quarkus u otro framework REST)
- [ ] 1. Tablas `dim_roles` y `dim_usuarios` con los campos de la sección 3.
- [ ] 2. Migración/backfill: hash BCrypt de `00000000` a usuarios sin contraseña + `password_reset_required = TRUE`.
- [ ] 3. Endpoint `GET /auth/roles` → roles activos.
- [ ] 4. Endpoint `GET /auth/usuarios-by-rol/{rolId}` → usuarios activos del rol con `passwordResetRequired`.
- [ ] 5. Endpoint `POST /auth/local-login` → validar BCrypt + emitir JWT con claims (`sub`, `groups`, `nombre`, `rolId`, `area`, `dni`, `passwordResetRequired`).
- [ ] 6. Endpoint `POST /auth/change-password` → validar 8 dígitos, distinta de la actual, hashear, `password_reset_required=false`, emitir nuevo JWT.
- [ ] 7. Filtro/guard global: exige `Bearer <jwt>` en todos los endpoints excepto `/auth/`, `/health`, `/swagger`, `/q/`.
- [ ] 8. `@RolesAllowed` con nombres exactos `"Super Admin","Admin","Usuario"`.

### Mobile (React Native u otro cliente)
- [ ] 9. Módulo `api` con: lectura persistente de URL + token (SecureStore), interceptor de request que inyecta `baseURL` y `Authorization: Bearer`, interceptor de respuesta que limpia token ante 401.
- [ ] 10. Pantalla `ServerCheck`: prueba `GET /auth/roles`; si falla, form de URL con guardar/probar.
- [ ] 11. Pantalla `Login`: select Perfil → select Usuario (autocompleta `00000000` si `passwordResetRequired`) → input 8 dígitos → `local-login` → guardar token → decodificar.
- [ ] 12. Contexto `Auth` con `user/loading/refreshUser/logout`; opcional registro push.
- [ ] 13. Navegación condicional: sin sesión → ServerCheck/Login; `passwordResetRequired` → PasswordChange; else app principal.
- [ ] 14. Pantalla `Settings` (y/o botón "Configurar servidor" en Login) con `setApiUrl`/`Restablecer`.
- [ ] 15. Utilitario de roles (`isSuperAdmin`, `isAdminOrSuperAdmin`) para mostrar/ocultar secciones.

---

## 12. ARCHIVOS DE REFERENCIA (RUTAS REALES EN ESTE REPO)

| Capa | Archivo | Rol |
|---|---|---|
| Mobile | `mobile/src/api.js` | Config URL runtime, SecureStore, interceptores, `parseToken` |
| Mobile | `mobile/src/AuthContext.js` | Estado global de autenticación |
| Mobile | `mobile/src/LoginScreen.js` | Pantalla de login en 3 pasos + config servidor |
| Mobile | `mobile/src/screens/ServerCheckScreen.js` | Chequeo de conexión + form de URL |
| Mobile | `mobile/src/screens/PasswordChangeScreen.js` | Cambio de contraseña obligatorio |
| Mobile | `mobile/src/screens/SettingsScreen.js` | Configuración de URL dentro de la app |
| Mobile | `mobile/src/screens/PerfilScreen.js` | Datos del usuario (lee claims) y cierre de sesión |
| Mobile | `mobile/src/navigation/AppNavigator.js` | Navegación condicional por sesión/reset |
| Mobile | `mobile/src/utils/roles.js` | Permisos por rol |
| Backend | `backend/.../controller/AuthResource.java` | Endpoints `/auth/*` |
| Backend | `backend/.../service/LocalAuthService.java` | Lógica de login y cambio de contraseña |
| Backend | `backend/.../service/JwtService.java` | Emisión del JWT |
| Backend | `backend/.../security/JwtFilter.java` | Filtro global de JWT |
| Backend | `backend/.../security/SecurityUtil.java` | Obtener usuarioId desde el token (trazabilidad) |
| Backend | `backend/.../entity/Usuario.java` | Entidad JPA del usuario |
| Backend | `backend/.../repository/UsuarioRepository.java` | Consultas (usuarios por rol, activos) |
| Backend | `backend/.../service/UsuarioService.java` | CRUD de usuarios (crear con hash `00000000`) |
| Backend | `backend/.../dto/ChangePasswordRequest.java` | Validación Jakarta de `newPassword` |
| DB | `backend/src/main/resources/db/migration/V8__login_local.sql` | Columnas de login local |
| DB | `backend/src/main/resources/db/migration/V12__backfill_password_usuarios.sql` | Backfill de hash predeterminado |

---

*Documento de arquitectura de referencia — extraído del proyecto Control de Equipos de Apilamiento (React Native CLI + Quarkus + PostgreSQL).*