/**
 * EditarRequerimientoScreen — Screen 13: Edición de Requerimiento (user)
 * (MOD-18 / RF-182..185 / RN-035..036).
 *
 * Approach: react-test-renderer + mock de Keychain + mock via getMockApi
 * (intercepts ALL calls from both static and dynamic imports through the
 * mocked axios instance) + mock useOnlineStatus.
 *
 * Cubre RN-035: la alerta permanente de 30 h se muestra cuando el estado es
 * RECIBIDO y transcurrieron más de 30 h desde el último cambio de estado.
 * Cubre HITO-011: carga de fotos existentes del servidor.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import EditarRequerimientoScreen from '../src/screens/EditarRequerimientoScreen';
import {clearToken, type EstadoRequerimiento} from '../src/services/ApiClient';
import {flushPromises, getMockApi, makeToken} from '../test-utils/helpers';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({goBack: mockGoBack, navigate: jest.fn()})),
    useRoute: jest.fn(() => ({params: {id: 4}})),
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

const FOTOS_DTO = [
  {
    id: 10,
    requerimientoId: 4,
    ruta: '/fotos/foto1.jpg',
    nombreArchivo: 'foto1.jpg',
    tamanoBytes: 1024000,
    contentType: 'image/jpeg',
    metadatos: '{"tipo":"LIBERACION"}',
    creadoEn: '2026-08-20T10:00:00Z',
  },
];

const FUNDOS = [{id: 1, nombre: 'Fundo Norte', createdAt: '', updatedAt: ''}];
const ESPECIES = [{id: 1, nombre: 'Chrysopa sp.', estado: true}];
const ETAPAS = [{id: 1, nombre: 'Emergencia', estado: true}];
const PLAGAS = [{id: 1, nombre: 'Pulga', estado: true}];

/** Requerimiento base con timestamps relativos a `now` (para RN-035). */
function requerimientoBase({updatedAt, estado = 'ENTREGADO'}: {updatedAt: string; estado?: EstadoRequerimiento}) {
  return {
    id: 4,
    fecha: '2026-08-10',
    fundoId: 1,
    fundo: 'Fundo Norte',
    loteId: 10,
    lote: 'Lote A',
    lotes: [{id: 10, nombre: 'Lote A'}],
    especieId: 1,
    especie: 'Chrysopa sp.',
    etapaFenologicaId: null,
    etapaFenologica: null,
    cantidad: 20,
    plagaId: 1,
    plaga: 'Pulga',
    plagas: [{id: 1, nombre: 'Pulga'}],
    estado,
    stockDisponible: 30,
    observaciones: null,
    papelConPostura: null,
    sobreConCascarilla: null,
    fechaLiberacion: '2026-08-10T10:00:00Z',
    horaLiberacion: '10:00',
    creadoPor: 5,
    createdAt: updatedAt,
    updatedAt: updatedAt,
  };
}

/** Requerimiento devuelto por API (mutable por test). */
let requerimientoActual = requerimientoBase({
  updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
});

const api = getMockApi();

async function renderEdicion() {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
  );

  api.get.mockImplementation((url: string) => {
    const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
    if (reqMatch) {
      return Promise.resolve({data: requerimientoActual});
    }
    if (url.match(/\/requerimientos\/\d+\/fotos$/)) {
      return Promise.resolve({data: FOTOS_DTO});
    }
    if (url.match(/\/requerimientos\/\d+\/liberaciones$/)) {
      return Promise.resolve({data: []});
    }
    const stockMatch = url.match(/^\/programaciones\/(\d+)\/stock$/);
    if (stockMatch) {
      return Promise.resolve({data: {stock: 30}});
    }
    if (url === '/fundos') return Promise.resolve({data: FUNDOS});
    if (url === '/especies') return Promise.resolve({data: ESPECIES});
    if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
    if (url === '/plagas') return Promise.resolve({data: PLAGAS});
    if (url.match(/\/lotes/)) return Promise.resolve({data: []});
    return Promise.resolve({data: []});
  });

  api.delete.mockResolvedValue({data: {}});

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<EditarRequerimientoScreen />);
  });
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      await flushPromises();
    });
  }
  return tree;
}

function contarAlertas(tree: ReactTestRenderer.ReactTestRenderer): number {
  return tree.root.findAll(node => node.props.accessibilityRole === 'alert').length;
}

describe('EditarRequerimientoScreen — alerta de 30 h (RN-035)', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('muestra la alerta cuando RECIBIDO superó 30 h sin foto de liberación', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      estado: 'RECIBIDO',
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(contarAlertas(tree)).toBeGreaterThan(0);
  });

  test('NO muestra la alerta cuando RECIBIDO es reciente (menos de 30 h)', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      estado: 'RECIBIDO',
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(contarAlertas(tree)).toBe(0);
  });
});

describe('EditarRequerimientoScreen — fotos del servidor (HITO-011)', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('carga y muestra fotos existentes del servidor', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    const servidorLabels = tree.root.findAll(
      (node: any) =>
        node.props.accessibilityLabel === 'Quitar foto del servidor 1',
    );
    expect(servidorLabels.length).toBeGreaterThanOrEqual(1);
  });

  test('elimina foto del servidor al pulsar Quitar', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      const btns = tree.root.findAll(
        (node: any) =>
          node.props.accessibilityLabel === 'Quitar foto del servidor 1',
      );
      btns[0].props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.delete).toHaveBeenCalledWith('/requerimientos/4/fotos/10');
  });
});
