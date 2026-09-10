/**
 * ProgramacionEdicionScreen — Screen 5: Edición de Programación (MOD-17).
 *
 * Approach (igual que CatalogosScreen.test.tsx): react-test-renderer +
 * AuthProvider + mock de Keychain (JWT fabricado con makeToken) + mock axios
 * (getMockApi) para listarEspecies (GET /especies), obtenerDetalle
 * (GET /programaciones/{id}), listarProgramaciones (GET /programaciones) y el
 * flujo Enviar stock (PUT + POST /programaciones/{id}/publicar).
 * `useRoute` se mockea con los params de navegación y `esDiaEditable` se
 * fuerza a `true` por defecto (RF-147/148 se cubre con un test dedicado a
 * día no editable, que apaga el mock).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {useNavigation, useRoute} from '@react-navigation/native';
import {AuthProvider} from '../src/context/AuthContext';
import ProgramacionEdicionScreen from '../src/screens/ProgramacionEdicionScreen';
import {clearToken} from '../src/services/ApiClient';
import {esDiaEditable} from '../src/utils/programacion';
import {
  contarTexto,
  findByLabel,
  flushPromises,
  getMockApi,
  makeToken,
} from '../test-utils/helpers';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({goBack: mockGoBack})),
    useRoute: jest.fn(() => ({
      params: {id: 7, anio: 2026, mes: 8},
    })),
  };
});

jest.mock('../src/utils/programacion', () => {
  const actual = jest.requireActual('../src/utils/programacion');
  return {...actual, esDiaEditable: jest.fn(() => true)};
});

const ESPECIES = [
  {id: 1, nombre: 'Chrysopa sp.', estado: 'ACTIVO'},
  {id: 2, nombre: 'Cryptolaemus', estado: 'ACTIVO'},
];

// Agosto 2026: 9 filas reales (Lunes+Jueves dentro del mes) — NINGUNA SE DESCARTA,
// incluida la del último Lunes 31 que cierra el mes:
// Lun 03 · Jue 06 · Lun 10 · Jue 13 · Lun 17 · Jue 20 · Lun 24 · Jue 27 · Lun 31.
// Semana del mes = ((día-1)/7)+1 → agrupa Lun+Jue de una misma semana. El backend
// genera todas las L/J reales (ProgramacionService.crearProgramacionInicial) y el
// fixture refleja ese mismo set para no dejar vacíos en el flujo.
const DETALLE_AGOSTO = {
  id: 7,
  anio: 2026,
  mes: 8,
  especieId: 1,
  especie: 'Chrysopa sp.',
  fechaRegistro: '2026-08-18T10:00:00Z',
  fechaPublicacion: null,
  estado: 'EN_PROCESO',
  stockInicialBase: 5000,
  totalMes: 6000,
  detalles: [
    {
      id: 11,
      semana: 32,
      fecha: '2026-08-03',
      stockInicial: 5000,
      papelConPostura: 2000,
      sobreConCascarilla: 1000,
      total: 3000,
      stockFinal: 2000,
      estado: 'EN_PROCESO',
    },
    {
      id: 12,
      semana: 32,
      fecha: '2026-08-06',
      stockInicial: 2000,
      papelConPostura: 1000,
      sobreConCascarilla: 500,
      total: 1500,
      stockFinal: 500,
      estado: 'EN_PROCESO',
    },
    {
      id: 13,
      semana: 33,
      fecha: '2026-08-10',
      stockInicial: 500,
      papelConPostura: 1000,
      sobreConCascarilla: 500,
      total: 1500,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 14,
      semana: 33,
      fecha: '2026-08-13',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 15,
      semana: 34,
      fecha: '2026-08-17',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 16,
      semana: 34,
      fecha: '2026-08-20',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 17,
      semana: 35,
      fecha: '2026-08-24',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 18,
      semana: 35,
      fecha: '2026-08-27',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
    {
      id: 19,
      semana: 36,
      fecha: '2026-08-31',
      stockInicial: -1000,
      papelConPostura: 0,
      sobreConCascarilla: 0,
      total: 0,
      stockFinal: -1000,
      estado: 'EN_PROCESO',
    },
  ],
};

const DETALLE_SETIEMBRE = {
  id: 8,
  anio: 2026,
  mes: 9,
  especieId: 1,
  especie: 'Chrysopa sp.',
  fechaRegistro: '2026-09-01T10:00:00Z',
  fechaPublicacion: null,
  estado: 'EN_PROCESO',
  stockInicialBase: 5000,
  totalMes: 0,
  detalles: [],
};

const TOKEN_ADMIN = makeToken({
  sub: '9',
  groups: ['Admin'],
  rolId: 2,
  nombre: 'Ana Admin',
  dni: '87654321',
  passwordResetRequired: false,
});

let api = getMockApi();

async function renderEdicion() {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: TOKEN_ADMIN} : null,
  );

  api.get.mockImplementation((url: string, config?: {params?: {anio?: number; mes?: number}}) => {
    if (url === '/especies') {
      return Promise.resolve({data: ESPECIES});
    }
    if (url === '/programaciones/7') {
      return Promise.resolve({data: DETALLE_AGOSTO});
    }
    if (url === '/programaciones/8') {
      return Promise.resolve({data: DETALLE_SETIEMBRE});
    }
    if (url === '/programaciones') {
      const lista =
        config?.params?.mes === 9 ? [DETALLE_SETIEMBRE] : [DETALLE_AGOSTO];
      return Promise.resolve({data: lista});
    }
    return Promise.resolve({data: []});
  });

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider>
        <ProgramacionEdicionScreen />
      </AuthProvider>,
    );
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

describe('ProgramacionEdicionScreen — edición (Admin)', () => {
  beforeEach(async () => {
    await clearToken();
    api.get.mockClear();
    api.put.mockClear();
    api.post.mockClear();
    mockGoBack.mockClear();
    (esDiaEditable as unknown as jest.Mock).mockReturnValue(true);
  });

  test('carga el detalle (GET /programaciones/7) y muestra la tabla semanal', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/programaciones/7');
    expect(contarTexto(tree, 'Papel')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Sobre')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Restante')).toBeGreaterThan(0);
    expect(findByLabel(tree, 'Papel Lun 03')).toBeTruthy();
    expect(findByLabel(tree, 'Papel Lun 10')).toBeTruthy();
    expect(findByLabel(tree, 'Sobre Jue 06')).toBeTruthy();
    // Ningún Lunes/Jueves real del mes se descarta: el último Lun 31 también aparece.
    expect(findByLabel(tree, 'Papel Lun 31')).toBeTruthy();
    expect(findByLabel(tree, 'Sobre Lun 31')).toBeTruthy();
    expect(findByLabel(tree, 'Enviar stock')).toBeTruthy();
  });

  test('el filtro de especie muestra el catálogo', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Especie Chrysopa sp.')).toBeTruthy();
    expect(findByLabel(tree, 'Especie Cryptolaemus')).toBeTruthy();
  });

  test('precarga papel/sobre desde el detalle', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    const papelLun03 = findByLabel(tree, 'Papel Lun 03');
    const sobreJue06 = findByLabel(tree, 'Sobre Jue 06');
    expect(papelLun03.props.value).toBe('2000');
    expect(sobreJue06.props.value).toBe('500');
  });

  test('filas con total 0 muestran inputs vacíos (no "0")', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Lun 17 / Jue 20 tienen papel=0/sobre=0 → input vacío.
    expect(findByLabel(tree, 'Papel Lun 17').props.value).toBe('');
    expect(findByLabel(tree, 'Sobre Jue 20').props.value).toBe('');
  });

  test('el remanente puede ser negativo y muestra "excedido"', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Tras Lun 10 (restante -1000) el excedido se muestra en las filas siguientes.
    expect(contarTexto(tree, '-1000')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'excedido')).toBeGreaterThan(0);
  });

  test('Enviar stock hace PUT + POST /publicar y muestra confirmación', async () => {
    api.put.mockResolvedValue({data: DETALLE_AGOSTO});
    api.post.mockResolvedValue({
      data: {mensaje: 'Programación publicada exitosamente.'},
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Enviar stock').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.put).toHaveBeenCalledWith(
      '/programaciones/7',
      expect.objectContaining({
        stockInicialBase: 5000,
        detalles: expect.any(Array),
      }),
    );
    expect(api.post).toHaveBeenCalledWith('/programaciones/7/publicar');
    expect(contarTexto(tree, 'Programación publicada exitosamente.')).toBe(1);
  });

  test('cambiar de mes recarga la programación del periodo', async () => {
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    api.get.mockClear();
    await act(async () => {
      findByLabel(tree, 'Mes siguiente').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/programaciones', {
      params: {anio: 2026, mes: 9},
    });
    expect(api.get).toHaveBeenCalledWith('/programaciones/8');
  });

  test('día no editable deshabilita el botón Enviar stock', async () => {
    (esDiaEditable as unknown as jest.Mock).mockReturnValue(false);
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    const boton = findByLabel(tree, 'Enviar stock');
    expect(boton.props.disabled).toBe(true);
    expect(
      contarTexto(
        tree,
        'La edición solo está permitida los lunes y jueves de 00:00 a 23:59.',
      ),
    ).toBe(1);
  });

  test('modo crear: selecciona especie, genera filas, Enviar stock crea+guarda+publica', async () => {
    (useRoute as unknown as jest.Mock).mockReturnValue({
      params: {anio: 2026, mes: 8, modo: 'crear'},
    });
    const mockGoBackCrear = jest.fn();
    (useNavigation as unknown as jest.Mock).mockReturnValue({
      goBack: mockGoBackCrear,
    });

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // HITO-016: la tabla del mes se muestra al montar, sin seleccionar especie.
    expect(findByLabel(tree, 'Papel Lun 03')).toBeTruthy();
    expect(findByLabel(tree, 'Sobre Jue 06')).toBeTruthy();

    // Modo crear: no debe existir programación del periodo+especie (lista vacía).
    api.get.mockImplementation((url: string) => {
      if (url === '/especies') {
        return Promise.resolve({data: ESPECIES});
      }
      return Promise.resolve({data: []});
    });
    api.post.mockResolvedValue({
      data: {
        id: 9,
        anio: 2026,
        mes: 8,
        especieId: 1,
        estado: 'EN_PROCESO',
        stockInicialBase: 5000,
        totalMes: 0,
        detalles: [],
      },
    });
    api.put.mockResolvedValue({data: {}});

    // Seleccionar una especie del catálogo → genera filas vacías localmente.
    await act(async () => {
      findByLabel(tree, 'Especie Chrysopa sp.').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // La tabla ahora debe estar visible con filas generadas.
    // Presionar "Enviar stock" → crea (POST) + guarda (PUT) + publica (POST /publicar).
    await act(async () => {
      findByLabel(tree, 'Enviar stock').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    // 1. POST crear
    expect(api.post).toHaveBeenCalledWith('/programaciones', {
      anio: 2026,
      mes: 8,
      especieId: 1,
    });
    // 2. PUT actualizar detalles (las filas vacías generadas) + esCreacionInicial
    expect(api.put).toHaveBeenCalledWith(
      '/programaciones/9',
      expect.objectContaining({
        stockInicialBase: 5000,
        esCreacionInicial: true,
      }),
    );
    // 3. POST publicar
    expect(api.post).toHaveBeenCalledWith('/programaciones/9/publicar');
    // 4. Navegar al listado después de 1.5s (goBack, no replace)
    await act(async () => {
      await new Promise(resolve => setTimeout(() => resolve(undefined), 2000));
    });
    expect(mockGoBackCrear).toHaveBeenCalled();
  }, 10000);

  test('modo crear: la tabla aparece al montar y el botón requiere especie seleccionada', async () => {
    (useRoute as unknown as jest.Mock).mockReturnValue({
      params: {anio: 2026, mes: 8, modo: 'crear'},
    });
    api.get.mockImplementation((url: string) => {
      if (url === '/especies') {
        return Promise.resolve({data: ESPECIES});
      }
      return Promise.resolve({data: []});
    });

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Tabla visible al montar, sin seleccionar especie aún.
    expect(findByLabel(tree, 'Papel Lun 03')).toBeTruthy();
    expect(findByLabel(tree, 'Sobre Lun 31')).toBeTruthy();
    // Inputs habilitados para digitar de inmediato.
    expect(findByLabel(tree, 'Papel Lun 03').props.editable).toBe(true);
    // Sin especie seleccionada → "Enviar stock" deshabilitado.
    expect(findByLabel(tree, 'Enviar stock').props.disabled).toBe(true);
    // No se cargó ningún detalle de programación existente.
    expect(api.get).not.toHaveBeenCalledWith('/programaciones/7');
  });

  test('modo crear: disponible en día no editable (sin avisos L/J, botón activo con especie)', async () => {
    (esDiaEditable as unknown as jest.Mock).mockReturnValue(false);
    (useRoute as unknown as jest.Mock).mockReturnValue({
      params: {anio: 2026, mes: 8, modo: 'crear'},
    });
    api.get.mockImplementation((url: string) => {
      if (url === '/especies') {
        return Promise.resolve({data: ESPECIES});
      }
      return Promise.resolve({data: []});
    });
    api.post.mockResolvedValue({
      data: {
        id: 10,
        anio: 2026,
        mes: 8,
        especieId: 2,
        estado: 'EN_PROCESO',
        stockInicialBase: 5000,
        totalMes: 0,
        detalles: [],
      },
    });
    api.put.mockResolvedValue({data: {}});

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Sin avisos de restricción L/J en modo crear.
    expect(
      contarTexto(
        tree,
        'La edición solo está permitida los lunes y jueves de 00:00 a 23:59.',
      ),
    ).toBe(0);
    expect(
      contarTexto(
        tree,
        'La creación solo está permitida los lunes y jueves de 00:00 a 23:59.',
      ),
    ).toBe(0);

    // Seleccionar especie → botón habilitado e inputs editables.
    await act(async () => {
      findByLabel(tree, 'Especie Cryptolaemus').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    expect(findByLabel(tree, 'Enviar stock').props.disabled).toBe(false);
    expect(findByLabel(tree, 'Papel Lun 03').props.editable).toBe(true);

    await act(async () => {
      findByLabel(tree, 'Enviar stock').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith('/programaciones', {
      anio: 2026,
      mes: 8,
      especieId: 2,
    });
    expect(api.put).toHaveBeenCalledWith(
      '/programaciones/10',
      expect.objectContaining({esCreacionInicial: true}),
    );

    // Drenar el setTimeout(1.5s) de navegación tras publicar.
    await act(async () => {
      await new Promise(resolve => setTimeout(() => resolve(undefined), 2000));
    });
  }, 10000);
});