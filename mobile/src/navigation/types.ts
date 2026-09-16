/**
 * Parametros del Stack Navigator principal (tipado TS).
 * - ServerCheck: primer flujo sin sesión (valida la URL del servidor).
 * - Login: selector perfil → usuario → contraseña (3 pasos).
 * - ConfigurarServidor: URL del servidor en runtime (desde Login y Super Admin).
 * - CambiarPassword: autenticado con passwordResetRequired = true (obligatorio).
 * - Home + placeholders: autenticado normal (home según perfil).
 */
export type RootStackParamList = {
  ServerCheck: undefined;
  Login: undefined;
  ConfigurarServidor: undefined;
  CambiarPassword: undefined;
  Home: undefined;
  Catalogos: undefined;
  Perfil: undefined;
  NuevoRequerimiento: undefined;
  HistorialRequerimiento: undefined;
  /**
   * Rutas del módulo Requerimientos (HITO-005):
   *  - RequerimientosList: listado de solicitudes (Screen 7, admin I+D).
   *  - RequerimientoForm: crear (sin id) o editar (con id) una solicitud
   *    (Screen 8, admin I+D).
   *  - EditarRequerimiento: edición en campo con los metadatos del sistema
   *    (Screen 13, user sanidad).
   */
  RequerimientosList: undefined;
  RequerimientoForm: {id?: number; readOnly?: boolean};
  EditarRequerimiento: {id: number};
  Programacion: undefined;
  /**
   * ProgramacionEdicion: soporta modo 'editar' (con id) y modo 'crear' (sin id).
   * - modo='editar': requiere id, anio, mes (comportamiento actual).
   * - modo='crear': requiere anio, mes, modo='crear' (crea nueva programacion).
   */
  ProgramacionEdicion:
    | {id: number; anio: number; mes: number; modo?: 'editar'}
    | {anio: number; mes: number; modo: 'crear'};
  SolicitudRequerimientos: undefined;
  /** HITO-015 — Despachos, Recepciones, Liberaciones y Detalle */
  DespachoList: {requerimientoId: number};
  DespachoForm: {requerimientoId: number};
  RecepcionList: {requerimientoId: number};
  RecepcionForm: {requerimientoId: number};
  LiberacionList: {requerimientoId: number};
  LiberacionForm: {requerimientoId: number};
  DetalleRequerimiento: {id: number};
  Notificaciones: undefined;
};

/**
 * Pantallas navegables desde el menú del Home (sin parámetros). El resto de
 * rutas (p. ej. ProgramacionEdicion) requieren params y se navega con ellos.
 */
export type MenuScreen =
  | 'NuevoRequerimiento'
  | 'HistorialRequerimiento'
  | 'Programacion'
  | 'SolicitudRequerimientos'
  | 'Notificaciones';
