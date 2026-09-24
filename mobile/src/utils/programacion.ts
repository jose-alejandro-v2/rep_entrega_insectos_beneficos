/**
 * programacion.ts — Helpers del módulo Programación (HITO Programación).
 *
 * Convenciones del dominio (01_especificacion.md MOD-17):
 *  - Los meses se enumeran 1..12 (Enero..Diciembre).
 *  - La edición de programación SOLO está permitida los días lunes y jueves
 *    (RF-147/RF-148), de 00:00 a 23:59. Fuera de eso NO se habilita "Enviar stock".
 */

/** Nombres largos de los meses (es-PE), índice 0 = Enero. */
export const MESES_LARGOS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Mes (1..12) → nombre largo, p. ej. 1 → 'Enero'. */
export function nombreMes(mes: number): string {
  return MESES_LARGOS[mes - 1] ?? '';
}

/** Año actual (huso local del dispositivo). */
export function anioActual(): number {
  return new Date().getFullYear();
}

/** Mes actual (1..12, huso local). */
export function mesActual(): number {
  return new Date().getMonth() + 1;
}

/** Etiqueta corta del periodo: 'Agosto 2026'. */
export function etiquetaPeriodo(mes: number, anio: number): string {
  return `${nombreMes(mes)} ${anio}`;
}

/**
 * Día de la semana de una fecha (0=Domingo .. 6=Sábado) usando el huso local.
 * Inyectable en tests mediante `fecha`.
 */
export function diaSemana(fecha: Date = new Date()): number {
  return fecha.getDay();
}

/** `true` si la fecha es lunes (1) o jueves (4) — RF-147. */
export function esDiaEditable(fecha: Date = new Date()): boolean {
  const dia = diaSemana(fecha);
  return dia === 1 || dia === 4;
}

/** Formatea ISO → 'dd/mm/yyyy' (o '—' si inválido).
 *
 * `LocalDate` del backend llega como `YYYY-MM-DD` sin zona. Ese caso se
 * interpreta como fecha civil local; los timestamps completos (`...T...Z` o
 * con offset) siguen usando el instante habitual de JavaScript.
 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Etiquetas cortas de día (es-PE), índice 0 = Domingo. */
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Parsea una fecha del backend a un Date local. El DTO serializa `LocalDate`
 * como "yyyy-MM-dd" (sin zona horaria); interpretarlo como fecha local pura
 * evita el corrimiento por huso (ej. UTC-7 retrocede un día con `new Date('2026-08-03')`).
 */
function parsearFechaLocal(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(iso);
}

/**
 * Calcula el número de semana calendario (ISO) a partir de una fecha ISO.
 * Retorna un número como 32, 33, 34... correspondiente a la semana del año.
 * Usa el algoritmo ISO 8601: la semana 1 es la que contiene el primer jueves del año.
 */
export function semanaCalendario(iso: string | null | undefined): number {
  if (!iso) {
    return 0;
  }
  const d = parsearFechaLocal(iso);
  if (Number.isNaN(d.getTime())) {
    return 0;
  }
  // Algoritmo ISO 8601 simplificado
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Ajustar al jueves más cercano (ISO week starts on Monday)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/**
 * Formatea un ISO como 'Lun 03' / 'Jue 06' (HITO-012): etiqueta corta del día real
 * (derivada de la fecha, no de una columna `dia`) + día del mes. '—' si inválido.
 */
export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = parsearFechaLocal(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const dia = DIAS_CORTOS[d.getDay()] ?? '—';
  return `${dia} ${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Retorna el número de semana ISO del año de la fecha actual.
 * Ej: si hoy es 02/09/2026 → retorna 36.
 */
export function semanaActual(): number {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return semanaCalendario(iso);
}