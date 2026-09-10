/**
 * NuevoRequerimientoScreen — Screen 10: Formulario de Nuevo Requerimiento
 * (user). Approach: react-test-renderer + mock de Keychain + mock ApiClient
 * (getMockApi for underlying axios) para los catálogos, stock y creación.
 *
 * Los desplegables (SelectField) abren un Modal: se abre el campo y luego se
 * elige la opción (accessibilityLabel "Opción <Campo> <Nombre>").
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {launchImageLibrary} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import NuevoRequerimientoScreen from '../src/screens/NuevoRequerimientoScreen';
import {clearToken} from '../src/services/ApiClient';
import {
  contarTexto,
  findByLabel,
  flushPromises,
  getMockApi,
  makeToken,
} from '../test-utils/helpers';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({navigate: jest.fn(), goBack: jest.fn()})),
  };
});

const TOKEN_USUARIO = makeToken({
  sub: '5',
  groups: ['Usuario'],
  rolId: 3,
  nombre: 'Sonia Sanidad',
  dni: '12345678',
  passwordResetRequired: false,
});

const FUNDOS = [{id: 1, nombre: 'Fundo Norte', estado: true}];
const LOTES = [{id: 10, fundoId: 1, nombre: 'Lote A', estado: true}];
const ESPECIES = [{id: 1, nombre: 'Chrysopa sp.', estado: true}];
const ETAPAS = [{id: 1, nombre: 'Emergencia', estado: true}];
const PLAGAS = [{id: 1, nombre: 'Pulga', estado: true}];

let api = getMockApi();
const mockGoBack = jest.fn();

async function renderForm(stock = 30) {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
  );
  (useNavigation as unknown as jest.Mock).mockReturnValue({
    goBack: mockGoBack,
    navigate: jest.fn(),
  });

  api.get.mockImplementation((url: string) => {
    if (url === '/fundos') {
      return Promise.resolve({data: FUNDOS});
    }
    if (url === '/lotes') {
      return Promise.resolve({data: LOTES});
    }
    if (url === '/especies') {
      return Promise.resolve({data: ESPECIES});
    }
    if (url === '/etapas-fenologicas') {
      return Promise.resolve({data: ETAPAS});
    }
    if (url === '/plagas') {
      return Promise.resolve({data: PLAGAS});
    }
    if (url === '/programaciones/1/stock') {
      return Promise.resolve({data: {stock}});
    }
    return Promise.resolve({data: []});
  });

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<NuevoRequerimientoScreen />);
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

async function elegirOpcion(
  tree: ReactTestRenderer.ReactTestRenderer,
  campo: string,
  opcion: string,
) {
  await act(async () => {
    findByLabel(tree, campo).props.onPress();
  });
  await act(async () => {
    findByLabel(tree, opcion).props.onPress();
  });
  await act(async () => {
    await flushPromises();
  });
}

/** Selecciona una opción en un MultiSelectField (requiere presionar "Listo" para cerrar). */
async function elegirMultiOpcion(
  tree: ReactTestRenderer.ReactTestRenderer,
  campo: string,
  opcion: string,
) {
  await act(async () => {
    findByLabel(tree, campo).props.onPress();
  });
  await act(async () => {
    findByLabel(tree, opcion).props.onPress();
  });
  await act(async () => {
    findByLabel(tree, 'Confirmar selección').props.onPress();
  });
  await act(async () => {
    await flushPromises();
  });
}

describe('NuevoRequerimientoScreen — formulario user', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
    api.get.mockClear();
    api.post.mockClear();
    (launchImageLibrary as jest.Mock).mockReset();
    (launchImageLibrary as jest.Mock).mockResolvedValue({didCancel: true});
  });

  test('muestra el formulario y actualiza el stock al elegir especie', async () => {
    const tree = await renderForm();
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(true);
    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');
    expect(contarTexto(tree, '30 millares')).toBe(1);
  });

  test('selecciona todos los campos obligatorios y crea el requerimiento', async () => {
    api.post.mockResolvedValue({
      data: {
        id: 99,
        fecha: '2026-09-02',
        fundoId: 1,
        fundo: 'Fundo Norte',
        loteId: 10,
        lote: 'Lote A',
        especieId: 1,
        especie: 'Chrysopa sp.',
        etapaFenologicaId: 1,
        etapaFenologica: 'Emergencia',
        cantidad: 20,
        plagaId: 1,
        plaga: 'Pulga',
        estado: 'REGISTRADO',
        stockDisponible: 30,
        observaciones: null,
        papelConPostura: null,
        sobreConCascarilla: null,
        fechaLiberacion: null,
        horaLiberacion: null,
        creadoPor: 5,
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      },
    });
    const tree = await renderForm();
    await act(async () => {
      await flushPromises();
    });

    await elegirOpcion(tree, 'Fundo', 'Opción Fundo Fundo Norte');
    await elegirMultiOpcion(tree, 'Lote', 'Opción Lote Lote A');
    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');
    await elegirOpcion(tree, 'Etapa fenológica', 'Opción Etapa Emergencia');
    await elegirMultiOpcion(tree, 'Plaga objetivo', 'Opción Plaga Pulga');

    await act(async () => {
      findByLabel(tree, 'Cantidad').props.onChangeText('20');
    });
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(false);
    await act(async () => {
      findByLabel(tree, 'Enviar Solicitud').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos',
      expect.objectContaining({
        fundoId: 1,
        lotes: [10],
        especieId: 1,
        etapaFenologicaId: 1,
        cantidad: 20,
        plagas: [1],
      }),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('bloquea el envío cuando la cantidad supera el stock', async () => {
    const tree = await renderForm(5);
    await act(async () => {
      await flushPromises();
    });

    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');
    await act(async () => {
      findByLabel(tree, 'Cantidad').props.onChangeText('20');
    });
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'La cantidad supera el stock disponible')).toBe(1);
    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(true);
  });
});
