/**
 * Flujo completo de Requerimientos (e2e flow test).
 *
 * Cubre 3 tramos del flujo de usuario:
 *  1. Crear requerimiento (NuevoRequerimientoScreen): selección de campos,
 *     validación de stock, envío y subida de fotos.
 *  2. Editar requerimiento (EditarRequerimientoScreen): carga de datos
 *     existentes, edición de observaciones y actualización.
 *  3. Historial de requerimientos (HistorialRequerimientoScreen): listado,
 *     apertura de modal de detalle con fotos.
 *
 * Approach: react-test-renderer + mocks globales (jest.setup.js) + mocks
 * de navegación y Keychain. Cada test es independiente.
 *
 * Patrones de mocks siguen los tests unitarios existentes:
 * - NuevoRequerimientoScreen.test.tsx (ApiKey mock via getMockApi)
 * - EditarRequerimientoScreen.test.tsx (ApiKey mock + Keychain)
 * - HistorialRequerimientoScreen.test.tsx (AuthProvider + Keychain + ApiClient mock parcial)
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {launchImageLibrary} from 'react-native-image-picker';
import NuevoRequerimientoScreen from '../../src/screens/NuevoRequerimientoScreen';
import EditarRequerimientoScreen from '../../src/screens/EditarRequerimientoScreen';
import HistorialRequerimientoScreen from '../../src/screens/HistorialRequerimientoScreen';
import {AuthProvider} from '../../src/context/AuthContext';
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
    useRoute: jest.fn(() => ({params: {id: 42}})),
  };
});

jest.setTimeout(30000);

/* ------------------------------------------------------------------ */
/* Datos de prueba                                                     */
/* ------------------------------------------------------------------ */

const TOKEN_USUARIO = makeToken({
  sub: '5',
  groups: ['Usuario'],
  rolId: 3,
  nombre: 'Sonia Sanidad',
  dni: '12345678',
  passwordResetRequired: false,
});

const FUNDOS = [{id: 1, nombre: 'Fundo Norte', createdAt: '', updatedAt: ''}];
const LOTES = [{id: 10, fundoId: 1, fundo: 'Fundo Norte', nombre: 'Lote A', createdAt: '', updatedAt: ''}];
const ESPECIES = [{id: 1, nombre: 'Chrysopa sp.', estado: true}];
const ETAPAS = [{id: 1, nombre: 'Emergencia', estado: true}];
const PLAGAS = [{id: 1, nombre: 'Pulga', estado: true}];

const REQUERIMIENTO_DTO = {
  id: 42,
  fecha: '2026-08-10',
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
  estado: 'REGISTRADO' as const,
  stockDisponible: 30,
  observaciones: 'Observación original',
  papelConPostura: null,
  sobreConCascarilla: null,
  fechaLiberacion: null,
  horaLiberacion: null,
  creadoPor: 5,
  createdAt: '2026-08-10T09:00:00Z',
  updatedAt: '2026-08-10T09:00:00Z',
};

const FOTOS_DTO = [
  {
    id: 10,
    requerimientoId: 42,
    ruta: '/fotos/foto1.jpg',
    nombreArchivo: 'foto1.jpg',
    tamanoBytes: 1024000,
    contentType: 'image/jpeg',
    metadatos: '{"tipo":"EVIDENCIA"}',
    creadoEn: '2026-08-20T10:00:00Z',
  },
];

const FOTO_ASSET = {
  uri: 'file:///tmp/foto.jpg',
  type: 'image/jpeg',
  fileName: 'foto1.jpg',
  fileSize: 1024000,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

/* ================================================================== */
/* Test 1: Flujo crear requerimiento completo                           */
/* Sigue patrón exacto de NuevoRequerimientoScreen.test.tsx             */
/* ================================================================== */

describe('Flujo requerimiento — crear nuevo requerimiento', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    (launchImageLibrary as jest.Mock).mockReset();
    (launchImageLibrary as jest.Mock).mockResolvedValue({didCancel: true});
  });

  test('flujo completo: seleccionar todos los campos y crear requerimiento', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/lotes') return Promise.resolve({data: LOTES});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url === '/programaciones/1/stock') return Promise.resolve({data: {stock: 30}});
      return Promise.resolve({data: []});
    });
    api.post.mockResolvedValue({
      data: {
        id: 99, fecha: '2026-09-02', fundoId: 1, fundo: 'Fundo Norte',
        loteId: 10, lote: 'Lote A', especieId: 1, especie: 'Chrysopa sp.',
        etapaFenologicaId: 1, etapaFenologica: 'Emergencia', cantidad: 20,
        plagaId: 1, plaga: 'Pulga', estado: 'REGISTRADO', stockDisponible: 30,
        observaciones: null, papelConPostura: null, sobreConCascarilla: null,
        fechaLiberacion: null, horaLiberacion: null, createdBy: 5,
        createdAt: '2026-09-02T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z',
      },
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<NuevoRequerimientoScreen />);
      await flushPromises();
      await flushPromises();
    });

    // ── Verificar estado inicial: botón deshabilitado ────────────────
    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(true);

    // ── Paso 1: seleccionar Fundo ────────────────────────────────────
    await elegirOpcion(tree, 'Fundo', 'Opción Fundo Fundo Norte');

    // ── Paso 2: seleccionar Lote ─────────────────────────────────────
    await elegirOpcion(tree, 'Lote', 'Opción Lote Lote A');

    // ── Paso 3: seleccionar Especie → stock se actualiza ─────────────
    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');
    expect(contarTexto(tree, '30 millares')).toBe(1);

    // ── Paso 4: seleccionar Etapa fenológica ─────────────────────────
    await elegirOpcion(tree, 'Etapa fenológica', 'Opción Etapa Emergencia');

    // ── Paso 5: seleccionar Plaga objetivo ───────────────────────────
    await elegirOpcion(tree, 'Plaga objetivo', 'Opción Plaga Pulga');

    // ── Paso 6: ingresar cantidad ────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Cantidad').props.onChangeText('20');
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: botón habilitado ──────────────────────────────────
    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(false);

    // ── Paso 7: enviar ───────────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Enviar Solicitud').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: API llamada con datos correctos ───────────────────
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos',
      expect.objectContaining({
        fundoId: 1,
        loteId: 10,
        especieId: 1,
        etapaFenologicaId: 1,
        cantidad: 20,
        plagaId: 1,
      }),
    );

    // ── Verificar: navegación de regreso ─────────────────────────────
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('flujo crear con foto: agrega foto y sube al crear', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/lotes') return Promise.resolve({data: LOTES});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url === '/programaciones/1/stock') return Promise.resolve({data: {stock: 30}});
      return Promise.resolve({data: []});
    });
    api.post.mockImplementation((url: string) => {
      if (url === '/requerimientos') {
        return Promise.resolve({data: {id: 99, estado: 'REGISTRADO'}});
      }
      return Promise.resolve({data: {id: 1, ruta: '/fotos/1.jpg'}});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<NuevoRequerimientoScreen />);
      await flushPromises();
      await flushPromises();
    });

    // Seleccionar campos
    await elegirOpcion(tree, 'Fundo', 'Opción Fundo Fundo Norte');
    await elegirOpcion(tree, 'Lote', 'Opción Lote Lote A');
    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');
    await elegirOpcion(tree, 'Etapa fenológica', 'Opción Etapa Emergencia');
    await elegirOpcion(tree, 'Plaga objetivo', 'Opción Plaga Pulga');

    await act(async () => {
      findByLabel(tree, 'Cantidad').props.onChangeText('20');
    });
    await act(async () => {
      await flushPromises();
    });

    // Agregar foto desde galería
    (launchImageLibrary as jest.Mock).mockResolvedValue({
      didCancel: false,
      assets: [FOTO_ASSET],
    });

    await act(async () => {
      findByLabel(tree, 'Seleccionar foto de la galería').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // Verificar que la foto aparece (botón quitar)
    const quitarBtns = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Quitar foto 1',
    );
    expect(quitarBtns.length).toBeGreaterThanOrEqual(1);

    // Enviar
    await act(async () => {
      findByLabel(tree, 'Enviar Solicitud').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // Verificar: POST de requerimiento y POST de foto
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos',
      expect.objectContaining({fundoId: 1}),
    );
    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/99/fotos',
      expect.any(FormData),
      expect.objectContaining({headers: {'Content-Type': 'multipart/form-data'}}),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('validación: cantidad supera stock bloquea el envío', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/lotes') return Promise.resolve({data: LOTES});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url === '/programaciones/1/stock') return Promise.resolve({data: {stock: 5}});
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<NuevoRequerimientoScreen />);
      await flushPromises();
      await flushPromises();
    });

    await elegirOpcion(tree, 'Especie', 'Opción Especie Chrysopa sp.');

    await act(async () => {
      findByLabel(tree, 'Cantidad').props.onChangeText('20');
    });
    await act(async () => {
      await flushPromises();
    });

    // Mensaje de error de stock
    expect(contarTexto(tree, 'La cantidad supera el stock disponible')).toBe(1);
    expect(findByLabel(tree, 'Enviar Solicitud').props.disabled).toBe(true);
  });
});

/* ================================================================== */
/* Test 2: Flujo editar requerimiento                                   */
/* Sigue patrón exacto de EditarRequerimientoScreen.test.tsx            */
/* ================================================================== */

describe('Flujo requerimiento — editar requerimiento existente', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('flujo completo: carga datos, cambia observaciones y actualiza', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
      if (reqMatch) return Promise.resolve({data: REQUERIMIENTO_DTO});
      if (url.match(/\/requerimientos\/\d+\/fotos$/)) return Promise.resolve({data: FOTOS_DTO});
      if (url.match(/^\/programaciones\/\d+\/stock$/)) return Promise.resolve({data: {stock: 30}});
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });
    api.put.mockResolvedValue({data: REQUERIMIENTO_DTO});

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<EditarRequerimientoScreen />);
    });
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        await flushPromises();
      });
    }

    // ── Verificar: datos pre-cargados ────────────────────────────────
    expect(contarTexto(tree, 'REGISTRADO') + contarTexto(tree, 'Registrado')).toBeGreaterThan(0);

    // ── Paso 1: cambiar observaciones ─────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Observaciones').props.onChangeText('Nueva observación de prueba');
    });

    // ── Paso 2: presionar Actualizar ─────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Actualizar requerimiento').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // ── Verificar: PUT llamado con datos actualizados ─────────────────
    expect(api.put).toHaveBeenCalledWith(
      '/requerimientos/42',
      expect.objectContaining({
        observaciones: 'Nueva observación de prueba',
      }),
    );

    // ── Verificar: navegación de regreso ─────────────────────────────
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('carga fotos existentes del servidor', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
      if (reqMatch) return Promise.resolve({data: REQUERIMIENTO_DTO});
      if (url.match(/\/requerimientos\/\d+\/fotos$/)) return Promise.resolve({data: FOTOS_DTO});
      if (url.match(/^\/programaciones\/\d+\/stock$/)) return Promise.resolve({data: {stock: 30}});
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<EditarRequerimientoScreen />);
    });
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        await flushPromises();
      });
    }

    // Verificar que la foto del servidor se muestra
    const servidorLabels = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Quitar foto del servidor 1',
    );
    expect(servidorLabels.length).toBeGreaterThanOrEqual(1);
  });

  test('elimina foto del servidor al pulsar Quitar', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
      if (reqMatch) return Promise.resolve({data: REQUERIMIENTO_DTO});
      if (url.match(/\/requerimientos\/\d+\/fotos$/)) return Promise.resolve({data: FOTOS_DTO});
      if (url.match(/^\/programaciones\/\d+\/stock$/)) return Promise.resolve({data: {stock: 30}});
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });
    api.delete.mockResolvedValue({data: {}});

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<EditarRequerimientoScreen />);
    });
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        await flushPromises();
      });
    }

    // Presionar "Quitar foto del servidor 1"
    await act(async () => {
      const btns = tree.root.findAll(
        (node: any) => node.props.accessibilityLabel === 'Quitar foto del servidor 1',
      );
      btns[0].props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // Verificar: DELETE llamado
    expect(api.delete).toHaveBeenCalledWith('/requerimientos/42/fotos/10');
  });

  test('muestra alerta de 30 h cuando RECIBIDO superó el tiempo', async () => {
    const reqReciente = {
      ...REQUERIMIENTO_DTO,
      estado: 'RECIBIDO' as const,
      updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    };

    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      const reqMatch = url.match(/^\/requerimientos\/(\d+)$/);
      if (reqMatch) return Promise.resolve({data: reqReciente});
      if (url.match(/\/requerimientos\/\d+\/fotos$/)) return Promise.resolve({data: []});
      if (url.match(/^\/programaciones\/\d+\/stock$/)) return Promise.resolve({data: {stock: 30}});
      if (url === '/fundos') return Promise.resolve({data: FUNDOS});
      if (url === '/especies') return Promise.resolve({data: ESPECIES});
      if (url === '/etapas-fenologicas') return Promise.resolve({data: ETAPAS});
      if (url === '/plagas') return Promise.resolve({data: PLAGAS});
      if (url.match(/\/lotes/)) return Promise.resolve({data: LOTES});
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken' ? {password: TOKEN_USUARIO} : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<EditarRequerimientoScreen />);
    });
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        await flushPromises();
      });
    }

    // Verificar que la alerta de 30 h está visible
    const alertas = tree.root.findAll(
      (node: any) => node.props.accessibilityRole === 'alert',
    );
    expect(alertas.length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/* Test 3: Flujo historial de requerimientos                            */
/* Sigue patrón exacto de HistorialRequerimientoScreen.test.tsx         */
/* ================================================================== */

describe('Flujo requerimiento — historial con detalle', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  test('flujo completo: listado → ver detalle en modal', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/requerimientos') {
        return Promise.resolve({data: [REQUERIMIENTO_DTO]});
      }
      if (typeof url === 'string' && url.match(/\/requerimientos\/\d+\/fotos$/)) {
        return Promise.resolve({data: FOTOS_DTO});
      }
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken'
          ? {password: TOKEN_USUARIO}
          : null,
    );

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

    // ── Verificar: la especie aparece en el listado ──────────────────
    const especieNodes = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Chrysopa sp.',
    );
    expect(especieNodes.length).toBeGreaterThanOrEqual(1);

    // ── Paso 1: abrir modal "Ver" ────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Ver Chrysopa sp.').props.onPress();
    });
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await flushPromises();
      });
    }

    // ── Verificar: modal con detalle visible ─────────────────────────
    const titulo = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Detalle del requerimiento',
    );
    expect(titulo.length).toBeGreaterThanOrEqual(1);

    // ── Verificar: fotos en el modal ─────────────────────────────────
    const fotosTitle = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Evidencia fotográfica',
    );
    expect(fotosTitle.length).toBeGreaterThanOrEqual(1);

    // ── Paso 2: cerrar modal ─────────────────────────────────────────
    await act(async () => {
      findByLabel(tree, 'Cerrar detalle de requerimiento').props.onPress();
    });

    // Modal debería estar cerrado
    const tituloAfter = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Detalle del requerimiento',
    );
    expect(tituloAfter.length).toBe(0);
  });

  test('botón "Ver Detalle" navega a DetalleRequerimiento', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/requerimientos') {
        return Promise.resolve({data: [REQUERIMIENTO_DTO]});
      }
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken'
          ? {password: TOKEN_USUARIO}
          : null,
    );

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

    // Presionar "Ver Detalle"
    await act(async () => {
      findByLabel(tree, 'Detalle de Chrysopa sp.').props.onPress();
    });

    // Verificar: navegación a DetalleRequerimiento con el ID correcto
    expect(mockNavigate).toHaveBeenCalledWith('DetalleRequerimiento', {id: 42});
  });

  test('botón "Editar" navega a EditarRequerimiento', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/requerimientos') {
        return Promise.resolve({data: [REQUERIMIENTO_DTO]});
      }
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken'
          ? {password: TOKEN_USUARIO}
          : null,
    );

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

    // Presionar "Editar"
    await act(async () => {
      findByLabel(tree, 'Editar Chrysopa sp.').props.onPress();
    });

    // Verificar: navegación a EditarRequerimiento con el ID correcto
    expect(mockNavigate).toHaveBeenCalledWith('EditarRequerimiento', {id: 42});
  });

  test('listado vacío muestra estado vacío', async () => {
    const api = getMockApi();
    api.get.mockImplementation((url: string) => {
      if (url === '/requerimientos') {
        return Promise.resolve({data: []});
      }
      return Promise.resolve({data: []});
    });

    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken'
          ? {password: TOKEN_USUARIO}
          : null,
    );

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

    // Verificar: estado vacío
    const emptyTitle = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Sin requerimientos en el rango',
    );
    expect(emptyTitle.length).toBeGreaterThanOrEqual(1);
  });
});
