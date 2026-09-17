# Diagnóstico de cierre inmediato del APK

**Fecha:** 2026-09-03  
**Alcance:** auditoría del repositorio y reproducción en dispositivo Android conectado  
**Perfil aplicado:** `docs_implementacion/_perfiles/perfil_auditor.md`  
**Resultado:** **NO APTO / hallazgo crítico para distribución**

## 1. Resumen ejecutivo

El APK instalado se cierra inmediatamente por una excepción JavaScript fatal durante el arranque de React Native. La evidencia de `adb logcat` muestra:

```text
Invariant Violation: "InsectosBeneficos" has not been registered.
...
* A module failed to load due to an error and
  AppRegistry.registerComponent(...) wasn't called.
FATAL EXCEPTION: mqt_v_native
Process: com.InsectosBeneficos
```

Este mensaje es el efecto final: un módulo importado por `index.js`/`App.tsx` falla antes de ejecutar el registro del componente. No es un error de backend, red, permisos de cámara, firma ni falta de `libop-sqlite.so`; el propio log confirma que `libop-sqlite.so` carga correctamente.

La causa raíz inmediata confirmada es, por tanto, **fallo de carga del bundle JavaScript antes de `AppRegistry.registerComponent`**. El detalle de la excepción original no está preservado en el log release y debe obtenerse con un bundle instrumentado o aislamiento controlado de imports.

## 2. Evidencia reproducible

### Dispositivo y APK

- Paquete: `com.InsectosBeneficos`
- `versionName=1.8.0`, `versionCode=11`.
- APK instalado: `mobile/android/app/build/outputs/apk/release/app-release.apk`.
- El APK instalado reporta `lastUpdateTime=2026-09-03 16:08:23`.
- El commit HEAD del repositorio es `6295fb8` de `2026-09-03 16:14:08`.
- **Conclusión:** el APK instalado/artefacto disponible es anterior al último commit; no se puede atribuirle el contenido de `6295fb8` sin reconstruirlo.

### Reproducción

Comando ejecutado:

```text
adb -s 85ijey5tdax8ob5p shell am force-stop com.InsectosBeneficos
adb -s 85ijey5tdax8ob5p shell monkey -p com.InsectosBeneficos 1
adb -s 85ijey5tdax8ob5p logcat -d -v threadtime
```

Fragmentos relevantes:

- `mobile/src/db/sync/SyncManager.ts:60`: el arranque exporta `startSyncListener()`.
- `mobile/App.tsx:10-12`: `startSyncListener()` se invoca inmediatamente en `useEffect`.
- `mobile/index.js:5-9`: el registro depende de que todos los imports previos carguen sin excepción.
- Log: `ReactNativeJS: "InsectosBeneficos" has not been registered`.
- Log: `AndroidRuntime: FATAL EXCEPTION: mqt_v_native`.
- Log: `nativeloader: ... libop-sqlite.so ... ok`.

## 3. Relación con los últimos cambios

El cambio funcional inmediatamente anterior fue HITO-015 (`cf99fd2`), que introdujo:

- `@op-engineering/op-sqlite` y persistencia offline.
- Nuevas tablas/migración local en `mobile/src/db/database.ts:276-339`.
- Nuevos repositorios offline y nuevas pantallas de despacho, recepción y liberación.
- Cambios de `SyncManager` y navegación.

El commit posterior `6295fb8` añadió/corrigió la migración local 0003 y el procesamiento del outbox. Por ello existe una ventana de desincronización entre fuente y APK.

## 4. Hallazgos por gates

| Gate | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| G-APK | **Crítico** | La aplicación instalada se cierra al arrancar. | `adb logcat`: `FATAL EXCEPTION` + `AppRegistry...not been registered`. |
| G-MOB-BUILD | **Crítico** | El build release entregado no demuestra que el bundle corresponda al HEAD actual. | APK `16:08:23` vs HEAD `16:14:08`. |
| G-DEVOPS | Alto | `npm run lint` falla con 7 errores. | `AuthContext.tsx:20`, formularios nuevos, pantallas de historial/listado y programación. |
| G-TEST-FE | Medio | 150 tests/26 suites pasan, pero no cubren arranque real release ni `AppRegistry`. | `npm test -- --runInBand`: 150 passed. |
| G-ANAL | Alto | La integración nativa/offline no tiene una prueba de smoke release que detecte el fallo de carga JS. | No existe gate automatizado de instalación + launch + logcat. |
| G-DOC-SYNC | Alto | El estado artefacto↔fuente es ambiguo hasta reconstruir el APK desde `6295fb8`. | Versiones textuales sí están en 1.8.0/11, pero timestamp del APK es anterior. |

## 5. Verificaciones ejecutadas

- `npm test -- --runInBand`: **PASS**, 150 tests, 26 suites.
- `npm run lint`: **FAIL**, 7 errores y 14 warnings.
- `npx tsc --noEmit`: termina sin errores reportados.
- `react-native bundle`: no concluyente por `spawn EPERM` del entorno Windows al crear workers de Metro; no debe confundirse con el crash del dispositivo.
- Reproducción real con `adb`: **FAIL confirmado**.

Los tests pasan porque Jest mockea/aisla partes nativas y no ejecuta el flujo equivalente a un APK release Hermes en un dispositivo real.

## 6. Diagnóstico técnico para el desarrollador

### Causa confirmada

El runtime aborta porque el módulo de entrada no llega a ejecutar `AppRegistry.registerComponent`. El mensaje de registro ausente no es la causa original, sino el síntoma estándar de React Native cuando un import anterior lanza una excepción.

### Áreas de mayor probabilidad

1. Importación/transpilación de un módulo introducido o modificado en HITO-015.
2. Diferencia entre el bundle generado por el APK y el código actual, debido al APK anterior al último commit.
3. Inicialización/importación de la capa offline (`database.ts`, repositorios y `SyncManager`) en combinación con el bundle release.

La carga nativa de `libop-sqlite.so` fue observada como `ok`, así que **no debe comenzarse reemplazando la librería nativa** sin obtener primero la excepción original.

## 7. Alternativas de solución

### Alternativa A — Recomendada: aislar el import que falla y corregirlo

1. Generar un APK desde el commit HEAD actual, con limpieza de build y una etiqueta de artefacto.
2. Ejecutar con `adb logcat` capturando desde el lanzamiento y conservar toda la traza JS.
3. Aislar temporalmente, en una rama de diagnóstico, el import de `startSyncListener` y luego los imports de `SyncManager`/repositorios para identificar el primer módulo que impide registrar la app.
4. Corregir únicamente el módulo causante y agregar un smoke test de arranque release.

**Ventaja:** mantiene la arquitectura offline y produce evidencia causal.  
**Riesgo:** requiere reconstruir e instalar un APK trazable.

### Alternativa B — Mitigación rápida: diferir la inicialización offline

Mover la inicialización de sincronización/base local detrás de un arranque seguro, capturando el error y mostrando una pantalla de recuperación. `AppRegistry` debe poder registrar la aplicación aunque SQLite/sync esté indisponible.

**Ventaja:** evita que una falla secundaria cierre toda la aplicación.  
**Riesgo:** puede ocultar una regresión; no reemplaza la corrección raíz.

### Alternativa C — Rollback operativo

Distribuir temporalmente el último APK que haya sido verificado antes de HITO-015 y reabrir HITO-015 hasta obtener smoke test release PASS.

**Ventaja:** restaura disponibilidad rápidamente.  
**Riesgo:** pierde temporalmente despacho/recepción/liberación y no corrige el defecto.

## 8. Plan de corrección evaluable

1. Reconstruir `assembleRelease` desde `6295fb8` o desde el commit corregido; registrar SHA, timestamp, hash SHA-256 y versión.
2. Instalar el APK en el mismo dispositivo; capturar `logcat` desde cero.
3. Obtener la excepción original anterior al mensaje `not been registered`.
4. Corregir el módulo identificado; no cambiar arquitectura por suposición.
5. Ejecutar `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run lint` y `gradlew assembleRelease`.
6. Agregar prueba de smoke: instalación, lanzamiento y ausencia de `FATAL EXCEPTION`/`not been registered`.
7. Repetir en instalación limpia y actualización sobre versión previa.
8. Actualizar `versionHistory.js`, documentación y artefacto conforme a Ley 3.

## 9. Decisión de auditoría

**HITO-015 / APK 1.8.0: RECHAZADO para distribución.** Hay un hallazgo crítico reproducido en dispositivo real. El desarrollador debe corregirlo y aportar un APK reconstruido y verificable. Los tests unitarios pasando no neutralizan el fallo de arranque release.

## 10. Datos que debe adjuntar el desarrollador al corregir

- SHA del commit fuente.
- Fecha/hora y SHA-256 del APK.
- Salida completa de `adb logcat` del arranque.
- Resultado de lint, TypeScript y tests.
- Evidencia de instalación limpia y actualización.
- Confirmación de que `AppRegistry.registerComponent` se ejecutó sin excepción.
