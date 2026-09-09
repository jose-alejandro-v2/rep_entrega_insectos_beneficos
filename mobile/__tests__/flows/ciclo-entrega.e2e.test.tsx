/**
 * Flujo completo de Ciclo de Entrega (e2e flow test).
 *
 * Cubre los 3 formularios del ciclo de estados APROBADO → ENTREGADO →
 * RECIBIDO → LIBERADO:
 *  1. DetalleRequerimientoScreen: acciones contextuales por estado.
 *  2. DespachoFormScreen: registrar un despacho (cantidad, papel, sobre).
 *  3. RecepcionFormScreen: confirmar recepción (conforme + observaciones).
 *  4. LiberacionFormScreen: registrar liberación en campo (fundo, lote,
 *     cantidad, hora).
 *
 * Approach: react-test-renderer + mocks globales (jest.setup.js) + mocks
 * de navegación y Keychain. Cada test es independiente.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import DetalleRequerimientoScreen from '../../src/screens/DetalleRequerimientoScreen';
import DespachoFormScreen from '../../src/screens/DespachoFormScreen';
import RecepcionFormScreen from '../../src/screens/RecepcionFormScreen';
import LiberacionFormScreen from '../../src/screens/LiberacionFormScreen';
import {clearToken} from '../../src/services/ApiClient';
import {
  flushPromises,
  getMockApi,
  makeToken,
  findByLabel,
  contarTexto,
} from '../../test-utils/helpers';

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    })),
    useRoute: jest.fn(() => ({params: {requerimientoId: 42, id: 42}})),
  };
});

/* ------------------------------------------------------------------ */
/* Datos de prueba                                                     */
/* ------------------------------------------------------------------ */

const TOKEN_ADMIN = makeToken({
  sub: '5',
  groups: ['Admin'],
  rolId: 2,
  nombre: 'Ana Admin',
  dni: '12345678',
  passwordResetRequired: false,
});

const FUNDOS = [{id: 1, nombre: 'Fundo Norte', createdAt: '', updatedAt: ''}];
const LOTES = [{
  id: 10, fundoId: 1, fundo: 'Fundo Norte', nombre: 'Lote A',
  variedadId: 1, variedad: 'Red Globe', variedadColor: '#FF0000',
  area: 5.5, createdAt: '', updatedAt: '',
}];

function requerimientoConEstado(estado: string) {
  return {
    id: 42,
    fecha: '2026-08-10',
    fundoId: 1,
    fundo: 'Fundo Norte',
    loteId: 10,
    lote: 'Lote A',
    especieId: 1,
    especie: 'Chrysopa sp.',
    etapaFenologicaId: null,
    etapaFenologica: null,
    cantidad: 20,
    plagaId: 1,
    plaga: 'Pulga',
    estado,
    stockDisponible: 30,
    observaciones: null,
    papelConPostura: null,
    sobreConCascarilla: null,
    fechaLiberacion: null,
    horaLiberacion: null,
    createdBy: 5,
    createdAt: '2026-08-10T09:00:00Z',
    updatedAt: '2026-08-10T09:00:00Z',
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Find a node with `accessibilityLabel` AND `onPress` as a function.
 * SelectField's Pressable renders as a host View in react-test-renderer;
 * findByLabel may return the host node (which has the label but no onPress).
 * This helper walks up to find the composite Pressable node.
 */
function findPressableByLabel(
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  const found = tree.root.findAll(
    (node: any) =>
      node.props &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  if (found.length === 0) {
    throw new Error(
      `No se encontró un Pressable con accessibilityLabel="${label}" y onPress`,
    );
  }
  return found[0];
}

async function renderDetalle(estado: string) {
  const api = getMockApi();
  api.get.mockImplementation((url: string) => {
    const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
    if (reqMatch) {
      return Promise.resolve({data: requerimientoConEstado(estado)});
    }
    return Promise.resolve({data: []});
  });

  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
  );

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<DetalleRequerimientoScreen />);
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

/* ================================================================== */
/* Test 1: DetalleRequerimiento con acciones por estado                 */
/* ================================================================== */

describe('Ciclo entrega — DetalleRequerimiento acciones contextuales', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  test('estado APROBADO muestra botón "Ver despachos"', async () => {
    const tree = await renderDetalle('APROBADO');

    const btn = findByLabel(tree, 'Ver despachos');
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DespachoList', {
      requerimientoId: 42,
    });
  });

  test('estado ENTREGADO muestra botón "Ver recepciones"', async () => {
    const tree = await renderDetalle('ENTREGADO');

    const btn = findByLabel(tree, 'Ver recepciones');
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('RecepcionList', {
      requerimientoId: 42,
    });
  });

  test('estado RECIBIDO muestra botón "Ver liberaciones"', async () => {
    const tree = await renderDetalle('RECIBIDO');

    const btn = findByLabel(tree, 'Ver liberaciones');
    expect(btn).toBeTruthy();

    await act(async () => {
      btn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('LiberacionList', {
      requerimientoId: 42,
    });
  });

  test('estado REGISTRADO no muestra botones de acción', async () => {
    const tree = await renderDetalle('REGISTRADO');

    const despachos = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Ver despachos',
    );
    const recepciones = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Ver recepciones',
    );
    const liberaciones = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Ver liberaciones',
    );

    expect(despachos.length).toBe(0);
    expect(recepciones.length).toBe(0);
    expect(liberaciones.length).toBe(0);
  });

  test('muestra información del requerimiento correctamente', async () => {
    const tree = await renderDetalle('APROBADO');

    expect(contarTexto(tree, 'Chrysopa sp.')).toBeGreaterThanOrEqual(1);
    expect(contarTexto(tree, 'Fundo Norte')).toBeGreaterThanOrEqual(1);
    expect(contarTexto(tree, 'Lote A')).toBeGreaterThanOrEqual(1);
    expect(contarTexto(tree, '20 millares')).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/* Test 2: Flujo Despacho — registrar despacho completo                 */
/* ================================================================== */

describe('Ciclo entrega — DespachoFormScreen', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('flujo completo: ingresar cantidad y guardar despacho', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: {
        id: 1,
        requerimientoId: 42,
        cantidadDespachada: 15,
        papelConPostura: 10,
        sobreConCascarilla: 5,
        observaciones: 'Despacho parcial',
        createdBy: 5,
        createdAt: '2026-09-01T10:00:00Z',
      },
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<DespachoFormScreen />);
      await flushPromises();
    });

    // ── Verificar: botón deshabilitado inicialmente ──────────────────
    expect(findByLabel(tree, 'Registrar despacho').props.disabled).toBe(true);

    // ── Paso 1: ingresar cantidad despachada ─────────────────────────
    await act(async () => {
      findByLabel(tree, 'Cantidad despachada').props.onChangeText('15');
    });

    // ── Paso 2: ingresar papel con postura ───────────────────────────
    await act(async () => {
      findByLabel(tree, 'Papel con postura').props.onChangeText('10');
    });

    // ── Paso 3: ingresar sobre con cascarilla ────────────────────────
    await act(async () => {
      findByLabel(tree, 'Sobre con cascarilla').props.onChangeText('5');
    });

    // ── Paso 4: ingresar observaciones ───────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Observaciones').props.onChangeText('Despacho parcial');
    });

    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: botón habilitado ──────────────────────────────────
    expect(findByLabel(tree, 'Registrar despacho').props.disabled).toBe(false);

    // ── Paso 5: guardar ──────────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Registrar despacho').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: POST con datos correctos ──────────────────────────
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/42/despachos',
      expect.objectContaining({
        cantidadDespachada: 15,
        papelConPostura: 10,
        sobreConCascarilla: 5,
        observaciones: 'Despacho parcial',
      }),
    );

    // ── Verificar: navegación de regreso ─────────────────────────────
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('validación: cantidad requerida para habilitar botón', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<DespachoFormScreen />);
      await flushPromises();
    });

    // Sin cantidad → botón deshabilitado
    expect(findByLabel(tree, 'Registrar despacho').props.disabled).toBe(true);

    // Con cantidad → botón habilitado
    await act(async () => {
      findByLabel(tree, 'Cantidad despachada').props.onChangeText('10');
    });
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Registrar despacho').props.disabled).toBe(false);
  });
});

/* ================================================================== */
/* Test 3: Flujo Recepción — confirmar recepción completa               */
/* ================================================================== */

describe('Ciclo entrega — RecepcionFormScreen', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('flujo completo: conforme por defecto, guardar sin observaciones', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: {
        id: 1,
        requerimientoId: 42,
        conforme: true,
        observaciones: null,
        fechaRecepcion: '2026-09-01T10:00:00Z',
        createdBy: 5,
        createdAt: '2026-09-01T10:00:00Z',
      },
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<RecepcionFormScreen />);
      await flushPromises();
    });

    // ── Verificar: conforme está activo por defecto ──────────────────
    const switchNode = findByLabel(tree, 'Recepción conforme');
    expect(switchNode.props.accessibilityState?.value ?? switchNode.props.value).toBe(true);

    // ── Verificar: botón habilitado (conforme=true, no necesita obs) ─
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(false);

    // ── Paso 1: guardar ──────────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Confirmar recepción').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: POST con conforme=true ────────────────────────────
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/42/recepciones',
      expect.objectContaining({
        conforme: true,
        observaciones: null,
      }),
    );

    // ── Verificar: navegación de regreso ─────────────────────────────
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('flujo no conforme: observaciones requeridas para guardar', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<RecepcionFormScreen />);
      await flushPromises();
    });

    // ── Paso 1: cambiar switch a no conforme ─────────────────────────
    await act(async () => {
      findByLabel(tree, 'Recepción conforme').props.onValueChange(false);
    });

    // ── Verificar: botón deshabilitado sin observaciones ─────────────
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(true);

    // ── Paso 2: ingresar observaciones ───────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Observaciones').props.onChangeText(
        'Producto no conforme, daño observado',
      );
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: botón habilitado ──────────────────────────────────
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(false);

    // ── Paso 3: guardar ──────────────────────────────────────────────
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: {
        id: 1, requerimientoId: 42, conforme: false,
        observaciones: 'Producto no conforme, daño observado',
        fechaRecepcion: '2026-09-01T10:00:00Z', createdBy: 5,
        createdAt: '2026-09-01T10:00:00Z',
      },
    });

    await act(async () => {
      findByLabel(tree, 'Confirmar recepción').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: POST con conforme=false y observaciones ───────────
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/42/recepciones',
      expect.objectContaining({
        conforme: false,
        observaciones: 'Producto no conforme, daño observado',
      }),
    );

    expect(mockGoBack).toHaveBeenCalled();
  });

  test('alternar conforme: sin observaciones deshabilita el botón', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<RecepcionFormScreen />);
      await flushPromises();
    });

    // Conforme activo → botón habilitado
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(false);

    // Cambiar a no conforme → botón deshabilitado
    await act(async () => {
      findByLabel(tree, 'Recepción conforme').props.onValueChange(false);
    });
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(true);

    // Volver a conforme → botón habilitado
    await act(async () => {
      findByLabel(tree, 'Recepción conforme').props.onValueChange(true);
    });
    expect(findByLabel(tree, 'Confirmar recepción').props.disabled).toBe(false);
  });
});

/* ================================================================== */
/* Test 4: Flujo Liberación — registrar liberación completa              */
/* ================================================================== */

describe('Ciclo entrega — LiberacionFormScreen', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('flujo completo: cargar catálogos, seleccionar fundo/lote y guardar', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });
    api.post.mockResolvedValue({
      data: {
        id: 1,
        requerimientoId: 42,
        fundoId: 1,
        fundoNombre: 'Fundo Norte',
        loteId: 10,
        loteNombre: 'Lote A',
        cantidadLiberada: 20,
        observaciones: null,
        fechaLiberacion: '2026-09-01',
        horaLiberacion: '10:30',
        createdBy: 5,
        createdAt: '2026-09-01T10:30:00Z',
      },
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<LiberacionFormScreen />);
      await flushPromises();
      await flushPromises();
    });

    // ── Verificar: botón deshabilitado inicialmente ──────────────────
    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(true);

    // ── Paso 1: seleccionar Fundo ────────────────────────────────────
    await act(async () => {
      findPressableByLabel(tree, 'Fundo').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Opción Fundo Fundo Norte').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Paso 2: seleccionar Lote ─────────────────────────────────────
    await act(async () => {
      findPressableByLabel(tree, 'Lote').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Opción Lote Lote A').props.onPress();
    });

    // ── Paso 3: ingresar cantidad liberada ───────────────────────────
    await act(async () => {
      findByLabel(tree, 'Cantidad liberada').props.onChangeText('20');
    });

    // ── Paso 4: ingresar hora ────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Hora de liberación').props.onChangeText('10:30');
    });

    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: botón habilitado ──────────────────────────────────
    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(false);

    // ── Paso 5: guardar ──────────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Registrar liberación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: POST con datos correctos ──────────────────────────
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/42/liberaciones',
      expect.objectContaining({
        fundoId: 1,
        loteId: 10,
        cantidadLiberada: 20,
        horaLiberacion: '10:30',
      }),
    );

    // ── Verificar: navegación de regreso ─────────────────────────────
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('validación: campos obligatorios para habilitar botón', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<LiberacionFormScreen />);
      await flushPromises();
      await flushPromises();
    });

    // Sin seleccionar nada → deshabilitado
    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(true);

    // Limpiar hora pre-llenada para poder probar la validación
    await act(async () => {
      findByLabel(tree, 'Hora de liberación').props.onChangeText('');
    });

    // Solo fundo + lote → sigue deshabilitado (falta cantidad y hora)
    await act(async () => {
      findPressableByLabel(tree, 'Fundo').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Opción Fundo Fundo Norte').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findPressableByLabel(tree, 'Lote').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Opción Lote Lote A').props.onPress();
    });

    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(true);

    // Agregar cantidad → sigue deshabilitado (falta hora)
    await act(async () => {
      findByLabel(tree, 'Cantidad liberada').props.onChangeText('10');
    });
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(true);

    // Agregar hora → habilitado
    await act(async () => {
      findByLabel(tree, 'Hora de liberación').props.onChangeText('08:00');
    });
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Registrar liberación').props.disabled).toBe(false);
  });

  test('selección de fundo recarga lotes del fundo', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<LiberacionFormScreen />);
      await flushPromises();
      await flushPromises();
    });

    // Seleccionar fundo
    await act(async () => {
      findPressableByLabel(tree, 'Fundo').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Opción Fundo Fundo Norte').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // Verificar: se llamó GET /lotes (con fundoId)
    expect(api.get).toHaveBeenCalledWith(
      '/lotes',
      expect.objectContaining({params: {fundoId: 1}}),
    );
  });
});
