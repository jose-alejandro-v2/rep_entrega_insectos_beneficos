/**
 * requerimientos.ts — helpers del pendiente de liberación (v1.12.0).
 *
 * Regla de negocio del flujo usuario (Screen 12 → Screen 13):
 *  - `cantidadLiberada` persistida = papel + sobre de ESA liberación.
 *  - Cantidad mostrada = pendiente = cantidad pedida − Σ(papel + sobre) liberado.
 *  - Defaults de papel/sobre = restante por presentación.
 */

import {
  pendienteLiberacion,
  restantePresentaciones,
  totalLiberado,
  validarPresentacionesVsPendiente,
} from '../src/utils/requerimientos';

/** Liberación del lote A: 60 papel + 20 sobre (cantidadLiberada = 80). */
const LIBERACION_LOTE_A = {papelConPostura: 60, sobreConCascarilla: 20};

/** Liberaciones de los 2 lotes del requerimiento de 140 millares. */
const LIBERACIONES_COMPLETAS = [
  LIBERACION_LOTE_A,
  {papelConPostura: 40, sobreConCascarilla: 20},
];

describe('pendienteLiberacion', () => {
  test('sin liberaciones el pendiente es la cantidad pedida', () => {
    expect(pendienteLiberacion(140, [])).toBe(140);
  });

  test('resta Σ(papel + sobre) de las liberaciones registradas (140 − 80 = 60)', () => {
    expect(totalLiberado([LIBERACION_LOTE_A])).toBe(80);
    expect(pendienteLiberacion(140, [LIBERACION_LOTE_A])).toBe(60);
  });

  test('con todas las liberaciones registradas el pendiente es 0 (nunca negativo)', () => {
    expect(pendienteLiberacion(140, LIBERACIONES_COMPLETAS)).toBe(0);
    expect(
      pendienteLiberacion(140, [
        ...LIBERACIONES_COMPLETAS,
        {papelConPostura: 10, sobreConCascarilla: 5},
      ]),
    ).toBe(0);
  });

  test('liberaciones legacy sin papel/sobre (null) aportan 0', () => {
    expect(
      pendienteLiberacion(140, [
        {papelConPostura: null, sobreConCascarilla: null},
      ]),
    ).toBe(140);
  });
});

describe('restantePresentaciones', () => {
  test('sin liberaciones devuelve los valores del requerimiento', () => {
    expect(
      restantePresentaciones({papelConPostura: 100, sobreConCascarilla: 40}, []),
    ).toEqual({papel: 100, sobre: 40});
  });

  test('descuenta por presentación (papel 100−60=40, sobre 40−20=20)', () => {
    expect(
      restantePresentaciones({papelConPostura: 100, sobreConCascarilla: 40}, [
        LIBERACION_LOTE_A,
      ]),
    ).toEqual({papel: 40, sobre: 20});
  });

  test('nunca negativo y tolera valores null', () => {
    expect(
      restantePresentaciones({papelConPostura: null, sobreConCascarilla: null}, [
        LIBERACION_LOTE_A,
      ]),
    ).toEqual({papel: 0, sobre: 0});
    expect(
      restantePresentaciones({papelConPostura: 60, sobreConCascarilla: 20}, LIBERACIONES_COMPLETAS),
    ).toEqual({papel: 0, sobre: 0});
  });
});

describe('validarPresentacionesVsPendiente', () => {
  test('exige al menos una presentación mayor a cero', () => {
    expect(validarPresentacionesVsPendiente(0, 0, 60)).toBe(
      'Ingresa papel con postura o sobre con cascarilla de arroz',
    );
  });

  test('bloquea cuando papel + sobre supera el pendiente', () => {
    expect(validarPresentacionesVsPendiente(100, 20, 60)).toBe(
      'La suma de papel + sobre supera la cantidad por liberar',
    );
  });

  test('permite cuando papel + sobre cabe en el pendiente (o lo iguala)', () => {
    expect(validarPresentacionesVsPendiente(40, 20, 60)).toBeNull();
    expect(validarPresentacionesVsPendiente(60, 0, 60)).toBeNull();
  });
});