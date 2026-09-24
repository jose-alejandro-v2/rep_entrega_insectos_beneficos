import {formatFecha, formatFechaCorta} from '../src/utils/programacion';

describe('formatFecha', () => {
  it('mantiene la fecha civil local cuando el backend envía YYYY-MM-DD', () => {
    expect(formatFecha('2026-09-23')).toBe('23/09/2026');
    expect(formatFechaCorta('2026-09-23')).toBe('Mié 23');
  });

  it('devuelve guion largo para fechas ausentes o inválidas', () => {
    expect(formatFecha(null)).toBe('—');
    expect(formatFecha('no-es-fecha')).toBe('—');
  });
});
