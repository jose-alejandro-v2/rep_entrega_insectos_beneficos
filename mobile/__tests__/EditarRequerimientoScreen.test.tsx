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
 * V22: campos habilitados, botones cámara/galería, guard ≥1 foto.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {launchImageLibrary} from 'react-native-image-picker';
import EditarRequerimientoScreen from '../src/screens/EditarRequerimientoScreen';
import {clearToken, type EstadoRequerimiento} from '../src/services/ApiClient';
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
    papelConPostura: null as number | null,
    sobreConCascarilla: null as number | null,
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

/** Liberaciones devueltas por API (mutable por test — v1.12.0). */
let liberacionesActuales: Array<{
  id: number;
  loteId: number;
  papelConPostura: number | null;
  sobreConCascarilla: number | null;
  cantidadLiberada: number;
}> = [];

const api = getMockApi();

/** Mock ArrayBuffer for fetchFotoBinaria */
const MOCK_ARRAYBUFFER = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer;

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
    if (url.match(/\/requerimientos\/\d+\/fotos\/\d+\/imagen$/)) {
      return Promise.resolve({data: MOCK_ARRAYBUFFER, headers: {'content-type': 'image/jpeg'}});
    }
    if (url.match(/\/requerimientos\/\d+\/liberaciones$/)) {
      return Promise.resolve({data: liberacionesActuales});
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
  api.post.mockResolvedValue({data: {}});

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

function findTexts(tree: ReactTestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node: any) =>
      typeof node.props.children === 'string' && node.props.children === text,
  );
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

describe('EditarRequerimientoScreen — fotos del servidor (HITO-011/V22)', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('carga y muestra fotos existentes del servidor bajo Foto de Entrega (data URI)', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Verificar que la etiqueta "Foto de Entrega" está presente
    const entregaLabels = findTexts(tree, 'Foto de Entrega');
    expect(entregaLabels.length).toBeGreaterThanOrEqual(1);

    // Verificar que la foto se muestra (data URI, no URL externa)
    const fotoImages = tree.root.findAll(
      (node: any) =>
        node.props.source && typeof node.props.source.uri === 'string' && node.props.source.uri.startsWith('data:'),
    );
    expect(fotoImages.length).toBeGreaterThanOrEqual(1);
  });
});

describe('EditarRequerimientoScreen — modo liberación ENTREGADO (V22)', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
  });

  test('muestra campos habilitados y botones cámara/galería en modo ENTREGADO', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      estado: 'ENTREGADO',
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Título = "Liberar Requerimiento"
    const headerTitles = findTexts(tree, 'Liberar Requerimiento');
    expect(headerTitles.length).toBeGreaterThanOrEqual(1);

    // Subtítulos de sección presentes
    expect(findTexts(tree, 'Liberar lote').length).toBeGreaterThanOrEqual(1);
    expect(findTexts(tree, 'Presentaciones entregadas').length).toBeGreaterThanOrEqual(1);
    expect(findTexts(tree, 'Plaga objetivo').length).toBeGreaterThanOrEqual(1);

    // Botones cámara y galería presentes
    const camaraBtn = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Tomar foto de liberación',
    );
    expect(camaraBtn.length).toBeGreaterThanOrEqual(1);

    const galeriaBtn = tree.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'Seleccionar foto de liberación',
    );
    expect(galeriaBtn.length).toBeGreaterThanOrEqual(1);

    // Botón Guardar deshabilitado (no hay fotos)
    const guardarBtn = tree.root.findAll(
      (node: any) =>
        node.props.accessibilityLabel === 'Guardar liberación' && node.props.disabled === true,
    );
    expect(guardarBtn.length).toBeGreaterThanOrEqual(1);
  });

  test('muestra sección Foto de Liberación con placeholder', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      estado: 'ENTREGADO',
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Título "Foto de Liberación"
    expect(findTexts(tree, 'Foto de Liberación').length).toBeGreaterThanOrEqual(1);

    // Placeholder "Sin foto de liberación" (sin fotos capturadas)
    expect(findTexts(tree, 'Sin foto de liberación').length).toBeGreaterThanOrEqual(1);
  });

  test('muestra formulario de liberación cuando estado es LIBERADO (sin candado)', async () => {
    requerimientoActual = requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      estado: 'LIBERADO',
    });
    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Título = "Liberar Requerimiento" (no "Detalle Requerimiento")
    const headerTitles = findTexts(tree, 'Liberar Requerimiento');
    expect(headerTitles.length).toBeGreaterThanOrEqual(1);

    // Subtítulos de sección presentes (formulario visible, no oculto)
    expect(findTexts(tree, 'Liberar lote').length).toBeGreaterThanOrEqual(1);
    expect(findTexts(tree, 'Plaga objetivo').length).toBeGreaterThanOrEqual(1);

    // Plagas del requerimiento aparecen seleccionadas (chips del multi-select)
    const plagaChips = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' && node.props.children === 'Pulga',
    );
    expect(plagaChips.length).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/* v1.12.0 — pendiente por liberar (liberación parcial acumulada)      */
/* ------------------------------------------------------------------ */

/** Liberación del lote A: 60 papel + 20 sobre (cantidadLiberada = 80). */
const LIBERACION_LOTE_A = {
  id: 1,
  loteId: 10,
  papelConPostura: 60,
  sobreConCascarilla: 20,
  cantidadLiberada: 80,
};

/** Requerimiento de 140 millares con 2 lotes (papel 100 + sobre 40). */
function requerimientoDosLotes() {
  return {
    ...requerimientoBase({
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    }),
    cantidad: 140,
    lotes: [
      {id: 10, nombre: 'Lote A'},
      {id: 11, nombre: 'Lote B'},
    ],
    papelConPostura: 100 as number | null,
    sobreConCascarilla: 40 as number | null,
  };
}

/** Deja disponible la galería para agregar una foto de liberación. */
async function agregarFotoLiberacion(tree: ReactTestRenderer.ReactTestRenderer) {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    didCancel: false,
    assets: [
      {
        uri: 'file:///liberacion.jpg',
        type: 'image/jpeg',
        fileName: 'liberacion.jpg',
        fileSize: 1024,
      },
    ],
  });
  await act(async () => {
    findByLabel(tree, 'Seleccionar foto de liberación').props.onPress();
  });
  await act(async () => {
    await flushPromises();
  });
}

describe('EditarRequerimientoScreen — pendiente por liberar (v1.12.0)', () => {
  beforeEach(async () => {
    await clearToken();
    mockGoBack.mockClear();
    liberacionesActuales = [];
    (launchImageLibrary as jest.Mock).mockReset();
    (launchImageLibrary as jest.Mock).mockResolvedValue({didCancel: true});
  });

  test('muestra el pendiente (140 − 80 = 60) y el restante por presentación', async () => {
    requerimientoActual = requerimientoDosLotes();
    liberacionesActuales = [LIBERACION_LOTE_A];

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    // Cantidad = pendiente (no el total pedido de 140).
    expect(findByLabel(tree, 'Cantidad').props.value).toBe('60');
    // Defaults = restante por presentación (papel 100−60, sobre 40−20).
    expect(findByLabel(tree, 'Papel con postura').props.value).toBe('40');
    expect(findByLabel(tree, 'Sobre con cascarilla').props.value).toBe('20');
    // El lote ya liberado no vuelve a ofrecerse ("Por Liberar 1 de 2").
    expect(contarTexto(tree, 'Lote B')).toBeGreaterThanOrEqual(1);
  });

  test('sin liberaciones: cantidad = total pedido y defaults del requerimiento', async () => {
    requerimientoActual = requerimientoDosLotes();
    liberacionesActuales = [];

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Cantidad').props.value).toBe('140');
    expect(findByLabel(tree, 'Papel con postura').props.value).toBe('100');
    expect(findByLabel(tree, 'Sobre con cascarilla').props.value).toBe('40');
  });

  test('guarda cantidadLiberada = papel + sobre de esa liberación (40 + 20 = 60)', async () => {
    requerimientoActual = requerimientoDosLotes();
    liberacionesActuales = [LIBERACION_LOTE_A];

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });
    await agregarFotoLiberacion(tree);

    // Los defaults (40/20 = 60) caben en el pendiente 60 → habilitado.
    expect(findByLabel(tree, 'Guardar liberación').props.disabled).toBe(false);

    await act(async () => {
      findByLabel(tree, 'Guardar liberación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/requerimientos/4/liberaciones',
      expect.objectContaining({
        loteId: 11,
        cantidadLiberada: 60,
        papelConPostura: 40,
        sobreConCascarilla: 20,
      }),
    );
  });

  test('bloquea Guardar y avisa cuando papel + sobre supera el pendiente', async () => {
    requerimientoActual = requerimientoDosLotes();
    liberacionesActuales = [LIBERACION_LOTE_A];

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });
    await agregarFotoLiberacion(tree);

    // 100 + 20 = 120 > 60 (pendiente) → bloqueado con mensaje.
    await act(async () => {
      findByLabel(tree, 'Papel con postura').props.onChangeText('100');
    });

    expect(findByLabel(tree, 'Guardar liberación').props.disabled).toBe(true);
    expect(
      contarTexto(tree, 'La suma de papel + sobre supera la cantidad por liberar'),
    ).toBeGreaterThanOrEqual(1);
  });

  test('pendiente 0: sin cantidad por liberar y Guardar bloqueado', async () => {
    requerimientoActual = requerimientoDosLotes();
    liberacionesActuales = [
      LIBERACION_LOTE_A,
      {
        id: 2,
        loteId: 11,
        papelConPostura: 40,
        sobreConCascarilla: 20,
        cantidadLiberada: 60,
      },
    ];

    const tree = await renderEdicion();
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Cantidad').props.value).toBe('0');
    expect(findByLabel(tree, 'Papel con postura').props.value).toBe('');
    expect(findByLabel(tree, 'Guardar liberación').props.disabled).toBe(true);
    expect(
      contarTexto(tree, 'Ingresa papel con postura o sobre con cascarilla de arroz'),
    ).toBeGreaterThanOrEqual(1);
  });
});
