/**
 * requerimientos.ts — Helpers del módulo Requerimientos (HITO-005).
 *
 * Convenciones del dominio (01_especificacion.md MOD-18 / RN-021..036,
 * transcripcion.md Screen 6-13):
 *  - Estados del ciclo (RN-021): Registrado → Pendiente → Aprobado →
 *    Entregado → Recibido → Liberado, cada uno con su color exacto (RN-022).
 *  - La proyección mensual agrupa por semana la suma de Papel + Sobre de
 *    todas las programaciones del mes (RN-019 Total = suma automática).
 *  - El consumo del mes es la suma de `cantidad` de los requerimientos cuya
 *    fecha cae en el periodo; se compara con la disponibilidad (RN-029/030).
 *  - Validación de stock (RN-031/032): la cantidad no supera el disponible y
 *    stock 0 bloquea el envío ("Stock agotado").
 */

import type {
  EstadoRequerimiento,
  ProgramacionDto,
  RequerimientoDto,
} from '../services/ApiClient';

/** Información visual de un estado (label + color exacto). */
export interface EstadoInfo {
  label: string;
  color: string;
  /** Color de fondo suave para chips/cards (hex sin alpha). */
  bg?: string;
}

/** Estados del ciclo con label + color exacto (RN-022 / transcripcion.md Screen 7). */
export const ESTADOS_REQUERIMIENTO: Record<EstadoRequerimiento, EstadoInfo> = {
  REGISTRADO: {label: 'Registrado', color: '#9E9E9E'},
  PENDIENTE: {label: 'Pendiente', color: '#DB9647', bg: '#FAEBD8'},
  APROBADO: {label: 'Aprobado', color: '#4CAF50'},
  ENTREGADO: {label: 'Entregado', color: '#2196F3'},
  RECIBIDO: {label: 'Recibido', color: '#009688'},
  LIBERADO: {label: 'Liberado', color: '#9C27B0'},
};

/** Orden del ciclo (RN-021). */
export const ESTADOS_CICLO: EstadoRequerimiento[] = [
  'REGISTRADO',
  'PENDIENTE',
  'APROBADO',
  'ENTREGADO',
  'RECIBIDO',
  'LIBERADO',
];

/** Estados que puede establecer el admin en Screen 8 (RF-158): Aprobado/Entregado. */
export const ESTADOS_ADMIN: EstadoRequerimiento[] = ['APROBADO', 'ENTREGADO'];

/** Devuelve label + color de un estado (fallback gris para estados desconocidos). */
export function estadoInfo(estado: EstadoRequerimiento): EstadoInfo {
  return (
    ESTADOS_REQUERIMIENTO[estado] ?? {label: estado, color: '#9E9E9E'}
  );
}

/** `true` si el estado es ENTREGADO (habilita papel/sobre en Screen 8). */
export function esEstadoEntregado(estado: EstadoRequerimiento): boolean {
  return estado === 'ENTREGADO';
}

/** Solicitudes "pendientes" para el indicador de Screen 6 (Registrado o Pendiente). */
export function esEstadoPendiente(estado: EstadoRequerimiento): boolean {
  return estado === 'REGISTRADO' || estado === 'PENDIENTE';
}

/** Cuenta solicitudes pendientes (indicador numérico de Screen 6, RF-151). */
export function contarPendientes(reqs: RequerimientoDto[]): number {
  return reqs.filter(r => esEstadoPendiente(r.estado)).length;
}

/* ------------------------------------------------------------------ */
/* Fechas (valores ISO del contrato y presentación local)              */
/* ------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → 'aaaa-mm-dd' (ISO, huso local). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Hora actual en 'HH:mm' (metadatos de la foto de liberación, RN-036). */
export function horaActual(fecha: Date = new Date()): string {
  return `${pad2(fecha.getHours())}:${pad2(fecha.getMinutes())}`;
}

/** Fecha de hoy en 'aaaa-mm-dd'. */
export function hoyISO(): string {
  return toISODate(new Date());
}

/** 'dd/mm/aaaa' → 'aaaa-mm-dd' (ISO). `null` si el texto no es una fecha válida. */
export function isoDesdeInputFecha(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto).trim());
  if (!m) {
    return null;
  }
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return null;
  }
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

/** 'aaaa-mm-dd...' → 'dd/mm/aaaa' (para mostrar en inputs/etiquetas). */
export function formatoFechaInput(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    return iso;
  }
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** `true` si el rango [desdeISO, hastaISO] es válido (desde <= hasta). */
export function esRangoValido(desdeISO: string | null, hastaISO: string | null): boolean {
  if (!desdeISO || !hastaISO) {
    return false;
  }
  return desdeISO <= hastaISO;
}

/* ------------------------------------------------------------------ */
/* Proyección del mes + consumo (Screen 6 / 9)                         */
/* ------------------------------------------------------------------ */

export interface FilaProyeccion {
  semana: number;
  /** Fecha ISO del primer día de la semana (Lunes o Jueves). */
  fecha: string;
  papel: number;
  sobre: number;
  total: number;
}

/**
 * Agrega las programaciones del mes en filas por semana (suma de todas las
 * especies), calculando Total = papel + sobre (RN-019).
 */
export function filasProyeccion(programaciones: ProgramacionDto[]): FilaProyeccion[] {
  const mapa = new Map<number, {papel: number; sobre: number; fecha: string}>();
  for (const p of programaciones) {
    for (const d of p.detalles ?? []) {
      const cur = mapa.get(d.semana) ?? {papel: 0, sobre: 0, fecha: d.fecha};
      cur.papel += d.papelConPostura;
      cur.sobre += d.sobreConCascarilla;
      // Mantener la primera fecha encontrada (Lunes o Jueves de esa semana)
      mapa.set(d.semana, cur);
    }
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([semana, v]) => ({
      semana,
      fecha: v.fecha,
      papel: v.papel,
      sobre: v.sobre,
      total: v.papel + v.sobre,
    }));
}

/** Total de la proyección (disponibilidad mensual) en millares. */
export function totalProyeccion(filas: FilaProyeccion[]): number {
  return filas.reduce((acc, f) => acc + f.total, 0);
}

/** Suma de `cantidad` de los requerimientos del mes indicado (consumo). */
export function consumoDelMes(
  reqs: RequerimientoDto[],
  anio: number,
  mes: number,
): number {
  const prefijo = `${anio}-${pad2(mes)}-`;
  let total = 0;
  for (const r of reqs) {
    if (r.fecha.startsWith(prefijo)) {
      total += r.cantidad;
    }
  }
  return total;
}

/** Porcentaje de consumo vs disponibilidad (0..100, limitado). */
export function porcentajeConsumo(consumo: number, disponibilidad: number): number {
  if (disponibilidad <= 0) {
    return consumo > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((consumo / disponibilidad) * 100));
}

/* ------------------------------------------------------------------ */
/* Validación de stock y campos obligatorios                           */
/* ------------------------------------------------------------------ */

/** Cantidad numérica segura desde un texto (vacío/inválido → 0). */
export function cantidadDesdeTexto(texto: string): number {
  const n = parseInt(String(texto).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Validación de cantidad vs stock (RN-031/032):
 *  - stock 0         → 'Stock agotado'
 *  - cantidad <= 0   → 'Ingresa una cantidad válida'
 *  - cantidad > stock→ 'La cantidad supera el stock disponible'
 *  - ok              → `null`
 */
export function validarCantidadVsStock(cantidad: number, stock: number): string | null {
  if (stock <= 0) {
    return 'Stock agotado';
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return 'Ingresa una cantidad válida';
  }
  if (cantidad > stock) {
    return 'La cantidad supera el stock disponible';
  }
  return null;
}

/** Campos base del formulario de requerimiento (Screen 10/13). */
export interface FormularioRequerimientoBasico {
  fecha: string;
  fundoId: number | null;
  loteId: number | null;
  especieId: number | null;
  etapaFenologicaId: number | null;
  cantidad: number;
  plagaId: number | null;
  observaciones: string;
}

/** Lista de nombres de campos obligatorios faltantes (vacíos = todos ok). */
export function camposObligatoriosFaltantes(
  f: FormularioRequerimientoBasico,
): string[] {
  const faltan: string[] = [];
  if (!f.fecha.trim()) {
    faltan.push('Fecha');
  }
  if (f.fundoId == null) {
    faltan.push('Fundo');
  }
  if (f.loteId == null) {
    faltan.push('Lote');
  }
  if (f.especieId == null) {
    faltan.push('Especie');
  }
  if (f.etapaFenologicaId == null) {
    faltan.push('Etapa fenológica');
  }
  if (f.cantidad <= 0) {
    faltan.push('Cantidad');
  }
  if (f.plagaId == null) {
    faltan.push('Plaga objetivo');
  }
  return faltan;
}

/* ------------------------------------------------------------------ */
/* Alerta de 30 horas de liberación (Screen 13, RN-035)                */
/* ------------------------------------------------------------------ */

/** Horas transcurridas desde el último cambio de estado del requerimiento. */
export function horasDesdeCambioEstado(
  r: RequerimientoDto,
  ahora: Date = new Date(),
): number {
  const base = r.updatedAt || r.createdAt;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) {
    return 0;
  }
  return Math.floor((ahora.getTime() - t) / 3600000);
}

/**
 * `true` si Screen 13 debe mostrar la alerta permanente: el requerimiento
 * está en estado RECIBIDO y pasaron >30 h desde el último cambio de estado
 * sin foto de liberación (RN-035). Con la foto como stub, se asume "sin foto".
 */
export function requiereAlertaLiberacion(
  r: RequerimientoDto,
  ahora: Date = new Date(),
): boolean {
  return r.estado === 'RECIBIDO' && horasDesdeCambioEstado(r, ahora) > 30;
}
