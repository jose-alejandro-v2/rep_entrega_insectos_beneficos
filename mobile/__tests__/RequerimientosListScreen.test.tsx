/**
 * RequerimientosListScreen — Screen 7: Listado de Solicitudes de Requerimiento
 * (admin). Approach: react-test-renderer + AuthProvider + mock Keychain +
 * mock ApiClient (online-only) + mock useOnlineStatus.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {useNavigation} from '@react-navigation/native';
import {AuthProvider} from '../src/context/AuthContext';
import RequerimientosListScreen from '../src/screens/RequerimientosListScreen';
import {clearToken} from '../src/services/ApiClient';
import {
  contarTexto,
  findByLabel,
  flushPromises,
  makeToken,
} from '../test-utils/helpers';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({navigate: jest.fn(), goBack: jest.fn()})),
  };
});

jest.mock('../src/services/ApiClient', () => {
  const actual = jest.requireActual('../src/services/ApiClient');
  return {
    ...actual,
    listarRequerimientos: jest.fn().mockResolvedValue([]),
  };
});

const TOKEN_ADMIN = makeToken({
  sub: '9',
  groups: ['Admin'],
  rolId: 2,
  nombre: 'Ana Admin',
  dni: '87654321',
  passwordResetRequired: false,
});

const SOLICITUDES_DTO = [
  {
    id: 1,
    fecha: '2026-08-05',
    fundoId: 1,
    fundo: 'Fundo Norte',
    loteId: 10,
    lote: 'Lote A',
    especieId: 1,
    especie: 'Chrysopa sp.',
    etapaFenologicaId: null,
    etapaFenologica: null,
    cantidad: 200,
    plagaId: null,
    plaga: null,
    estado: 'APROBADO' as const,
    stockDisponible: 3000,
    fechaLiberacion: null,
    horaLiberacion: null,
    observaciones: null,
    papelConPostura: null,
    sobreConCascarilla: null,
    creadoPor: null,
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: '2026-08-05T10:00:00Z',
  },
];

const mockNavigate = jest.fn();

async function renderLista(token = TOKEN_ADMIN) {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: token} : null,
  );
  (useNavigation as unknown as jest.Mock).mockReturnValue({
    navigate: mockNavigate,
    goBack: jest.fn(),
  });

  const {listarRequerimientos} = require('../src/services/ApiClient');
  listarRequerimientos.mockResolvedValue(SOLICITUDES_DTO);

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider>
        <RequerimientosListScreen />
      </AuthProvider>,
    );
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

describe('RequerimientosListScreen — listado admin', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
  });

  test('muestra la galería con especie y estado con color', async () => {
    const tree = await renderLista();
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'Chrysopa sp.')).toBeGreaterThan(0);
    // Estado con su etiqueta (RF-154): 'Aprobado'.
    expect(contarTexto(tree, 'Aprobado')).toBeGreaterThan(0);
  });

  test('Nuevo navega a Screen 8 en modo creación', async () => {
    const tree = await renderLista();
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Crear nueva solicitud').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('RequerimientoForm', {});
  });

  test('botón dinámico navega a Screen 8 con el id y readOnly', async () => {
    const tree = await renderLista();
    await act(async () => {
      await flushPromises();
    });

    // APROBADO → botón "Por Entregar", readOnly=false
    await act(async () => {
      findByLabel(tree, 'Por Entregar Chrysopa sp.').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('RequerimientoForm', {id: 1, readOnly: false});
  });

  test('Aplicar filtro llama a listarRequerimientos con el rango', async () => {
    const tree = await renderLista();
    await act(async () => {
      await flushPromises();
    });

    const {listarRequerimientos} = require('../src/services/ApiClient');
    listarRequerimientos.mockClear();
    listarRequerimientos.mockResolvedValue(SOLICITUDES_DTO);

    await act(async () => {
      findByLabel(tree, 'Desde').props.onChange('2026-08-01');
    });
    await act(async () => {
      findByLabel(tree, 'Hasta').props.onChange('2026-08-31');
    });
    await act(async () => {
      findByLabel(tree, 'Aplicar filtro').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(listarRequerimientos).toHaveBeenCalledWith({
      fechaDesde: '2026-08-01',
      fechaHasta: '2026-08-31',
    });
  });
});
