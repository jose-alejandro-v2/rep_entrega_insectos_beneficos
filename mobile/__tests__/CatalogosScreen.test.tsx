/**
 * CatalogosScreen — Catálogos (HITO-003 + v1.15.0 + v1.16.0):
 *  - Tab "Usuarios" (solo Super Admin/Admin): listado (SÓLO Admin/Usuario;
 *    Super Admin es inamovible y no aparece) con filtros de estado + búsqueda
 *    local, crear usuario (solo Usuario + Perfil; nombre = usuario) y editar
 *    (Nombre editable + DNI solo lectura), Eliminar (solo si puedeEliminar)
 *    y reactivar (soft delete / PUT ACTIVO) con ConfirmDialog.
 *  - Tab "Perfiles" (informativo, visible para todos): tarjetas estáticas de
 *    los 3 perfiles según la spec §6 — NO editables.
 *  - Tabs CRUD de catálogos simples (Especies/Nematodos/Plagas/Patrones,
 *    v1.15.0): alta/edición con POST/PUT, Eliminar con DELETE + confirm
 *    (solo si puedeEliminar), filtros y búsqueda locales — CatalogoCrudTab.
 *  - Tabs SOLO LECTURA Fundos/Variedades/Lotes (v1.16.0, Q4): visibles para
 *    todos los roles; admin ve 9 tabs, no-admin 4 (Perfiles + estos 3).
 *    Sin botón "Agregar"; Lotes con buscador local y GET /lotes sin params.
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
    if (url === '/fundos') {
      return Promise.resolve({
        data: [{id: 1, nombre: 'Fundo Demo', createdAt: '', updatedAt: ''}],
      });
    }
    if (url === '/variedades') {
      return Promise.resolve({
        data: [
          {
            id: 1,
            nombre: 'Red Globe',
            color: '#B71C1C',
            createdAt: '',
            updatedAt: '',
          },
        ],
      });
    }
    if (url === '/lotes') {
      return Promise.resolve({
        data: [
          {
            id: 1,
            fundoId: 1,
            fundo: 'Fundo Demo',
            variedadId: 1,
            variedad: 'Red Globe',
            variedadColor: '#B71C1C',
            nombre: 'Lote A',
            area: 12.5,
            createdAt: '',
            updatedAt: '',
          },
        ],
      });
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

  test('elimina con ConfirmDialog → DELETE /usuarios/{id} (soft delete)', async () => {
    mockListados();
    api.delete.mockResolvedValue({data: {mensaje: 'ok'}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'Eliminar usuario')).toBe(0);
    await act(async () => {
      findByLabel(tree, 'Eliminar jose.sanidad').props.onPress();
    });

    expect(contarTexto(tree, 'Eliminar usuario')).toBe(1);
    expect(
      contarTexto(
        tree,
        '¿Deseas eliminar el usuario "jose.sanidad"? El usuario pasará a Inactivo y no podrá acceder al sistema.',
      ),
    ).toBe(1);

    await act(async () => {
      findByLabel(tree, 'Confirmar eliminación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.delete).toHaveBeenCalledWith('/usuarios/2');
    expect(
      contarTexto(
        tree,
        'Usuario "jose.sanidad" eliminado correctamente',
      ),
    ).toBe(1);
  });

  test('usuario con puedeEliminar=false no muestra el botón Eliminar (Q3 hide)', async () => {
    mockListados();
    // Simula backend: jose.sanidad tiene registros asociados → flag false.
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      if (url === '/usuarios') {
        return Promise.resolve({
          data: USUARIOS_JWT.map(u =>
            u.usuario === 'jose.sanidad' ? {...u, puedeEliminar: false} : u,
          ),
        });
      }
      return Promise.resolve({data: []});
    });
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    expect(() => findByLabel(tree, 'Eliminar jose.sanidad')).toThrow();
    // El de ana.admin (INACTIVO) tampoco muestra Eliminar (solo Reactivar).
    expect(() => findByLabel(tree, 'Eliminar ana.admin')).toThrow();
    expect(findByLabel(tree, 'Reactivar ana.admin')).toBeTruthy();
    // Editar sigue disponible.
    expect(findByLabel(tree, 'Editar jose.sanidad')).toBeTruthy();
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

  test('usuario común ve 4 tabs (Perfiles/Fundos/Variedades/Lotes) sin tab Usuarios', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_USUARIO);

    // Q4 v1.16.0: no-admin ve tabs de solo lectura.
    expect(findByLabel(tree, 'Tab Perfiles')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Fundos')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Variedades')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Lotes')).toBeTruthy();
    // Sin tab Usuarios ni CRUDs para rol operativo.
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

describe('CatalogosScreen — tabs de catálogos CRUD (v1.15.0)', () => {
  beforeEach(async () => {
    await clearToken();
    api.get.mockClear();
    api.post.mockClear();
    api.put.mockClear();
    api.delete.mockClear();
  });

  test('admin ve los 9 tabs (Usuarios, Perfiles, 4 catálogos y lectura)', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    expect(findByLabel(tree, 'Tab Usuarios')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Perfiles')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Especies')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Nematodos')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Plagas')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Patrones')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Fundos')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Variedades')).toBeTruthy();
    expect(findByLabel(tree, 'Tab Lotes')).toBeTruthy();
  });

  test('cambia al tab Especies: lista vía GET /especies y ofrece Agregar', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Especies').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/especies');
    expect(findByLabel(tree, 'Agregar especie')).toBeTruthy();
    expect(contarTexto(tree, 'No hay especies')).toBe(1);
    expect(findByLabel(tree, 'Filtrar Activos')).toBeTruthy();
    expect(findByLabel(tree, 'Buscar especie')).toBeTruthy();
  });

  test('crea una especie con POST /especies y muestra confirmación', async () => {
    mockListados();
    api.post.mockResolvedValue({data: {id: 1, nombre: 'Trichogramma', estado: 'ACTIVO'}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Especies').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Agregar especie').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Campo nombre').props.onChangeText('Trichogramma');
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Guardar especie').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.post).toHaveBeenCalledWith('/especies', {
      nombre: 'Trichogramma',
    });
    expect(
      contarTexto(tree, 'Se agregó "Trichogramma" correctamente'),
    ).toBe(1);
  });

  test('edita una especie con PUT /especies/{id} (solo nombre)', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      if (url === '/usuarios') {
        return Promise.resolve({data: USUARIOS_JWT});
      }
      if (url === '/especies') {
        return Promise.resolve({
          data: [{id: 7, nombre: 'Trichogramma', estado: 'ACTIVO'}],
        });
      }
      return Promise.resolve({data: []});
    });
    api.put.mockResolvedValue({data: {id: 7, nombre: 'Trichogramma m!', estado: 'ACTIVO'}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Especies').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'Trichogramma')).toBeGreaterThan(0);

    await act(async () => {
      findByLabel(tree, 'Editar Trichogramma').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Campo nombre').props.onChangeText('Trichogramma m!');
    });
    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Guardar especie').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.put).toHaveBeenCalledWith('/especies/7', {
      nombre: 'Trichogramma m!',
    });
    expect(
      contarTexto(tree, 'Se actualizó "Trichogramma m!" correctamente'),
    ).toBe(1);
  });

  test('elimina con ConfirmDialog → DELETE /especies/{id} (soft delete)', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      if (url === '/usuarios') {
        return Promise.resolve({data: USUARIOS_JWT});
      }
      if (url === '/especies') {
        return Promise.resolve({
          data: [{id: 7, nombre: 'Trichogramma', estado: 'ACTIVO'}],
        });
      }
      return Promise.resolve({data: []});
    });
    api.delete.mockResolvedValue({data: {mensaje: 'ok'}});
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Especies').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(contarTexto(tree, 'Eliminar especie')).toBe(0);
    await act(async () => {
      findByLabel(tree, 'Eliminar Trichogramma').props.onPress();
    });

    expect(contarTexto(tree, 'Eliminar especie')).toBe(1);
    expect(
      contarTexto(
        tree,
        '¿Deseas eliminar "Trichogramma"? El registro pasará a Inactivo y dejará de estar disponible para nuevos requerimientos.',
      ),
    ).toBe(1);

    await act(async () => {
      findByLabel(tree, 'Confirmar eliminación').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.delete).toHaveBeenCalledWith('/especies/7');
    expect(contarTexto(tree, '"Trichogramma" pasó a Inactivo')).toBe(1);
  });

  test('especie con puedeEliminar=false oculta el botón Eliminar (Q3 hide)', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      if (url === '/usuarios') {
        return Promise.resolve({data: USUARIOS_JWT});
      }
      if (url === '/especies') {
        return Promise.resolve({
          data: [
            {
              id: 7,
              nombre: 'Trichogramma',
              estado: 'ACTIVO',
              puedeEliminar: false,
            },
          ],
        });
      }
      return Promise.resolve({data: []});
    });
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Especies').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(() => findByLabel(tree, 'Eliminar Trichogramma')).toThrow();
    expect(findByLabel(tree, 'Editar Trichogramma')).toBeTruthy();
  });

  test('usuario común no ve los tabs de catálogos CRUD', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_USUARIO);

    expect(() => findByLabel(tree, 'Tab Especies')).toThrow();
    expect(() => findByLabel(tree, 'Tab Nematodos')).toThrow();
    expect(() => findByLabel(tree, 'Tab Plagas')).toThrow();
    expect(() => findByLabel(tree, 'Tab Patrones')).toThrow();
    expect(() => findByLabel(tree, 'Agregar especie')).toThrow();
  });
});

describe('CatalogosScreen — tabs lectura Fundos/Variedades/Lotes (v1.16.0, Q4)', () => {
  beforeEach(async () => {
    await clearToken();
    api.get.mockClear();
    api.post.mockClear();
    api.put.mockClear();
    api.delete.mockClear();
  });

  test('tab Fundos lista GET /fundos sin botón Agregar (solo lectura)', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Fundos').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/fundos');
    expect(contarTexto(tree, 'Fundo Demo')).toBeGreaterThan(0);
    expect(() => findByLabel(tree, 'Agregar fundo')).toThrow();
    expect(() => findByLabel(tree, 'Nuevo fundo')).toThrow();
  });

  test('tab Variedades lista GET /variedades con color', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Variedades').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/variedades');
    expect(contarTexto(tree, 'Red Globe')).toBeGreaterThan(0);
    expect(contarTexto(tree, '#B71C1C')).toBeGreaterThan(0);
    expect(() => findByLabel(tree, 'Agregar variedad')).toThrow();
  });

  test('tab Lotes lista GET /lotes SIN params y busca localmente', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_SUPER);
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Tab Lotes').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    // listarLotes() sin fundoId → GET /lotes sin params (v1.16.0).
    expect(api.get).toHaveBeenCalledWith('/lotes', undefined);
    expect(contarTexto(tree, 'Lote A')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'Fundo: Fundo Demo')).toBeGreaterThan(0);
    expect(() => findByLabel(tree, 'Agregar lote')).toThrow();

    // Buscador local (157 lotes en prod; aquí filtra la fila demo).
    const buscador = findByLabel(tree, 'Buscar lote');
    await act(async () => {
      buscador.props.onChangeText('no-existe');
    });
    expect(contarTexto(tree, 'Sin resultados')).toBe(1);
  });

  test('usuario común también ve Fundos/Variedades/Lotes en modo lectura', async () => {
    mockListados();
    const tree = await renderCatalogo(TOKEN_USUARIO);

    await act(async () => {
      findByLabel(tree, 'Tab Fundos').props.onPress();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/fundos');
    expect(contarTexto(tree, 'Fundo Demo')).toBeGreaterThan(0);
    expect(() => findByLabel(tree, 'Agregar fundo')).toThrow();
    expect(() => findByLabel(tree, 'Nuevo usuario')).toThrow();
  });
});