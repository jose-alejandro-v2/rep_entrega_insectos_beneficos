/**
 * HistorialRequerimientoScreen — Screen 12: Historial de Requerimientos
 * (MOD-18 / RF-179..181). Acceso: user sanidad.
 *
 * Approach: react-test-renderer + AuthProvider + mock de Keychain +
 * mock via getMockApi (all calls go through the mocked axios instance from jest.setup.js)
 * + mock useOnlineStatus.
 *
 * Cubre HITO-011: muestra de fotos en el modal de detalle.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {useNavigation} from '@react-navigation/native';
import HistorialRequerimientoScreen from '../src/screens/HistorialRequerimientoScreen';
import {AuthProvider} from '../src/context/AuthContext';
import {clearToken} from '../src/services/ApiClient';

jest.mock('../src/services/ApiClient', () => {
  const actual = jest.requireActual('../src/services/ApiClient');
  return {
    ...actual,
    getFotoUrl: jest.fn(async (reqId: number, fotoId: number) =>
      `http://localhost:6101/api/v1/requerimientos/${reqId}/fotos/${fotoId}/imagen`,
    ),
  };
});
import {
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

const REQUERIMIENTOS_DTO = [
  {
    id: 1,
    fecha: '2026-08-20',
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
    estado: 'ENTREGADO' as const,
    stockDisponible: 30,
    fechaLiberacion: null,
    horaLiberacion: null,
    observaciones: null,
    papelConPostura: null,
    sobreConCascarilla: null,
    creadoPor: 5,
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
  },
];

const FOTOS_DTO = [
  {
    id: 10,
    requerimientoId: 1,
    ruta: '/fotos/foto1.jpg',
    nombreArchivo: 'foto1.jpg',
    tamanoBytes: 1024000,
    contentType: 'image/jpeg',
    metadatos: '{"tipo":"EVIDENCIA"}',
    creadoEn: '2026-08-20T10:00:00Z',
  },
  {
    id: 11,
    requerimientoId: 1,
    ruta: '/fotos/foto2.jpg',
    nombreArchivo: 'foto2.jpg',
    tamanoBytes: 2048000,
    contentType: 'image/jpeg',
    metadatos: '{"tipo":"EVIDENCIA"}',
    creadoEn: '2026-08-20T10:01:00Z',
  },
];

const api = getMockApi();

async function renderHistorial() {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
  );
  (useNavigation as unknown as jest.Mock).mockReturnValue({
    goBack: jest.fn(),
    navigate: jest.fn(),
  });

  api.get.mockImplementation((url: string, _config?: any) => {
    if (url === '/requerimientos') {
      return Promise.resolve({data: REQUERIMIENTOS_DTO});
    }
    if (typeof url === 'string' && url.match(/\/requerimientos\/\d+\/fotos$/)) {
      return Promise.resolve({data: FOTOS_DTO});
    }
    return Promise.resolve({data: []});
  });

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider>
        <HistorialRequerimientoScreen />
      </AuthProvider>,
    );
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

describe('HistorialRequerimientoScreen — fotos en detalle (HITO-011)', () => {
  beforeEach(async () => {
    await clearToken();
  });

  test('muestra fotos en el modal de detalle', async () => {
    const tree = await renderHistorial();

    // Abrir modal "Ver"
    await act(async () => {
      findByLabel(tree, 'Ver Chrysopa sp.').props.onPress();
    });
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await flushPromises();
      }
    });

    // Verificar que el título de fotos aparece
    const fotosTitle = tree.root.findAll(
      (node: any) => typeof node.props.children === 'string' && node.props.children === 'Evidencia fotográfica',
    );
    expect(fotosTitle.length).toBeGreaterThanOrEqual(1);

    // Verificar que aparecen las fotos (thumbnails con uri correcta)
    const fotoImages = tree.root.findAll(
      (node: any) => node.props.source && node.props.source.uri === 'http://localhost:6101/api/v1/requerimientos/1/fotos/10/imagen',
    );
    expect(fotoImages.length).toBeGreaterThanOrEqual(1);
    const foto2Images = tree.root.findAll(
      (node: any) => node.props.source && node.props.source.uri === 'http://localhost:6101/api/v1/requerimientos/1/fotos/11/imagen',
    );
    expect(foto2Images.length).toBeGreaterThanOrEqual(1);
  });

  test('muestra el historial correctamente', async () => {
    const tree = await renderHistorial();

    // Verificar que se muestra la especie en la card
    const especieNodes = tree.root.findAll(
      (node: any) => typeof node.props.children === 'string' && node.props.children === 'Chrysopa sp.',
    );
    expect(especieNodes.length).toBeGreaterThanOrEqual(1);
  });
});
