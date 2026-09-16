/**
 * versionHistory.js — Historial de versiones visible al usuario.
 * Fuente de verdad del historial (Ley 3). web/ la adoptará cuando exista.
 * Formato: array de {version, fecha, cambios[]}.
 */

const versionHistory = [
  {
    version: '1.14.0',
    fecha: '2026-09-16',
    cambios: [
      'Notificaciones multi-canal: correo SMTP (relay interno Exchange) + push FCM + notificaciones in-app.',
      'Firebase Cloud Messaging (FCM): el backend envía notificaciones push a todos los usuarios con token registrado.',
      'Centro de notificaciones in-app: nueva pantalla "Notificaciones" accesible desde Home para todos los perfiles.',
      'Los correos ahora se envían desde el relay interno de la empresa (puerto 25, sin autenticación).',
      '4 eventos de notificación: programación publicada, requerimiento creado, cambio de estado, requerimiento entregado.',
    ],
  },
  {
    version: '1.13.0',
    fecha: '2026-09-14',
    cambios: [
      'Notificaciones por correo: la programación publicada se notifica por email a los usuarios de Sanidad (Usuario) que tengan correo cargado.',
      'Al marcar un requerimiento como Entregado, el solicitante recibe un correo automático.',
      'Catálogos > Usuarios: nuevo campo "Correo electrónico" (opcional) para recibir las notificaciones; se puede cargar, corregir o limpiar.',
      'El correo se valida (formato y no duplicado) y se guarda normalizado en minúsculas.',
    ],
  },
  {
    version: '1.12.0',
    fecha: '2026-09-14',
    cambios: [
      'Liberación parcial acumulada: al liberar un lote, la cantidad mostrada es el pendiente por liberar (cantidad pedida menos la suma de papel + sobre de las liberaciones ya registradas), no el total pedido.',
      'Ejemplo: requerimiento de 140 millares con 2 lotes; al liberar el primero con 60 papel + 20 sobre, la siguiente liberación muestra 60 millares.',
      'Papel con postura y Sobre con cascarilla se pre-llenan con el restante por presentación (40 y 20 en el ejemplo).',
      'No se permite guardar una liberación cuya suma de papel + sobre supere el pendiente: el botón "Guardar liberación" se bloquea con mensaje.',
      'La cantidad liberada que se guarda en cada liberación es la suma de papel + sobre de esa liberación.',
    ],
  },
  {
    version: '1.11.1',
    fecha: '2026-09-10',
    cambios: [
      'Fix stock source: ahora consulta cumplimiento_programacion.total_real (antes detalle_programaciones.stock_final).',
      'Screen 13 (ENTREGADO): campos papel/sobre, plaga multi-select y fecha/hora habilitados con defaults del sistema.',
      'Screen 12: auto-refresh al volver de edición (focus listener).',
    ],
  },
  {
    version: '1.11.0',
    fecha: '2026-09-09',
    cambios: [
      'Multi-select de Lotes y Plagas: selección múltiple con tablas pivote en BD (requerimiento_lotes, requerimiento_plagas).',
      'Nuevo componente MultiSelectField con checkboxes y chips visuales.',
      'Stock disponible ahora muestra el stock del último L o J (no el mensual 5000).',
      'Fotos deshabilitadas al crear requerimiento (solo se usan en recepción/despacho).',
      'Backend: migración V19 (tablas pivote), entities RequerimientoLote/Plaga, DTOs con listas.',
      'Evidencia de entrega en estado Aprobado: la sección de fotos (cámara/galería) ahora también aplica en APROBADO, no solo en Entregado.',
      'Botón "Ver Detalle" eliminado del historial (redundante) y botón "Acta PDF" eliminado del formulario admin.',
      'El detalle de requerimiento (historial, edición y detalle) ahora muestra todos los lotes y plagas seleccionados.',
      'Fotos almacenadas como bytes en la base de datos (BYTEA, migración V20) en lugar de archivos en disco; las fotos legacy V11 siguen soportadas.',
      'Liberación por lote (V21): columna liberado en requerimiento_lotes, papel/sobre por liberación en liberaciones.',
      'Screen 7 (admin): botones dinámicos "Por Aprobar" / "Por Entregar" / "Revisar" según estado.',
      'Screen 8 (admin): modo readOnly para estado ENTREGADO (vista de detalle sin edición).',
      'Screen 12 (user): botón dinámico "Por Liberar X de X" para estado ENTREGADO.',
      'Screen 13 (user): reescritura completa — APROBADO solo lectura, ENTREGADO formulario de liberación por lote.',
    ],
  },
  {
    version: '1.10.0',
    fecha: '2026-09-09',
    cambios: [
      'Dockerización completa: backend Quarkus + nginx + PostgreSQL corriendo todo desde Docker (docker-compose "repo_registro_insectos_beneficos").',
      'Backend en contenedor con zona horaria America/Lima (ENV TZ + -Duser.timezone) para alinear día de edición L/J con la hora de Perú.',
      'Creación de programación disponible TODOS los días: el flujo crear (POST → PUT → publicar) ya no cae en la restricción L/J de edición.',
      'Nueva tabla de programación se muestra de inmediato al entrar a "Nuevo" (sin esperar a seleccionar especie) y queda habilitada para digitar valores.',
      'Al seleccionar especie en modo crear ya no se regenera la tabla (no borra lo digitado); la especie solo habilita "Enviar stock".',
      'Backend: campo esCreacionInicial en UpdateProgramacionRequest + test determinístico de creación sin restricción de día.',
      'Sincronización de versiones: package.json, build.gradle (versionCode 13), appVersion.ts a 1.10.0.',
    ],
  },
  {
    version: '1.9.0',
    fecha: '2026-09-08',
    cambios: [
      'Herramienta de diagramas Archify: generación de diagramas de arquitectura, workflow, sequence, dataflow y lifecycle como HTML interactivo autocontenido.',
      'Instalación global de Archify como Agent Skill para OpenCode.',
      'Diagrama de arquitectura del sistema generado en docs_implementacion/_diagramas/.',
      'Sincronización de versiones: package.json, build.gradle (versionCode 12), appVersion.ts a 1.9.0.',
      'Descarte de modo offline documentado: AGENTS.md §7, 04_implementacion.md §63.',
      'Tests de flujo crítico e2e: login (13), requerimiento (11), ciclo-entrega (13) — suite total 127 tests.',
      'Documentación actualizada: AGENTS.md, README.md, orchestrator.md con uso de Archify.',
    ],
  },
  {
    version: '1.8.0',
    fecha: '2026-09-03',
    cambios: [
      'Flujo Despachos → Recepción → Liberación: ciclo completo de estados APROBADO → ENTREGADO → RECIBIDO → LIBERADO.',
      'Pantalla de detalle de requerimiento con botones de acción contextuales según estado.',
      'Módulo de Despachos: listado y registro (Admin/Super Admin) con validación cantidad ≤ requerida.',
      'Módulo de Recepciones: listado y confirmación (Admin/Usuario) con conforme/observaciones.',
      'Módulo de Liberaciones: listado y registro (Admin/Usuario) con selector fundo→lote dependiente.',
      'Backend: migraciones V15 (despachos), V16 (recepciones), V17 (liberaciones) con ciclo de estados.',
      'Offline completo para perfil Usuario: crear/editar/recepción/liberación/historial con sync outbox.',
      'Histórico de requerimientos: botón "Ver Detalle" para acceder a acciones de despacho/recepción/liberación.',
    ],
  },
  {
    version: '1.7.0',
    fecha: '2026-09-02',
    cambios: [
      'Módulo de Cumplimiento de Producción: registro real vs programado por semana.',
      'Botón de lápiz (editar) / lupa (ver) en la semana actual de la tabla de programación.',
      'Modal de registro: inputs de papel y sobre producido con total automático.',
      'Modal de consulta: valores registrados + porcentaje de cumplimiento vs programado.',
      'Backend: migración V14, entity, repository, DTO, resource con upsert por detalle.',
      'Offline: repository SQLite para cumplimiento con persistencia local.',
    ],
  },
  {
    version: '1.6.2',
    fecha: '2026-09-02',
    cambios: [
      'Edición de requerimiento: fix silencioso — "Guardar" no persistía cambios cuando los datos se cargaban desde API (SQLite falla en release APK). Ahora usa PUT al servidor cuando el registro viene del backend.',
      'Estado default al crear requerimiento: PENDIENTE (antes REGISTRADO) para alinear con el flujo operativo.',
      'Chip de estado PENDIENTE: color orange #DB9647 con fondo suave #FAEBD8 (design system §16).',
      'Cards de solicitudes (admin): fondo amarillo suave #FAEBD8 cuando el estado es PENDIENTE.',
      'RequerimientoFormScreen: API fallback robusto — SQLite y API están en try/catch independientes; fallo de uno no bloquea el otro.',
      'HistorialRequerimientoScreen: fechas default (lunes→hoy) + API fallback + auto-carga al montar.',
      'RequerimientosPanelScreen y RequerimientosListScreen: API fallback cuando SQLite falla + fechas default.',
      'ProgramacionScreen tests: meses dinámicos para evitar date-rollover.',
    ],
  },
  {
    version: '1.6.1',
    fecha: '2026-08-30',
    cambios: [
      'Corrección de bug en decodificación base64url de JWT (token.ts): el padding de tokens sin claim exp fallaba silenciosamente, impidiendo la restauración de sesión offline.',
      'Suite de testing completa: 150 tests (26 suites) con 0 failures — mocks globales de useOnlineStatus e isTokenExpired para tests de UI.',
      'Corrección de 7 tests de UI afectados por la integración de OfflineBanner/useOnlineStatus (HITO-013 FASE 6).',
    ],
  },
  {
    version: '1.6.0',
    fecha: '2026-08-27',
    cambios: [
      'La tabla de programación ahora muestra una fila por cada Lunes y Jueves reales del mes (variable, ~8) en vez de 4 semanas fijas.',
      'Nuevo indicador "Restante": stock base (5,000 millares) menos el acumulado por fila; puede volverse negativo y muestra el excedido en rojo para trazabilidad.',
      'Campos de papel/sobre vacíos cuando el valor es 0 (no muestran "0"), con fondo suave alternado por semana para agrupar Lunes+Jueves.',
      'Listado de programaciones con pull-to-refresh para recargar el periodo sin salir de la pantalla.',
    ],
  },
  {
    version: '1.5.0',
    fecha: '2026-08-26',
    cambios: [
      'Módulo de fotos de requerimiento: subida, listado y eliminación de evidencias (backend + app).',
      'Carga y visualización de fotografías al crear, editar y consultar el historial de requerimientos.',
      'Hook compartido usePhotoCapture para la captura de cámara/galería con validación (JPG/PNG, máx 2, ≤5 MB).',
      'Catálogos agrícolas (fundos, variedades, lotes) y de requerimientos (etapas, plagas, nematodos, patrones).',
      'Backend de requerimientos: ciclo completo de estados, validación papel+sobre = cantidad y control de stock.',
      'Las programaciones ya no se autogeneran: solo se muestran las que existen y se crean manualmente.',
    ],
  },
  {
    version: '1.4.0',
    fecha: '2026-08-24',
    cambios: [
      'Módulo Requerimientos: panel de solicitudes (admin) con indicador de pendientes y proyección mensual.',
      'Listado de solicitudes con filtro de rango de fechas y galería por estado con color exacto (RN-022).',
      'Formulario de solicitud (admin) con modo creación/edición y validación papel+sobre = cantidad.',
      'Panel de requerimientos (user) con proyección del mes, consumo vs disponibilidad y accesos.',
      'Formulario de nuevo requerimiento con stock en tiempo real y validación cantidad ≤ stock.',
      'Historial de requerimientos con popup de detalle y edición con foto de liberación (stub) y alerta de 30 h.',
      'Navegación mobile del módulo Requerimientos (rutas y screens del Home).',
    ],
  },
  {
    version: '1.3.0',
    fecha: '2026-08-21',
    cambios: [
      'Módulo Programación: listado por mes con selector de periodo y detalle de semanas.',
      'Edición de programación con filtro de mes y especie, tabla editable de proyección y envío de stock.',
      'Creación de programación (botón "Nuevo") para Admin/Super Admin con validación de duplicados.',
      'Proyección mensual con stock inicial (5,000 millares), cálculo automático de Total y stock final.',
      'Backend: endpoint POST /api/v1/programaciones con RBAC y migración V4.',
    ],
  },
  {
    version: '1.2.0',
    fecha: '2026-08-19',
    cambios: [
      'Nuevo sistema visual Vanguard con fuentes Poppins e iconos Material Community.',
      'Navegación inferior Home, slot vacío, Catálogos y Perfil.',
      'Perfil con información de versión y confirmación para cerrar sesión.',
      'Corrección de doble toque en el inicio de sesión (el teclado ya no bloquea el botón Ingresar).',
      'Pantallas respetan las barras del sistema (safe areas) y el botón atrás ya no cierra la aplicación.',
      'Perfil completo: avatar, historial de versiones y cierre de sesión con confirmación.',
      'Catálogos y navegación inferior con espacio reservado para un cuarto acceso.',
    ],
  },
  {
    version: '1.1.0',
    fecha: '2026-08-19',
    cambios: [
      'Login en 3 pasos: rol → usuario → DNI, con roles Super Admin / Admin / Usuario.',
      'URL del servidor configurable en runtime (ServerCheck / Settings).',
      'SecureStore con react-native-keychain para el token JWT.',
      'Axios con interceptores: 401 → cierre de sesión y timeout de 15 segundos.',
      'Backend en /api/v1 con autenticación v2 (JWT local).',
    ],
  },
  {
    version: '1.0.0',
    fecha: '2026-08-18',
    cambios: [
      'Primera vertical: autenticación por usuario + contraseña (JWT local).',
      'Cambio de contraseña obligatorio al primer ingreso (nueva contraseña = DNI, numérico máx 8 dígitos).',
      'Home por perfil: USUARIO (Nuevo Requerimiento, Historial de Requerimiento), ADMIN (Programación, Solicitud de Requerimientos), SUPER_ADMIN (2 divs).',
      'Backend Quarkus 3.x con CRUD de usuarios (soft delete por estado), PostgreSQL 16 en Docker.',
    ],
  },
];

export default versionHistory;
