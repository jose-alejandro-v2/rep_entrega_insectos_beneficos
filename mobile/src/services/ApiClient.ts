/**
 * ApiClient — cliente HTTP central (axios) + almacenamiento seguro (Keychain).
 *
 * Modelo aplicado de `docs_implementacion/LOGIN_MODELO_REUTILIZABLE.md` §7
 * (con criterio adaptativo según ADR-A003):
 *  - URL del backend configurable en runtime, persistida en SecureStore
 *    (react-native-keychain; NUNCA AsyncStorage) bajo el service `apiUrl`.
 *  - JWT persistido en SecureStore bajo el service `accessToken`.
 *  - Interceptor de request: inyecta `baseURL` (URL guardada) y
 *    `Authorization: Bearer <jwt>` en CADA request.
 *  - Interceptor de response: ante 401 borra SOLO el token (la URL se
 *    conserva) y notifica al AuthContext vía `setUnauthorizedHandler`.
 *  - Timeout global: 15 s (ADR-A003 D-AUTH2-4).
 */

import axios, {AxiosInstance, AxiosError} from 'axios';
import * as Keychain from 'react-native-keychain';
import API_BASE_URL from '../config';

export const TOKEN_KEY = 'accessToken';
export const API_URL_KEY = 'apiUrl';

/**
 * Normaliza la URL del backend: acepta IP simple, host o URL completa y
 * completa el resto con puerto 6101 y base path `/api/v1`.
 *
 * Reglas (en orden): trim + quita barras finales; sin esquema → antepone
 * `http://` (soporte https conservado para producción futura); sin puerto
 * explícito en host[:puerto] → añade `:6101`; sin `/api/v1` → lo añade al
 * final. Idempotente: URLs ya completas (`http://host:6101/api/v1`) no se
 * modifican (p. ej. las ya guardadas en el Keychain). Ejemplos:
 *   '10.13.18.93'                    → 'http://10.13.18.93:6101/api/v1'
 *   'localhost'                      → 'http://localhost:6101/api/v1'
 *   'http://miservidor:8080'         → 'http://miservidor:8080/api/v1'
 *   'http://miservidor:8080/api/v1'  → sin cambios
 */
export function normalizeApiUrl(url: string): string {
  let out = String(url || '').trim().replace(/\/+$/, '');
  if (!out) {
    return out;
  }
  if (!/^https?:\/\//i.test(out)) {
    out = `http://${out}`;
  }
  // Separa esquema / host[:puerto] / resto para aplicar las reglas c y d
  // solo sobre la parte correcta (sin romper URLs ya completas).
  const schemeMatch = out.match(/^https?:\/\//i);
  const scheme = schemeMatch ? schemeMatch[0] : '';
  const afterScheme = out.slice(scheme.length);
  const slashIndex = afterScheme.indexOf('/');
  const hostPort = slashIndex === -1 ? afterScheme : afterScheme.slice(0, slashIndex);
  const rest = slashIndex === -1 ? '' : afterScheme.slice(slashIndex);
  if (hostPort && hostPort.indexOf(':') === -1) {
    out = `${scheme}${hostPort}:6101${rest}`;
  }
  if (!/\/api\/v1(\/|$)/.test(out)) {
    out = `${out.replace(/\/+$/, '')}/api/v1`;
  }
  return out;
}

/** URL base embebida (fallback), normalizada. */
export const BUILT_IN_API_URL = normalizeApiUrl(API_BASE_URL);

// Cache en memoria para no leer el Keychain en cada request.
let _cachedApiUrl: string | null = null;
let _cachedToken: string | null = null;

// Callback registrado por AuthContext para forzar logout ante 401.
let _unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  _unauthorizedHandler = handler;
}

/* ------------------------------------------------------------------ */
/* SecureStore (Keychain) — helpers de URL y token                     */
/* ------------------------------------------------------------------ */

export async function loadApiUrl(): Promise<string> {
  if (_cachedApiUrl) {
    return _cachedApiUrl;
  }
  try {
    const creds = await Keychain.getGenericPassword({service: API_URL_KEY});
    if (creds && creds.password) {
      _cachedApiUrl = normalizeApiUrl(creds.password);
      return _cachedApiUrl;
    }
  } catch {
    // Sin URL guardada: se usa el fallback.
  }
  return BUILT_IN_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  const normalized = normalizeApiUrl(url);
  if (!normalized) {
    return;
  }
  await Keychain.setGenericPassword('apiUrl', normalized, {
    service: API_URL_KEY,
  });
  _cachedApiUrl = normalized;
}

/** Restablece la URL guardada (vuelve al fallback `BUILT_IN_API_URL`). */
export async function resetApiUrl(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: API_URL_KEY});
  } catch {
    // No había URL guardada; sin efecto.
  }
  _cachedApiUrl = null;
}

export async function getToken(): Promise<string | null> {
  if (_cachedToken) {
    return _cachedToken;
  }
  try {
    const creds = await Keychain.getGenericPassword({service: TOKEN_KEY});
    if (creds && creds.password) {
      _cachedToken = creds.password;
      return _cachedToken;
    }
  } catch {
    // Sin token almacenado.
  }
  return null;
}

export async function setToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('accessToken', token, {
    service: TOKEN_KEY,
  });
  _cachedToken = token;
}

export async function clearToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: TOKEN_KEY});
  } catch {
    // No había token; sin efecto.
  }
  _cachedToken = null;
}

/* ------------------------------------------------------------------ */
/* Tipos del contrato backend v2 (HITO-002, fijado por el Orchestrator)*/
/* ------------------------------------------------------------------ */

export interface RolDto {
  id: number;
  nombre: string;
  estado?: boolean | string;
}

export interface UsuarioRolDto {
  id: number;
  usuario: string;
  nombre: string;
  rolId: number;
  passwordResetRequired: boolean;
}

export interface LocalLoginResponse {
  token: string;
  passwordResetRequired: boolean;
}

export interface ChangePasswordResponse {
  token: string;
  passwordResetRequired: boolean;
  message?: string;
}

/** Claims del JWT emitidos por el backend v2 (ADR-A003 D-AUTH2-3). */
export interface JwtClaims {
  sub: string;
  groups?: string[];
  rolId?: number;
  nombre?: string;
  dni?: string;
  passwordResetRequired?: boolean;
  /** Expiration time (Unix timestamp en segundos). */
  exp?: number;
}

/** Usuario de sesión decodificado del JWT en el cliente. */
export interface AuthUser {
  sub: string | null;
  /** Rol literal con espacios: 'Super Admin' | 'Admin' | 'Usuario'. */
  rol: string;
  rolNombre: string;
  rolId: number | null;
  nombre: string;
  dni: string;
  passwordResetRequired: boolean;
}

/* ------------------------------------------------------------------ */
/* parseToken — decodifica los claims sin llamar al backend            */
/* ------------------------------------------------------------------ */

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodificador base64url → UTF-8 sin depender de `atob`/`Buffer`
 * (portable a Hermes y a Jest con types de React Native).
 */
/* eslint-disable no-bitwise -- manipulación de bytes base64 (requerida) */
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    const c1 = B64_CHARS.indexOf(padded[i]);
    const c2 = B64_CHARS.indexOf(padded[i + 1]);
    const c3 = B64_CHARS.indexOf(padded[i + 2]);
    const c4 = B64_CHARS.indexOf(padded[i + 3]);
    const b1 = (c1 << 2) | (c2 >> 4);
    const b2 = ((c2 & 15) << 4) | (c3 >> 2);
    const b3 = ((c3 & 3) << 6) | c4;
    bytes.push(b1);
    if (padded[i + 2] !== '=') {
      bytes.push(b2);
    }
    if (padded[i + 3] !== '=') {
      bytes.push(b3);
    }
  }
  // Bytes UTF-8 → string (claims ASCII + tildes del nombre).
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f));
      i++;
    } else if (b >= 0xe0 && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) |
          ((bytes[i + 1]! & 0x3f) << 6) |
          (bytes[i + 2]! & 0x3f),
      );
      i += 2;
    }
  }
  return out;
}

export function parseToken(token: string | null | undefined): AuthUser | null {
  if (!token) {
    return null;
  }
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtClaims;
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    const rol = groups.length > 0 ? String(groups[0]) : '';
    return {
      sub: payload.sub != null ? String(payload.sub) : null,
      rol,
      rolNombre: rol,
      rolId: payload.rolId ?? null,
      nombre: payload.nombre || 'Usuario',
      dni: payload.dni || '',
      // Interpretación segura: si el claim falta, se exige cambiar la
      // contraseña (LOGIN_MODELO_REUTILIZABLE.md §8.2).
      passwordResetRequired: payload.passwordResetRequired !== false,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Instancia axios + interceptores                                     */
/* ------------------------------------------------------------------ */

export const api: AxiosInstance = axios.create({timeout: 15000});

api.interceptors.request.use(async config => {
  const [apiUrl, token] = await Promise.all([loadApiUrl(), getToken()]);
  config.baseURL = apiUrl;
  if (token && config.headers) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Modo exclusivamente online: un 401 invalida siempre la sesión local.
      // No se consulta NetInfo ni se conserva un token para trabajo offline.
      clearToken().catch(() => {});
      _unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Extrae el mensaje legible de un error axios/{error} del backend.
 * Contrato backend (ADR-A003 / ManejadorErrores -> ApiError): el cuerpo de
 * error es {codigo, mensaje}; se lee en ese orden con fallbacks de compat
 * (message/error) para no degradar la UX a "Request failed with status code X".
 */
export function extractErrorMessage(error: unknown): string {
  const err = error as {
    response?: {
      data?: {mensaje?: string; message?: string; error?: string};
      status?: number;
    };
    message?: string;
    code?: string;
  };
  const mensajeBackend =
    err?.response?.data?.mensaje ??
    err?.response?.data?.message ??
    err?.response?.data?.error ??
    '';
  if (mensajeBackend) {
    return mensajeBackend;
  }
  if (err?.code === 'ECONNABORTED') {
    return 'Tiempo de espera agotado. Verifique su conexión.';
  }
  if (err?.message) {
    return err.message;
  }
  return 'Error de conexión.';
}

/* ------------------------------------------------------------------ */
/* Helpers del contrato auth v2 (rutas relativas a la base `/api/v1`)  */
/* ------------------------------------------------------------------ */

const unwrap = <T>(data: T | {data?: T}): T =>
  Array.isArray(data) ? data : ((data as {data?: T}).data ?? (data as T));

export async function fetchRoles(): Promise<RolDto[]> {
  const res = await api.get('/auth/roles');
  const data = res.data as RolDto[] | {data?: RolDto[]};
  return unwrap(data);
}

export async function fetchUsuariosByRol(rolId: number): Promise<UsuarioRolDto[]> {
  const res = await api.get(`/auth/usuarios-by-rol/${rolId}`);
  const data = res.data as UsuarioRolDto[] | {data?: UsuarioRolDto[]};
  return unwrap(data);
}

export async function localLogin(
  usuarioId: number,
  password: string,
): Promise<LocalLoginResponse> {
  const res = await api.post('/auth/local-login', {usuarioId, password});
  return res.data as LocalLoginResponse;
}

export async function changePassword(
  newPassword: string,
  contrasenaActual?: string,
): Promise<ChangePasswordResponse> {
  const body: {newPassword: string; contrasenaActual?: string} = {
    newPassword,
  };
  if (contrasenaActual !== undefined && contrasenaActual.length > 0) {
    body.contrasenaActual = contrasenaActual;
  }
  const res = await api.post('/auth/change-password', body);
  return res.data as ChangePasswordResponse;
}

/* ------------------------------------------------------------------ */
/* CRUD de usuarios (/api/v1/usuarios — UsuarioResource)               */
/* ------------------------------------------------------------------ */

/** Respuesta del CRUD de usuarios. Nunca incluye contraseña. */
export interface UsuarioDto {
  id: number;
  usuario: string;
  nombre: string;
  rolId: number;
  /** Literal con espacios: 'Super Admin' | 'Admin' | 'Usuario'. */
  rol: string;
  estado: 'ACTIVO' | 'INACTIVO';
  debeCambiarPassword: boolean;
  dni: string | null;
  creadoPor: number | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

/** Cuerpo de POST /api/v1/usuarios (password siempre el default 00000000). */
export interface CrearUsuarioRequest {
  usuario: string;
  nombre: string;
  rolId: number;
  dni?: string;
}

/** Cuerpo de PUT /api/v1/usuarios/{id} (no permite cambiar dni ni password). */
export interface ActualizarUsuarioRequest {
  usuario: string;
  nombre: string;
  rolId: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

export async function listarUsuarios(
  estado?: 'ACTIVO' | 'INACTIVO',
  rolId?: number,
): Promise<UsuarioDto[]> {
  const params: Record<string, string | number> = {};
  if (estado) {
    params.estado = estado;
  }
  if (rolId != null) {
    params.rolId = rolId;
  }
  const res = await api.get('/usuarios', {params});
  const data = res.data as UsuarioDto[] | {data?: UsuarioDto[]};
  return unwrap(data);
}

export async function crearUsuario(
  req: CrearUsuarioRequest,
): Promise<UsuarioDto> {
  const res = await api.post('/usuarios', req);
  return res.data as UsuarioDto;
}

export async function actualizarUsuario(
  id: number,
  req: ActualizarUsuarioRequest,
): Promise<UsuarioDto> {
  const res = await api.put(`/usuarios/${id}`, req);
  return res.data as UsuarioDto;
}

export async function desactivarUsuario(
  id: number,
): Promise<{mensaje: string}> {
  const res = await api.delete(`/usuarios/${id}`);
  return res.data as {mensaje: string};
}

/* ------------------------------------------------------------------ */
/* Programación (/api/v1/programaciones + /api/v1/especies)            */
/* ------------------------------------------------------------------ */

/** Estados de una programación semanal (RF-186 / RN-038). */
export type EstadoProgramacion = 'EN_PROCESO' | 'PUBLICADO';

/** Especie de insecto benéfico (catálogo del módulo Programación). */
export interface EspecieDto {
  id: number;
  nombre: string;
  estado: boolean | string;
}

/** Detalle por semana de una programación (RF-187 / RN-037). */
export interface DetalleProgramacionDto {
  id: number;
  /** Número de semana dentro del mes (1..n). */
  semana: number;
  /** Fecha de la semana (ISO). */
  fecha: string;
  /** Stock inicial de la semana en millares (remanente de la semana anterior). */
  stockInicial: number;
  /** Cantidad en papel con postura (millares). */
  papelConPostura: number;
  /** Cantidad en sobre con cascarilla (millares). */
  sobreConCascarilla: number;
  /** Suma de papel + sobre (RF-134). */
  total: number;
  /** Stock final de la semana en millares. */
  stockFinal: number;
  /** Estado individual de la semana (RF-186). */
  estado: EstadoProgramacion;
}

/** Programación de stock del mes (resumen de listado + detalle al editar). */
export interface ProgramacionDto {
  id: number;
  anio: number;
  mes: number;
  especieId: number;
  especie: string;
  fechaRegistro: string;
  fechaPublicacion: string | null;
  estado: EstadoProgramacion;
  /** Proyección base del mes en millares (RF-187). */
  stockInicialBase: number;
  /** Cantidad total programada en el mes (todas las semanas). */
  totalMes: number;
  /** Detalle semanal (solo cuando el endpoint devuelve el detalle). */
  detalles: DetalleProgramacionDto[];
}

/** Cuerpo de PUT /api/v1/programaciones/{id} (persistir valores editados). */
export interface ActualizarProgramacionRequest {
  stockInicialBase: number;
  detalles: Array<{
    id?: number;
    semana: number;
    fecha: string;
    papelConPostura: number;
    sobreConCascarilla: number;
  }>;
}

/** Cuerpo de POST /api/v1/programaciones (crear nueva programacion). */
export interface CrearProgramacionRequest {
  anio: number;
  mes: number;
  especieId: number;
}

/** GET /api/v1/especies — catálogo de especies de insectos benéficos. */
export async function listarEspecies(): Promise<EspecieDto[]> {
  const res = await api.get('/especies');
  return unwrap(res.data as EspecieDto[] | {data?: EspecieDto[]});
}

/**
 * GET /api/v1/programaciones?anio=YYYY&mes=M — programaciones del mes
 * (todas las especies; incluye detalles semanales para la edición).
 */
export async function listarProgramaciones(
  anio: number,
  mes: number,
): Promise<ProgramacionDto[]> {
  const res = await api.get('/programaciones', {params: {anio, mes}});
  return unwrap(res.data as ProgramacionDto[] | {data?: ProgramacionDto[]});
}

/** GET /api/v1/programaciones/{id} — detalle completo de una programación. */
export async function obtenerProgramacion(id: number): Promise<ProgramacionDto> {
  const res = await api.get(`/programaciones/${id}`);
  return res.data as ProgramacionDto;
}

/** PUT /api/v1/programaciones/{id} — persiste los valores editados. */
export async function actualizarProgramacion(
  id: number,
  req: ActualizarProgramacionRequest,
): Promise<ProgramacionDto> {
  const res = await api.put(`/programaciones/${id}`, req);
  return res.data as ProgramacionDto;
}

/** POST /api/v1/programaciones/{id}/publicar — publica y notifica (RF-145/146). */
export async function publicarProgramacion(
  id: number,
): Promise<{mensaje: string}> {
  const res = await api.post(`/programaciones/${id}/publicar`);
  return res.data as {mensaje: string};
}

/** POST /api/v1/programaciones — crea una nueva programacion (solo Admin/Super Admin). */
export async function crearProgramacion(
  req: CrearProgramacionRequest,
): Promise<ProgramacionDto> {
  const res = await api.post('/programaciones', req);
  return res.data as ProgramacionDto;
}

/* ------------------------------------------------------------------ */
/* Requerimientos (/api/v1/requerimientos + catálogos)                 */
/* ------------------------------------------------------------------ */

/**
 * Estados de un requerimiento (transcripcion.md Screen 7/8, RF-152..188).
 * Orden del ciclo: Registrado → Pendiente → Aprobado → Entregado → Recibido → Liberado.
 */
export type EstadoRequerimiento =
  | 'REGISTRADO'
  | 'PENDIENTE'
  | 'APROBADO'
  | 'ENTREGADO'
  | 'RECIBIDO'
  | 'LIBERADO';

/** Fundo agrícola (catálogo). */
export interface FundoDto {
  id: number;
  nombre: string;
  createdAt: string;
  updatedAt: string;
}

/** Variedad de uva (catálogo) — con color (HITO-006). */
export interface VariedadDto {
  id: number;
  nombre: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** Lote dentro de un fundo (catálogo) — enriquecido con variedad y color. */
export interface LoteDto {
  id: number;
  fundoId: number;
  fundo: string;
  variedadId: number;
  variedad: string;
  variedadColor: string;
  nombre: string;
  area: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Etapa fenológica (catálogo). */
export interface EtapaFenologicaDto {
  id: number;
  nombre: string;
  estado: boolean | string;
}

/** Plaga objetivo (catálogo). */
export interface PlagaDto {
  id: number;
  nombre: string;
  estado: boolean | string;
}

/** Requerimiento de stock (Screen 7/8/10/12/13). */
export interface RequerimientoDto {
  id: number;
  fecha: string;
  fundoId: number;
  fundo: string;
  loteId: number;
  lote: string;
  especieId: number;
  especie: string;
  etapaFenologicaId: number | null;
  etapaFenologica: string | null;
  cantidad: number;
  plagaId: number | null;
  plaga: string | null;
  estado: EstadoRequerimiento;
  /** Stock disponible en el momento (solo lectura, Screen 10). */
  stockDisponible: number;
  fechaLiberacion: string | null;
  horaLiberacion: string | null;
  observaciones: string | null;
  /** Presentaciones entregadas (solo cuando estado = ENTREGADO). */
  papelConPostura: number | null;
  sobreConCascarilla: number | null;
  creadoPor: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo de POST /api/v1/requerimientos (crear, Screen 10). */
export interface CrearRequerimientoRequest {
  fecha: string;
  fundoId: number;
  loteId: number;
  especieId: number;
  etapaFenologicaId: number | null;
  cantidad: number;
  plagaId: number | null;
  observaciones?: string | null;
}

/** Cuerpo de PUT /api/v1/requerimientos/{id} (editar, Screen 8/13). */
export interface ActualizarRequerimientoRequest {
  fecha: string;
  fundoId: number;
  loteId: number;
  especieId: number;
  etapaFenologicaId: number | null;
  cantidad: number;
  plagaId: number | null;
  estado: EstadoRequerimiento;
  papelConPostura?: number | null;
  sobreConCascarilla?: number | null;
  fechaLiberacion?: string | null;
  horaLiberacion?: string | null;
  observaciones?: string | null;
}

/** GET /api/v1/fundos — catálogo de fundos. */
export async function listarFundos(): Promise<FundoDto[]> {
  const res = await api.get('/fundos');
  return unwrap(res.data as FundoDto[] | {data?: FundoDto[]});
}

/** GET /api/v1/variedades — catálogo de variedades con color. */
export async function listarVariedades(): Promise<VariedadDto[]> {
  const res = await api.get('/variedades');
  return unwrap(res.data as VariedadDto[] | {data?: VariedadDto[]});
}

/** GET /api/v1/lotes?fundoId=X — catálogo de lotes de un fundo. */
export async function listarLotes(fundoId: number): Promise<LoteDto[]> {
  const res = await api.get('/lotes', {params: {fundoId}});
  return unwrap(res.data as LoteDto[] | {data?: LoteDto[]});
}

/** GET /api/v1/etapas-fenologicas — catálogo de etapas. */
export async function listarEtapasFenologicas(): Promise<EtapaFenologicaDto[]> {
  const res = await api.get('/etapas-fenologicas');
  return unwrap(res.data as EtapaFenologicaDto[] | {data?: EtapaFenologicaDto[]});
}

/** GET /api/v1/plagas — catálogo de plagas. */
export async function listarPlagas(): Promise<PlagaDto[]> {
  const res = await api.get('/plagas');
  return unwrap(res.data as PlagaDto[] | {data?: PlagaDto[]});
}

/** GET /api/v1/requerimientos?fechaDesde&fechaHasta&estado — listado (Screen 7/12). */
export async function listarRequerimientos(params: {
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: EstadoRequerimiento;
  creadoPor?: number;
}): Promise<RequerimientoDto[]> {
  const query: Record<string, string | number> = {};
  if (params.fechaDesde) query.fechaDesde = params.fechaDesde;
  if (params.fechaHasta) query.fechaHasta = params.fechaHasta;
  if (params.estado) query.estado = params.estado;
  if (params.creadoPor != null) query.creadoPor = params.creadoPor;
  const res = await api.get('/requerimientos', {params: query});
  return unwrap(res.data as RequerimientoDto[] | {data?: RequerimientoDto[]});
}

/** GET /api/v1/requerimientos/{id} — detalle de un requerimiento. */
export async function obtenerRequerimiento(id: number): Promise<RequerimientoDto> {
  const res = await api.get(`/requerimientos/${id}`);
  return res.data as RequerimientoDto;
}

/** POST /api/v1/requerimientos — crea un requerimiento (Screen 10). */
export async function crearRequerimiento(
  req: CrearRequerimientoRequest,
): Promise<RequerimientoDto> {
  const res = await api.post('/requerimientos', req);
  return res.data as RequerimientoDto;
}

/** PUT /api/v1/requerimientos/{id} — actualiza estado/datos (Screen 8/13). */
export async function actualizarRequerimiento(
  id: number,
  req: ActualizarRequerimientoRequest,
): Promise<RequerimientoDto> {
  const res = await api.put(`/requerimientos/${id}`, req);
  return res.data as RequerimientoDto;
}

/** GET /api/v1/programaciones/{especieId}/stock — stock disponible en tiempo real (Screen 10). */
export async function obtenerStockEspecie(
  especieId: number,
): Promise<{stock: number}> {
  const res = await api.get(`/programaciones/${especieId}/stock`);
  return res.data as {stock: number};
}

/* ------------------------------------------------------------------ */
/* Fotos de requerimiento (HITO-010)                                    */
/* ------------------------------------------------------------------ */

export interface FotoRequerimientoDto {
  id: number;
  requerimientoId: number;
  ruta: string;
  nombreArchivo: string;
  tamanoBytes: number;
  contentType: string;
  metadatos: string | null;
  creadoEn: string;
}

/**
 * Sube una foto para un requerimiento (multipart: archivo + metadatos).
 * El backend acepta JPG/PNG ≤ 5 MB, máximo 2 fotos por requerimiento.
 */
export async function subirFotoRequerimiento(
  requerimientoId: number,
  archivo: {uri: string; type: string; name: string},
  metadatos?: string,
): Promise<FotoRequerimientoDto> {
  const formData = new FormData();
  formData.append('archivo', {
    uri: archivo.uri,
    type: archivo.type,
    name: archivo.name,
  } as any);
  if (metadatos) {
    formData.append('metadatos', metadatos);
  }
  const response = await api.post<FotoRequerimientoDto>(
    `/requerimientos/${requerimientoId}/fotos`,
    formData,
    {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 30000,
    },
  );
  return response.data;
}

/**
 * Lista las fotos de un requerimiento.
 */
export async function listarFotosRequerimiento(
  requerimientoId: number,
): Promise<FotoRequerimientoDto[]> {
  const response = await api.get<FotoRequerimientoDto[]>(
    `/requerimientos/${requerimientoId}/fotos`,
  );
  return unwrap(
    response.data as FotoRequerimientoDto[] | {data?: FotoRequerimientoDto[]},
  );
}

/**
 * Elimina una foto de un requerimiento.
 */
export async function eliminarFotoRequerimiento(
  requerimientoId: number,
  fotoId: number,
): Promise<void> {
  await api.delete(`/requerimientos/${requerimientoId}/fotos/${fotoId}`);
}

/**
 * Construye la URL HTTP completa para descargar la imagen de una foto.
 * Reemplaza `foto.ruta` (path de disco del servidor) con una URL que
 * <Image> de React Native puede resolver vía GET /imagen.
 */
export async function getFotoUrl(
  requerimientoId: number,
  fotoId: number,
): Promise<string> {
  const baseUrl = await loadApiUrl();
  return `${baseUrl}/requerimientos/${requerimientoId}/fotos/${fotoId}/imagen`;
}

/* ------------------------------------------------------------------ */
/* Cumplimiento de producción (HITO-014)                                */
/* ------------------------------------------------------------------ */

export interface CumplimientoProgramacionDto {
  id: number;
  programacionDetalleId: number;
  programacionId: number;
  semana: number;
  fecha: string;
  papelReal: number;
  sobreReal: number;
  totalReal: number;
  creadoPor: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuardarCumplimientoRequest {
  programacionDetalleId: number;
  semana: number;
  fecha: string;
  papelReal: number;
  sobreReal: number;
}

/**
 * GET /api/v1/programaciones/{id}/cumplimiento — lista cumplimientos de una programación.
 */
export async function listarCumplimiento(
  programacionId: number,
): Promise<CumplimientoProgramacionDto[]> {
  const res = await api.get<CumplimientoProgramacionDto[]>(
    `/programaciones/${programacionId}/cumplimiento`,
  );
  return unwrap(
    res.data as CumplimientoProgramacionDto[] | {data?: CumplimientoProgramacionDto[]},
  );
}

/**
 * PUT /api/v1/programaciones/{id}/cumplimiento — crear/actualizar cumplimiento (upsert).
 */
export async function guardarCumplimiento(
  programacionId: number,
  req: GuardarCumplimientoRequest,
): Promise<CumplimientoProgramacionDto> {
  const res = await api.put<CumplimientoProgramacionDto>(
    `/programaciones/${programacionId}/cumplimiento`,
    req,
  );
  return res.data as CumplimientoProgramacionDto;
}

/* ------------------------------------------------------------------ */
/* Despachos / Recepciones / Liberaciones (HITO-015)                   */
/* ------------------------------------------------------------------ */

/** Despacho de insectos benéficos a un requerimiento (HITO-015 / MOD-06). */
export interface DespachoDto {
  id: number;
  requerimientoId: number;
  cantidadDespachada: number;
  papelConPostura: number | null;
  sobreConCascarilla: number | null;
  observaciones: string | null;
  creadoPor: number;
  creadoPorNombre: string;
  createdAt: string;
}

/** Request para registrar un despacho (RF-062..065). */
export interface CrearDespachoRequest {
  cantidadDespachada: number;
  papelConPostura?: number | null;
  sobreConCascarilla?: number | null;
  observaciones?: string | null;
}

/** Recepción de un requerimiento en campo (HITO-015 / MOD-07). */
export interface RecepcionDto {
  id: number;
  requerimientoId: number;
  conforme: boolean;
  observaciones: string | null;
  fechaRecepcion: string;
  creadoPor: number;
  creadoPorNombre: string;
  createdAt: string;
}

/** Request para confirmar una recepción (RF-072..075). */
export interface ConfirmarRecepcionRequest {
  conforme: boolean;
  observaciones?: string | null;
}

/** Liberación de insectos en el fundo/lote destino (HITO-015 / MOD-08). */
export interface LiberacionDto {
  id: number;
  requerimientoId: number;
  fundoId: number;
  fundoNombre: string;
  loteId: number;
  loteNombre: string;
  cantidadLiberada: number;
  observaciones: string | null;
  fechaLiberacion: string;
  horaLiberacion: string;
  creadoPor: number;
  creadoPorNombre: string;
  createdAt: string;
}

/** Request para registrar una liberación en campo (RF-080..086). */
export interface CrearLiberacionRequest {
  fundoId: number;
  loteId: number;
  cantidadLiberada: number;
  observaciones?: string | null;
  horaLiberacion: string;
}

/** GET /api/v1/requerimientos/{id}/despachos — lista despachos de un requerimiento. */
export async function listarDespachos(
  requerimientoId: number,
): Promise<DespachoDto[]> {
  const res = await api.get<DespachoDto[]>(
    `/requerimientos/${requerimientoId}/despachos`,
  );
  return unwrap(
    res.data as DespachoDto[] | {data?: DespachoDto[]},
  );
}

/** POST /api/v1/requerimientos/{id}/despachos — registra un despacho (Admin). */
export async function crearDespacho(
  requerimientoId: number,
  req: CrearDespachoRequest,
): Promise<DespachoDto> {
  const res = await api.post<DespachoDto>(
    `/requerimientos/${requerimientoId}/despachos`,
    req,
  );
  return res.data as DespachoDto;
}

/** GET /api/v1/requerimientos/{id}/recepciones — lista recepciones de un requerimiento. */
export async function listarRecepciones(
  requerimientoId: number,
): Promise<RecepcionDto[]> {
  const res = await api.get<RecepcionDto[]>(
    `/requerimientos/${requerimientoId}/recepciones`,
  );
  return unwrap(
    res.data as RecepcionDto[] | {data?: RecepcionDto[]},
  );
}

/** POST /api/v1/requerimientos/{id}/recepciones — confirma recepción (Admin/Usuario). */
export async function confirmarRecepcion(
  requerimientoId: number,
  req: ConfirmarRecepcionRequest,
): Promise<RecepcionDto> {
  const res = await api.post<RecepcionDto>(
    `/requerimientos/${requerimientoId}/recepciones`,
    req,
  );
  return res.data as RecepcionDto;
}

/** GET /api/v1/requerimientos/{id}/liberaciones — lista liberaciones de un requerimiento. */
export async function listarLiberaciones(
  requerimientoId: number,
): Promise<LiberacionDto[]> {
  const res = await api.get<LiberacionDto[]>(
    `/requerimientos/${requerimientoId}/liberaciones`,
  );
  return unwrap(
    res.data as LiberacionDto[] | {data?: LiberacionDto[]},
  );
}

/** POST /api/v1/requerimientos/{id}/liberaciones — registra liberación en campo (Admin/Usuario). */
export async function crearLiberacion(
  requerimientoId: number,
  req: CrearLiberacionRequest,
): Promise<LiberacionDto> {
  const res = await api.post<LiberacionDto>(
    `/requerimientos/${requerimientoId}/liberaciones`,
    req,
  );
  return res.data as LiberacionDto;
}
