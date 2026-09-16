/**
 * CatalogosScreen — Catálogos (HITO-003):
 *  - Tab "Usuarios" (solo Super Admin/Admin): listado (SÓLO Admin/Usuario;
 *    Super Admin es inamovible y no aparece) con filtros de estado + búsqueda
 *    local, crear usuario (solo Usuario + Perfil; nombre = usuario) y editar
 *    (Nombre editable + DNI solo lectura), desactivar y reactivar (soft
 *    delete / PUT ACTIVO) con ConfirmDialog.
 *  - Tab "Perfiles" (informativo, visible para todos): tarjetas estáticas de
 *    los 3 perfiles según la spec §6 — NO editables.
 *
 * Approach (igual que PerfilScreen/HomeScreen.test.tsx): react-test-renderer +
 * AuthProvider + mock de Keychain (JWT fabricado con makeToken) + mock axios
 * (getMockApi) para listarUsuarios/fetchRoles (GET), crear/actualizar/desactivar
 * (POST/PUT/DELETE).
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {AuthProvider} from '../src/context/AuthContext';
import CatalogosScreen from '../src/screens/CatalogosScreen';
import {clearToken} from '../src/services/ApiClient';
import {
  contarTexto,
  findByLabel,
  flushPromises,
  getMockApi,
  makeToken,
} from '../test-utils/helpers';

// BottomNavigation usa useNavigation: se mockea como en los otros tests.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({navigate: jest.fn()})),
  };
});

const ROLES = [
  {id: 1, nombre: 'Super Admin', estado: 'ACTIVO'},
  {id: 2, nombre: 'Admin', estado: 'ACTIVO'},
  {id: 3, nombre: 'Usuario', estado: 'ACTIVO'},
];

const USUARIOS_JWT = [
  {
    id: 1,
    usuario: 'Admin PowerApps',
    nombre: 'Admin PowerApps',
    rolId: 1,
    rol: 'Super Admin',
    estado: 'ACTIVO',
    debeCambiarPassword: true,
    dni: null,
    creadoPor: null,
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    lastLoginAt: null,
  },
  {
    id: 2,
    usuario: 'jose.sanidad',
    nombre: 'José Sanidad',
    rolId: 3,
    rol: 'Usuario',
    estado: 'ACTIVO',
    debeCambiarPassword: false,
    dni: '12345678',
    email: 'jose.sanidad@vanguardfresh.pe',
    creadoPor: 1,
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    lastLoginAt: '2026-08-20T15:20:00Z',
  },
  {
    id: 3,
    usuario: 'ana.admin',
    nombre: 'Ana Admin',
    rolId: 2,
    rol: 'Admin',
    estado: 'INACTIVO',
    debeCambiarPassword: false,
    dni: '87654321',
    email: null,
    creadoPor: 1,
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-20T09:00:00Z',
    lastLoginAt: null,
  },
];

const TOKEN_SUPER = makeToken({
  sub: '9',
  groups: ['Super Admin'],
  rolId: 1,
  nombre: 'Admin Prueba',
  dni: '00000000',
  passwordResetRequired: false,
});

const TOKEN_USUARIO = makeToken({
  sub: '9',
  groups: ['Usuario'],
  rolId: 3,
  nombre: 'Persona Test',
  dni: '12345678',
  passwordResetRequired: false,
});

let api = getMockApi();

async function renderCatalogo(token: string) {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken' ? {password: token} : null,
  );

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider>
        <CatalogosScreen />
      </AuthProvider>,
    );
    await flushPromises();
    await flushPromises();
  });
  return tree;
}

function mockListados() {
  api.get.mockImplementation((url: string) => {
    if (url === '/auth/roles') {
      return Promise.resolve({data: ROLES});
    }
    if (url === '/usuarios') {
      return Promise.resolve({data: USUARIOS_JWT});
    }
    return Promise.resolve({data: []});
  });
}

describe('CatalogosScreen — tab Usuarios (Super Admin)', () => {
  beforeEach(async () => {
    await clearToken();
    api.get.mockClear();
    api.post.mockClear();
    api.put.mockClear();
    api.delete.mockClear();
  });

  test('muestra tabs Usuarios/Perfiles y lista usuarios con filtros', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Tab Usuarios')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Perfiles')).toBeTruthy();

    // Listado (default tab Usuarios) con nombre, login, perfil y estado.
    expect(contarTexto(tree, 'José Sanidad')).toBeGreaterThan(0);
    expect(contarTexto(tree, '@jose.sanidad')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Ana Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Activo')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Inactivo')).toBeGreaterThan(0);

    // Política SA inamovible: el Super Admin (id=1) NO aparece en el listado.
    expect(contarTexto(tree, 'Admin PowerApps')).toBe(0);

    // Filtros de estado + búsqueda.
    expect(findByLabel(tree, 'Filtrar Todos')).toBeTruthy();
    expect(findByLabel(tree, 'Filtrar Activos')).toBeTruthy();
    expect(findByLabel(tree, 'Filtrar Inactivos')).toBeTruthy();
    expect(findByLabel(tree, 'Buscar usuario')).toBeTruthy();
    expect(findByLabel(tree, 'Nuevo usuario')).toBeTruthy();
  });

  test('filtro por estado Activos reduce el listado', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Filtrar Activos').props.onPress();
    });

    expect(contarTexto(tree, 'José Sanidad')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Ana Admin')).toBe(0);
  });

  test('búsqueda local por nombre filtra el listado', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    const buscador = findByLabel(tree, 'Buscar usuario');
    await act(async () => {
      buscador.props.onChangeText('ana');
    });

    expect(contarTexto(tree, 'Ana Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'José Sanidad')).toBe(0);
  });

  test('abre el modal de Nuevo usuario (solo Usuario + Perfil, sin DNI, sin Super Admin)', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Nuevo usuario').props.onPress();
    });

    expect(contarTexto(tree, 'Nuevo usuario')).toBeGreaterThan(0);
    expect(findByLabel(tree, 'Campo usuario')).toBeTruthy();
    // HITO-018: el modal pide correo (opcional) en creación y edición.
    expect(findByLabel(tree, 'Campo correo electrónico')).toBeTruthy();
    // Creación: NO se pide Nombre ni DNI.
    expect(() => findByLabel(tree, 'Campo nombre')).toThrow();
    expect(() => findByLabel(tree, 'Campo DNI')).toThrow();
    expect(
      contarTexto(
        tree,
        'La contraseña inicial es 00000000; el usuario deberá cambiarla en su primer acceso.',
      ),
    ).toBe(1);
    // Política SA inamovible: el selector NUNCA muestra Super Admin.
    expect(() => findByLabel(tree, 'Perfil Super Admin')).toThrow();
    expect(findByLabel(tree, 'Perfil Admin')).toBeTruthy();
    expect(findByLabel(tree, 'Perfil Usuario')).toBeTruthy();
  });

  test('crea un usuario con POST /usuarios (nombre = usuario, sin DNI) y muestra confirmación', async () => {
    mockListados();
    api.post.mockResolvedValue({data: {id: 4}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Nuevo usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Campo usuario').props.onChangeText('luis.campo');
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Perfil Usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Guardar usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith('/usuarios', {
      usuario: 'luis.campo',
      nombre: 'luis.campo',
      rolId: 3,
    });
    expect(
      contarTexto(
        tree,
        'Usuario creado correctamente. Deberá iniciar con la contraseña por defecto 00000000 y cambiarla en su primer acceso.',
      ),
    ).toBe(1);
  });

  test('crea un usuario con correo electrónico (POST /usuarios con email)', async () => {
    mockListados();
    api.post.mockResolvedValue({data: {id: 5}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Nuevo usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Campo usuario').props.onChangeText('maria.campo');
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Campo correo electrónico').props.onChangeText(
        'maria.campo@vanguardfresh.pe',
      );
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Perfil Usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Guardar usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith('/usuarios', {
      usuario: 'maria.campo',
      nombre: 'maria.campo',
      rolId: 3,
      email: 'maria.campo@vanguardfresh.pe',
    });
  });

  test('edita un usuario con PUT /usuarios/{id} (DNI solo lectura, rol actual preservado)', async () => {
    mockListados();
    api.put.mockResolvedValue({data: {}});
    const tree = await renderCatalogo(TOKEN_SUPER);

    await act(async () => {
      findByLabel(tree, 'Editar jose.sanidad').props.onPress();
    });

    expect(contarTexto(tree, 'Editar usuario')).toBe(1);

    const dni = findByLabel(tree, 'Campo DNI');
    expect(dni.props.editable).toBe(false);
    expect(dni.props.value).toBe('12345678');

    await act(async () => {
      findByLabel(tree, 'Campo nombre').props.onChangeText('José Sanidad 2');
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Guardar usuario').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.put).toHaveBeenCalledWith('/usuarios/2', {
      usuario: 'jose.sanidad',
      nombre: 'José Sanidad 2',
      rolId: 3,
      estado: 'ACTIVO',
      email: 'jose.sanidad@vanguardfresh.pe',
    });
  });

  test('desactiva con ConfirmDialog → DELETE /usuarios/{id} (soft delete)', async () => {
    mockListados();
    api.delete.mockResolvedValue({data: {mensaje: 'ok'}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'Desactivar usuario')).toBe(0);
    await act(async () => {
      findByLabel(tree, 'Desactivar jose.sanidad').props.onPress();
    });

    expect(contarTexto(tree, 'Desactivar usuario')).toBe(1);
    expect(
      contarTexto(
        tree,
        '¿Deseas desactivar el usuario "jose.sanidad"? Los usuarios desactivados no podrán acceder al sistema.',
      ),
    ).toBe(1);

    await act(async () => {
      findByLabel(tree, 'Confirmar desactivación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.delete).toHaveBeenCalledWith('/usuarios/2');
    expect(
      contarTexto(
        tree,
        'Usuario "jose.sanidad" desactivado correctamente',
      ),
    ).toBe(1);
  });

  test('reactiva un usuario inactivo con PUT estado ACTIVO', async () => {
    mockListados();
    api.put.mockResolvedValue({data: {}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Reactivar ana.admin').props.onPress();
    });
    expect(
      contarTexto(tree, '¿Deseas reactivar el usuario "ana.admin"?'),
    ).toBe(1);

    await act(async () => {
      findByLabel(tree, 'Confirmar reactivación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.put).toHaveBeenCalledWith('/usuarios/3', {
      usuario: 'ana.admin',
      nombre: 'Ana Admin',
      rolId: 2,
      estado: 'ACTIVO',
      email: null,
    });
    expect(
      contarTexto(tree, 'Usuario "ana.admin" reactivado correctamente'),
    ).toBe(1);
  });

  test('sin resultados tras el filtro muestra EmptyState', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Buscar usuario').props.onChangeText('zzz-no-existe');
    });

    expect(contarTexto(tree, 'Sin resultados')).toBe(1);
  });
});

describe('CatalogosScreen — tab Perfiles (informativo)', () => {
  beforeEach(async () => {
    await clearToken();
    api.get.mockClear();
    api.post.mockClear();
    api.put.mockClear();
    api.delete.mockClear();
  });

  test('usuario común ve solo Perfiles (sin tab Usuarios) con las tarjetas de la spec', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_USUARIO);

    // Sin tab Usuarios para rol operativo: la pestaña de gestión no existe.
    expect(() => findByLabel(tree, 'Tab Usuarios')).toThrow();
    expect(() => findByLabel(tree, 'Nuevo usuario')).toThrow();

    expect(contarTexto(tree, 'Super Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Usuario')).toBeGreaterThan(0);
    expect(
      contarTexto(
        tree,
        'Control total: gestión de todos los usuarios, módulos y configuración.',
      ),
    ).toBe(1);
    expect(
      contarTexto(
        tree,
        'Acceso operativo para registro de requerimientos, validación de recepción, liberación en campo y captura de evidencias fotográficas.',
      ),
    ).toBe(1);
  });

  test('Super Admin cambia al tab Perfiles y ve las tarjetas informativas', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Perfiles').props.onPress();
    });

    expect(contarTexto(tree, 'Super Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Admin')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Usuario')).toBeGreaterThan(0);

    // Sin acciones de edición en la pestaña informativa.
    expect(() => findByLabel(tree, 'Nuevo usuario')).toThrow();
  });
});