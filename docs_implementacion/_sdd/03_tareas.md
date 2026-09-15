# SOFTWARE DEVELOPMENT DOCUMENT (SDD)
# 03_TAREAS.md

---

# 1. Objetivo del Documento

Registrar el desglose de tareas del proyecto y su estado (Ley 2 — estado en disco).

---

# 2. Estrategia General de Desarrollo

Tareas descompuestas por el Orchestrator y ejecutadas por un único Developer por tarea;
cada tarea cierra con verificación (Ley 5) y, al fin del HITO, auditoría integral PASS.

---

# 3. Estructura de Gestión de Tareas

| Prefijo | Área |
|---|---|
| BE- | Backend |
| MO- | Mobile |
| WEB- | Web |
| BD- | Base de datos |

---

# 4. Estados de Tareas

| Estado | Descripción |
|---|---|
| Pendiente | No iniciada |
| En Progreso | En ejecución |
| En Validación | Verificación/auditoría |
| Completado | Implementada y verificada |
| Bloqueado | Bloqueo humano/técnico |
| Cancelado | Descartada |

---

# 5. Prioridades de Desarrollo

| Prioridad | Descripción |
|---|---|
| Crítica | Bloquea el HITO |
| Alta | Requerida antes del próximo HITO |
| Media | Mejora |
| Baja | Opcional |

---

# 6. Roadmap General de Desarrollo

| Orden | Componente |
|---|---|
| 1 | Vertical 1: usuarios/autenticación (HITO-001) — CERRADA |
| 2 | Auth v2: login 3 pasos + roles tabla + URL runtime + /api/v1 (HITO-002) — CERRADA |
| 3 | UI Vanguard + navegación mobile (HITO-003) — CERRADA |
| 4 | Módulo Programación de Stock (HITO-004) — CERRADA |
| 5 | Módulo de Requerimientos mobile (HITO-005) — CERRADA |
| 6 | Catálogos agrícolas y de requerimientos (HITO-006/007) — CERRADAS |
| 7 | Backend de Requerimientos (HITO-008) — CERRADA |
| 8 | Fix CatalogosScreen (HITO-009) — CERRADA |
| 9 | Fotos backend + mobile API (HITO-010) — CERRADA |
| 10 | Wire fotos a screens mobile (HITO-011) — CERRADA |
| 11 | Tabla intra-semana de Programación: Lunes/Jueves reales + Restante + pull-to-refresh (HITO-012) — CERRADA |
| 12 | Web + CI/CD — PENDIENTE |
| 13 | Evidencias, actas PDF, dashboard KPI |

---

# 7. Tareas de Infraestructura

| ID | Tarea | Prioridad |
|---|---|---|
| INF-001 | docker-compose PostgreSQL 16 (raíz) | Alta — Completado |

---

# 8. Tareas Base de Datos

| ID | Tarea | Prioridad |
|---|---|---|
| BD-001 | Migración V1 usuarios (enums, timestamps, soft delete) | Alta — Completado |
| BD-002 | Migración V2 seed SUPER_ADMIN (Admin PowerApps / 00000000) | Alta — Completado |
| BD-003 | Migración V3: tabla `roles` (3 literales con espacios) + `usuarios.rol_id` FK + migración de datos + rollback documentado (H12) | Alta — Completado (HITO-002) |
| BD-004 | Migración V4: tabla `programaciones`/`especies`/`detalle_programacion` | Alta — Completado (HITO-004) |
| BD-005 | Migraciones V6/V7: fundos/variedades/lotes (3NF) | Alta — Completado (HITO-006) |
| BD-006 | Migraciones V8/V9: etapas_fenologicas/plagas/nematodos/patrones | Alta — Completado (HITO-007) |
| BD-007 | Migración V10: tabla `requerimientos` | Alta — Completado (HITO-008) |
| BD-008 | Migración V11: tabla `fotos_requerimiento` | Alta — Completado (HITO-010) |
| BD-009 | Migración V12: `detalle_programaciones` pasa a UNIQUE(programacion_id, fecha) para filas intra-semana (Lunes/Jueves reales) | Alta — Completado (HITO-012) |

---

# 9. Tareas Backend

| ID | Tarea | Prioridad |
|---|---|---|
| BE-001 | Scaffold Quarkus + Maven Wrapper | Alta — Completado |
| BE-002 | Login JWT local por `usuario` (anti-enumeración, inactivo→403) | Alta — Completado (reemplazado por BE-006 en v2) |
| BE-003 | Cambio de contraseña obligatorio (DNI máx 8) | Alta — Completado |
| BE-004 | CRUD usuarios con RBAC y soft delete | Alta — Completado |
| BE-005 | Tests REST (26) + package jar | Alta — Completado |
| BE-006 | Auth v2 (ADR-A003): tabla roles, login 3 pasos (`roles`, `usuarios-by-rol/{rolId}`, `local-login`), `change-password` → nuevo JWT, claims (groups/rolId/dni/passwordResetRequired), Super Admin id=1 inmune | Alta — Completado (HITO-002) |
| BE-007 | `/api/v1` en todo el API + `quarkus-smallrye-openapi` (resuelve H5) | Alta — Completado (HITO-002) |
| BE-008 | Tests auth v2 actualizados/ampliados (roles, usuarios-by-rol, local-login, change-password+JWT, id=1 inmune) | Alta — Completado (HITO-002) |
| BE-009 | Programaciones/especies (HITO-003/004): endpoints listar/crear/editar/publicar + RBAC días lunes/jueves | Alta — Completado (HITO-004) |
| BE-010 | Catálogos agrícolas (fundos/variedades/lotes) y de requerimientos (etapas/plagas/nematodos/patrones) | Alta — Completado (HITO-006/007) |
| BE-011 | Backend de requerimientos: V10, /requerimientos (GET/POST/PUT), /stock, ciclo de estados, validación RF-165 | Alta — Completado (HITO-008) |
| BE-012 | Fotos de requerimiento: V11, entity/repository/DTO/service/resource, upload ≤5MB JPG/PNG, max 2, IDOR | Alta — Completado (HITO-010) |
| BE-013 | Quitar autogeneración de programaciones en GET (solo devuelve las existentes) + test ajustado | Alta — Completado (INC-2) |
| BE-014 | Tabla intra-semana de programación: crear Lunes/Jueves reales del mes + update con remanente acumulado (puede ser negativo) + sort por fecha | Alta — Completado (HITO-012) |

---

# 10. Tareas Frontend Android

| ID | Tarea | Prioridad | Estado |
|---|---|---|---|
| MO-001 | Navegación react-navigation (auth flow) | Alta | Completado |
| MO-002 | Login por usuario+contraseña | Alta | Completado (reemplazado por MO-006 en v2) |
| MO-003 | Cambio de contraseña obligatorio (DNI) | Alta | Completado (adaptado en v2: usa nuevo JWT) |
| MO-004 | Homes por perfil (2 botones / 2 divs SUPER_ADMIN) | Alta | Completado |
| MO-005 | Lint + tests + APK (evidencia existente) | Alta | Completado |
| MO-006 | Login v2 3 pasos (rol→usuario→DNI, autocompleta 00000000) | Alta | Completado (HITO-002) |
| MO-007 | `react-native-keychain` (token+URL seguros) + axios interceptors (baseURL, Bearer, 401→cleanup, timeout 15s) | Alta | Completado (HITO-002) |
| MO-008 | ServerCheckScreen + SettingsScreen/Configurar servidor (URL runtime) | Alta | Completado (HITO-002) |
| MO-009 | AuthContext `refreshUser(token)` + `utils/roles.js` (isSuperAdmin/isAdminOrSuperAdmin) + navegación condicional | Alta | Completado (HITO-002) |
| MO-010 | Lint + tests + **APK v2 rebuild OBLIGATORIO** (keychain nativo) | Alta | Completado (HITO-002) |
| MO-011 | Módulo Programación de Stock: listado/edición/creación por mes, restricción lunes/jueves | Alta | Completado (HITO-004) |
| MO-012 | Módulo de Requerimientos: panel, listado, formulario, nuevo con stock, historial, edición alerta 30h | Alta | Completado (HITO-005) |
| MO-013 | Pantallas de catálogos (fundos, variedades, lotes, etapas, plagas, nematodos, patrones) | Alta | Completado (HITO-006/007) |
| MO-014 | Fix CatalogosScreen: flakiness bajo ejecución paralela (resuelto con --runInBand) | Alta | Completado (HITO-009) |
| MO-015 | ApiClient: funciones fotos (subir/listar/eliminar) + 5 tests | Alta | Completado (HITO-010) |
| MO-016 | Wire fotos a screens: hook usePhotoCapture (DRY) + upload crear + cargar/subir/eliminar editar + thumbnails historial | Alta | Completado (HITO-011) |
| MO-017 | Tabla intra-semana de programación: columnas Sem/Fecha/Papel/Sobre/Total/Restante, fecha corta (Lun 03), restante con excedido, inputs vacíos, fondo alternado + pull-to-refresh en listado | Alta | Completado (HITO-012) |
| MO-018 | Fixes offline/online post-HITO-013: API fallback en edición, chip PENDIENTE, cards bg, estado default | Alta | Completado (v1.6.2) |
| MO-019 | Bump versión 1.6.2 / versionCode 9 + versionHistory | Alta | Completado (v1.6.2) |
| MO-020 | Módulo Cumplimiento de Producción: botón lápiz/lupa en semana actual, modal registro/consulta | Alta | Completado (v1.7.0) |
| MO-021 | Liberación parcial acumulada: `Cantidad (millares)` = pendiente (`cantidad − Σ(papel+sobre)`), defaults por restante de presentación, validación `papel+sobre ≤ pendiente`, helpers en `utils/requerimientos.ts` + 15 tests | Alta | Completado (v1.12.0 / HITO-017) |
| BE-015 | Backend cumplimiento producción: V14, entity, repository, DTO, resource, upsert | Alta | Completado (v1.7.0) |
| BE-016 | Liberación por lote (V21) + plagas por liberación y `fechaLiberacion` editable (V22 `liberacion_plagas`), `CrearLiberacionRequest.plagas`, `LiberacionDto.plagas` | Alta | Completado (v1.12.0 / HITO-017) |

---

# 11. Tareas Frontend Web

| ID | Tarea | Prioridad | Estado |
|---|---|---|---|
| WEB-001 | Scaffold React+Vite+MUI | Alta | Pendiente |

---

# 12. Tareas Seguridad

| ID | Tarea | Prioridad |
|---|---|---|
| SEG-001 | JWT HS256 + RBAC por perfil | Alta — Completado |
| SEG-002 | Secrets por env + rate limiting + CORS explícito | Alta — Pendiente (deuda H10) |
| SEG-003 | Secure Storage (keychain) + token/URL seguros + 401 cleanup | Alta — Completado (HITO-002, resuelve H9 parcial) |
| SEG-004 | Super Admin seed id=1 inmune (no desactivar/eliminar) | Alta — Completado (HITO-002) |

---

# 13. Tareas Auditoría

| ID | Tarea | Prioridad |
|---|---|---|
| AUD-001 | Gate review integral HITO-001 | Alta — Completado (PASS condicionado, 0 críticos) |
| AUD-002 | Gate review INC-1 (backend v2) | Alta — Completado (PASS condicionado: M1 remediado, M2-M4 deuda) |
| AUD-003 | Gate review INC-2 (mobile v2) | Alta — Completado (PASS condicionado: F1/F2 remediados) |
| AUD-004 | Auditoría integral HITO-002 | Alta — Completado (PASS técnico integral, 0 críticos/0 altos) |

---

# 14. Tareas Evidencias Fotográficas

| ID | Tarea | Prioridad |
|---|---|---|
| FOTO-001 | Módulo evidencias fotográficas | Media — **Parcial** (backend + API + wire a screens en HITO-010/011; pendiente endpoint de descarga/serving) |

---

# 15. Tareas Dashboard KPI

| ID | Tarea | Prioridad |
|---|---|---|
| KPI-001 | Dashboard (hito futuro) | Media — Pendiente |

---

# 16. Tareas Reportes PDF

| ID | Tarea | Prioridad |
|---|---|---|
| PDF-001 | Reportes/actas iText (hito futuro) | Media — Pendiente |

---

# 17. Tareas QA y Testing

| ID | Tarea | Prioridad |
|---|---|---|
| QA-001 | Tests flujos críticos mobile (RNTL) | Alta — Pendiente (deuda H6) |
| QA-002 | Cobertura backend con jacoco | Media — Pendiente (deuda H17) |
| QA-003 | Tests auth v2 mobile (login 3 pasos, ServerCheck, cambio password→nuevo JWT) | Alta — Completado (HITO-002) |

---

# 18. Tareas Despliegue

| ID | Tarea | Prioridad |
|---|---|---|
| DEP-001 | CI/CD GitHub Actions | Alta — Pendiente |
| DEP-002 | Nginx/HTTPS/VPS prod | Media — Pendiente |

---

# 19. Dependencias Técnicas

| Componente | Dependencia |
|---|---|
| Backend | Maven Wrapper (mvn no está en PATH) |
| Mobile | Gradle Wrapper (gradle no está en PATH) |
| BD | Docker (postgres:16) |

---

# 20. Riesgos Técnicos

| Riesgo | Impacto |
|---|---|
| Secrets dev hardcodeados | Alto en prod |
| Token en memoria (mobile) | Alto en distribución |
| API sin versionar antes de crecer | Medio |

---

# 21. Consideraciones Finales

Todo avance deja estado en disco (Ley 2). La deuda técnica está registrada en `05_hito_001.md` §5
y priorizada para el siguiente HITO.
