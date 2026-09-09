# Instrucciones para agente — eliminar completamente el runtime offline y corregir crash de arranque

## Objetivo único

Dejar `InsectosBeneficios` **100% funcional en modo online** y eliminar del runtime cualquier dependencia offline que pueda provocar el crash de arranque del APK.

**No reimplementar offline. No agregar sincronización. No crear fallback SQLite. No cambiar reglas de negocio.**

La misión termina cuando el APK release arranca correctamente en un teléfono Android y permite utilizar el flujo online normal.

## Punto de partida

- Repositorio: `jaanyarin/rep_entrega_insectos_beneficos`
- Commit base: `3d7f8032860b6a9d5bee3aef4247d8981c3e7ca5`
- Rama recomendada: `fix/online-only-startup-3d7f803`

No sustituir este objetivo por upgrades, rediseños o refactors no relacionados.

## Diagnóstico conocido

El historial documenta que `@op-engineering/op-sqlite` falla en el APK release con:

```text
undefined is not a function
```

al utilizar `getDatabase().open()`.

El síntoma posterior en Android es:

```text
Invariant Violation: "InsectosBeneficios" has not been registered
```

Ese mensaje **no debe considerarse la causa primaria**: normalmente significa que una excepción ocurrió durante la carga del bundle antes de `AppRegistry.registerComponent`.

Por tanto, investigar la cadena de imports e inicialización, especialmente módulos offline/nativos todavía alcanzables por el runtime.

## Arquitectura objetivo

El runtime debe quedar conceptualmente:

```text
App
 ├── AuthProvider
 ├── RootNavigator
 │    ├── ServerCheck
 │    ├── Login
 │    └── pantallas funcionales
 └── ApiClient
      └── Axios
           └── API REST
```

No debe existir en esa cadena:

```text
App -> SyncManager -> SQLite -> op-sqlite
App -> NetInfo
App -> Drizzle -> SQLite
```

## Cambios obligatorios

### 1. `ApiClient.ts`

Eliminar cualquier import/uso de:

```ts
@react-native-community/netinfo
```

El cliente HTTP trabaja directamente contra la API.

Ante HTTP `401`:

1. limpiar token;
2. notificar al contexto de autenticación;
3. propagar el error.

No consultar conectividad para decidir si se conserva una sesión.

### 2. `AuthContext.tsx`

Eliminar la semántica de autenticación offline.

Se puede conservar el JWT en `react-native-keychain` para restaurar la sesión al reabrir la aplicación, pero **eso no constituye soporte offline**.

Reglas:

- token válido -> restaurar usuario;
- token inválido -> eliminarlo;
- operaciones de negocio -> siempre API REST;
- `401` -> invalidar sesión;
- sin NetInfo;
- sin SQLite;
- sin SyncManager.

### 3. `ServerCheckScreen.tsx`

Eliminar cualquier bypass basado en JWT o modo offline.

Flujo obligatorio:

1. arrancar aplicación;
2. verificar API;
3. API responde -> Login;
4. API no responde -> mostrar error;
5. permitir modificar/restablecer URL;
6. reintentar.

No permitir:

```text
JWT válido + servidor inaccesible -> entrar igualmente
```

### 4. `package.json`

Eliminar de las dependencias móviles todo lo que ya no sea necesario para online-only, especialmente:

```text
@op-engineering/op-sqlite
@react-native-community/netinfo
drizzle-orm
```

Eliminar herramientas exclusivamente asociadas a Drizzle/SQLite, por ejemplo:

```text
drizzle-kit
```

Después de modificar `package.json`, **regenerar obligatoriamente `package-lock.json`** con una instalación limpia.

No dejar dependencias obsoletas en el lockfile.

## Código offline histórico

No es obligatorio borrar inmediatamente `mobile/src/db`, repositorios offline o código histórico si eliminarlos aumenta innecesariamente el alcance.

Pero ningún código alcanzado por el runtime puede importarlos o inicializarlos.

Comprobar especialmente:

- `SyncManager` no se ejecuta;
- `useOnlineStatus` no participa en pantallas activas;
- `OfflineBanner` no participa en el flujo online;
- `SyncIndicator`/`SyncToast` no cargan dependencias nativas offline;
- SQLite no se inicializa al arrancar;
- NetInfo no se importa desde servicios compartidos ni pantallas activas.

## Investigación obligatoria

Buscar globalmente en `mobile`:

```text
@op-engineering/op-sqlite
@react-native-community/netinfo
Drizzle
/drizzle
src/db
SyncManager
useOnlineStatus
OfflineBanner
SyncIndicator
SyncToast
```

Para cada coincidencia determinar si es código muerto, import estático, inicialización de arranque, dependencia de pantalla activa o dependencia nativa autolinkeada.

No basta con eliminar una llamada a SQLite: hay que romper toda la cadena de ejecución que pueda alcanzarla.

## Tests

### Smoke test real

El smoke test debe cargar:

```text
App -> AuthProvider -> RootNavigator real -> pantallas reales
```

No mockear `RootNavigator` completo. Ese mock puede ocultar precisamente el error de importación que causa el crash real.

### Validación JS/TS

Ejecutar:

```bash
npm install
npm test -- --runInBand
npx tsc --noEmit
npm run lint
```

Si existen fallos preexistentes, documentarlos. No ocultar errores nuevos modificando tests artificialmente.

## Limpieza Android

Después de eliminar dependencias nativas, hacer una reconstrucción limpia.

Windows:

```powershell
cd mobile
npm install
cd android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

La limpieza es obligatoria para evitar que el APK conserve artefactos nativos de una compilación anterior.

## Validación del APK real

La validación final debe hacerse en un teléfono Android real.

Antes de abrir la app:

```bash
adb logcat -c
adb logcat
```

Abrir la aplicación y buscar:

```text
FATAL EXCEPTION
AndroidRuntime
Invariant Violation
has not been registered
op-sqlite
NetInfo
SQLite
```

El objetivo es cero excepciones fatales durante el arranque.

## Validación funcional mínima

### Arranque

- [ ] Abre sin cerrarse.
- [ ] No aparece `InsectosBeneficios has not been registered`.
- [ ] Server Check funciona.
- [ ] Se puede configurar/restablecer URL.

### Autenticación

- [ ] Login contra backend funciona.
- [ ] JWT se almacena correctamente.
- [ ] Reapertura restaura sesión cuando corresponda.
- [ ] `401` invalida sesión.

### Navegación

- [ ] RootNavigator real carga correctamente.
- [ ] No hay pantalla en blanco por import fallido.
- [ ] Las pantallas activas no dependen de SQLite/NetInfo.

### API

- [ ] GET funciona.
- [ ] POST funciona.
- [ ] PUT funciona.
- [ ] DELETE funciona cuando corresponda.
- [ ] Upload de fotografías funciona si forma parte del flujo.

### Regresión

- [ ] No se reintrodujo código offline en runtime.
- [ ] No se cambiaron reglas de negocio innecesariamente.
- [ ] No se modificó backend salvo incompatibilidad real demostrada.

## Criterio de aceptación

No declarar terminado solo porque pasan tests, TypeScript compila o Gradle genera un APK.

El flujo requerido es:

```text
3d7f803
  -> eliminar runtime offline
  -> eliminar dependencias nativas offline
  -> regenerar package-lock
  -> limpiar Android
  -> crear APK release
  -> instalar APK real
  -> abrir aplicación
  -> SIN crash
  -> Login
  -> API REST
  -> funcionalidad normal
```

## Restricciones

No hacer:

- reimplementar offline;
- crear fallback SQLite;
- usar AsyncStorage como sustituto de SQLite para datos de negocio;
- introducir otra librería de conectividad;
- envolver globalmente el arranque en `try/catch` para ocultar excepciones;
- modificar `AppRegistry` para ocultar `has not been registered`;
- desactivar errores de React Native;
- modificar reglas de negocio para conseguir tests verdes;
- afirmar que el APK está corregido sin probar el release en Android real.

## Resultado esperado

La aplicación debe quedar como **online-only**:

```text
React Native
    ↓
Auth / Keychain
    ↓
Axios / ApiClient
    ↓
REST API
```

SQLite, Drizzle, NetInfo y SyncManager no deben formar parte del runtime de esta versión.

La prioridad absoluta es **arranque estable + funcionamiento online**.
