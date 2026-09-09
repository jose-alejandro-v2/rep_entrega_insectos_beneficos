/**
 * Flujo completo de Login (e2e flow test).
 *
 * Simula la cadena: ServerCheck → URL → probe → LoginScreen →
 * selección de rol → selección de usuario → DNI → autenticación.
 *
 * Approach: react-test-renderer + mocks globales de jest.setup.js (axios,
 * keychain) + mock de @react-navigation/native. Cada test cubre un tramo
 * completo del flujo de usuario.
 *
 * Nota: no se encadena ServerCheck → Login en un solo árbol (sería frágil);
 * en su lugar se testea cada screen como tramo independiente del flujo
 * completo verificando las llamadas de navegación/API correctas.
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import ServerCheckScreen from '../../src/screens/ServerCheckScreen';
import LoginScreen from '../../src/screens/LoginScreen';
import HomeScreen from '../../src/screens/HomeScreen';
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
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      replace: mockReplace,
    })),
  };
});

/* ------------------------------------------------------------------ */
/* Datos de prueba                                                     */
/* ------------------------------------------------------------------ */

const ROLES = [
  {id: 1, nombre: 'Super Admin', estado: true},
  {id: 2, nombre: 'Admin', estado: true},
  {id: 3, nombre: 'Usuario', estado: true},
];

const USUARIOS_ADMIN = [
  {
    id: 5,
    usuario: 'jperez',
    nombre: 'Juan Perez',
    rolId: 2,
    passwordResetRequired: true,
  },
];

const USUARIOS_USUARIO = [
  {
    id: 7,
    usuario: 'ssonidad',
    nombre: 'Sonia Sanidad',
    rolId: 3,
    passwordResetRequired: false,
  },
];

const PAYLOAD_ADMIN = {
  sub: '5',
  groups: ['Admin'],
  rolId: 2,
  nombre: 'Juan Perez',
  dni: '12345678',
  passwordResetRequired: false,
};

const PAYLOAD_USUARIO = {
  sub: '7',
  groups: ['Usuario'],
  rolId: 3,
  nombre: 'Sonia Sanidad',
  dni: '87654321',
  passwordResetRequired: false,
};

const TOKEN_ADMIN = makeToken(PAYLOAD_ADMIN);
const TOKEN_USUARIO = makeToken(PAYLOAD_USUARIO);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function setupLoginApi() {
  const api = getMockApi();
  api.get.mockImplementation((url: string) => {
    if (url === '/auth/roles') {
      return Promise.resolve({data: ROLES});
    }
    if (url === '/auth/usuarios-by-rol/2') {
      return Promise.resolve({data: USUARIOS_ADMIN});
    }
    if (url === '/auth/usuarios-by-rol/3') {
      return Promise.resolve({data: USUARIOS_USUARIO});
    }
    return Promise.resolve({data: []});
  });
  api.post.mockImplementation((url: string) => {
    if (url === '/auth/local-login') {
      const isPasswordReset = false; // simplified
      return Promise.resolve({
        data: {token: TOKEN_ADMIN, passwordResetRequired: isPasswordReset},
      });
    }
    return Promise.resolve({data: {}});
  });
  return api;
}

/* ================================================================== */
/* Test 1: Flujo completo ServerCheck → URL → probe exitoso            */
/* ================================================================== */

describe('Flujo login — ServerCheck probe exitoso', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReplace.mockClear();
    setupLoginApi();
  });

  test('ServerCheck: probe exitoso muestra estado checking y llama replace con Login', async () => {
    await act(async () => {
      ReactTestRenderer.create(
        <NavigationContainer>
          <ServerCheckScreen />
        </NavigationContainer>,
      );
      await flushPromises();
      await flushPromises();
    });

    // El probe fue exitoso → se llamó navigation.replace('Login')
    expect(mockReplace).toHaveBeenCalledWith('Login');
  });

  test('ServerCheck: probe fallido muestra error y formulario de URL', async () => {
    const api = getMockApi();
    api.get.mockRejectedValue({message: 'Network Error'});

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <ServerCheckScreen />
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Muestra el estado de error con formulario
    expect(mockReplace).not.toHaveBeenCalled();
    const retryBtn = findByLabel(tree, 'Reintentar verificación del servidor');
    expect(retryBtn).toBeTruthy();
  });

  test('ServerCheck: Reintentar tras error re-ejecuta el probe', async () => {
    const api = getMockApi();
    // Primer probe falla
    api.get.mockRejectedValue({message: 'Network Error'});

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <ServerCheckScreen />
        </NavigationContainer>,
      );
      await flushPromises();
    });

    expect(mockReplace).not.toHaveBeenCalled();

    // Segundo probe tiene éxito
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      return Promise.resolve({data: []});
    });

    await act(async () => {
      findByLabel(tree, 'Reintentar verificación del servidor').props.onPress();
      await flushPromises();
    });

    expect(mockReplace).toHaveBeenCalledWith('Login');
  });

  test('ServerCheck: usuario digita URL y presiona Guardar y probar', async () => {
    const api = getMockApi();
    // Primer probe falla (muestra formulario)
    api.get.mockRejectedValue({message: 'Network Error'});

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <ServerCheckScreen />
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Digita una URL
    await act(async () => {
      findByLabel(tree, 'URL de la API').props.onChangeText('10.13.18.93');
    });

    // El probe ahora tiene éxito
    api.get.mockImplementation((url: string) => {
      if (url === '/auth/roles') {
        return Promise.resolve({data: ROLES});
      }
      return Promise.resolve({data: []});
    });

    await act(async () => {
      findByLabel(tree, 'Guardar y probar servidor').props.onPress();
      await flushPromises();
    });

    expect(mockReplace).toHaveBeenCalledWith('Login');
  });
});

/* ================================================================== */
/* Test 2: Flujo completo Login — 3 pasos (rol → usuario → password)   */
/* ================================================================== */

describe('Flujo login — LoginScreen 3 pasos', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    setupLoginApi();
  });

  test('flujo completo: Admin → Juan Perez → DNI → login exitoso', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    const api = getMockApi();

    // ── Paso 1: roles cargados ────────────────────────────────────────
    expect(api.get).toHaveBeenCalledWith('/auth/roles');
    expect(findByLabel(tree, 'Perfil Admin')).toBeTruthy();
    expect(findByLabel(tree, 'Perfil Usuario')).toBeTruthy();
    expect(findByLabel(tree, 'Perfil Super Admin')).toBeTruthy();

    // ── Paso 2: seleccionar rol Admin → carga usuarios ────────────────
    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });

    expect(api.get).toHaveBeenCalledWith('/auth/usuarios-by-rol/2');
    expect(findByLabel(tree, 'Usuario Juan Perez')).toBeTruthy();

    // ── Paso 3: seleccionar usuario → aparece campo contraseña ────────
    await act(async () => {
      findByLabel(tree, 'Usuario Juan Perez').props.onPress();
    });

    // passwordResetRequired=true → autocompleta 00000000
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('00000000');

    // ── Paso 4: ingresa DNI y presiona Iniciar sesión ─────────────────
    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('12345678');
    });
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('12345678');

    await act(async () => {
      findByLabel(tree, 'Iniciar sesión').props.onPress();
      await flushPromises();
    });

    // Verificar que se llamó al backend con las credenciales correctas
    expect(api.post).toHaveBeenCalledWith('/auth/local-login', {
      usuarioId: 5,
      password: '12345678',
    });
  });

  test('flujo completo: Usuario → Sonia Sanidad → contraseña manual', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Selecciona rol Usuario
    await act(async () => {
      findByLabel(tree, 'Perfil Usuario').props.onPress();
      await flushPromises();
    });

    expect(findByLabel(tree, 'Usuario Sonia Sanidad')).toBeTruthy();

    // Selecciona usuario
    await act(async () => {
      findByLabel(tree, 'Usuario Sonia Sanidad').props.onPress();
    });

    // passwordResetRequired=false → contraseña vacía
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('');

    // Ingresa contraseña manualmente
    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('87654321');
    });
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('87654321');

    // Login
    await act(async () => {
      findByLabel(tree, 'Iniciar sesión').props.onPress();
      await flushPromises();
    });

    expect(getMockApi().post).toHaveBeenCalledWith('/auth/local-login', {
      usuarioId: 7,
      password: '87654321',
    });
  });

  test('navegación entre pasos: volver a perfiles desde usuarios', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Paso 1: seleccionar Admin
    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });

    // Paso 2: volver a perfiles
    await act(async () => {
      findByLabel(tree, 'Volver a seleccionar perfil').props.onPress();
    });

    // Debería mostrar los roles nuevamente
    expect(findByLabel(tree, 'Perfil Admin')).toBeTruthy();
    expect(findByLabel(tree, 'Perfil Usuario')).toBeTruthy();
  });

  test('navegación entre pasos: volver a usuarios desde contraseña', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Paso 1: Admin → Paso 2: Juan Perez
    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Usuario Juan Perez').props.onPress();
    });

    // Paso 3: volver a usuarios
    await act(async () => {
      findByLabel(tree, 'Volver a seleccionar usuario').props.onPress();
    });

    // Debería mostrar los usuarios del rol Admin
    expect(findByLabel(tree, 'Usuario Juan Perez')).toBeTruthy();
  });

  test('error de credenciales muestra mensaje del backend', async () => {
    const api = getMockApi();
    api.post.mockImplementation((url: string) => {
      if (url === '/auth/local-login') {
        return Promise.reject({
          response: {
            status: 401,
            data: {
              codigo: 'CREDENCIALES_INVALIDAS',
              mensaje: 'Usuario o contraseña incorrectos',
            },
          },
        });
      }
      return Promise.resolve({data: {}});
    });

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Login completo hasta paso 3
    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Usuario Juan Perez').props.onPress();
    });
    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('99999999');
    });
    await act(async () => {
      findByLabel(tree, 'Iniciar sesión').props.onPress();
      await flushPromises();
    });

    // Verificar mensaje de error visible
    const errorText = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Usuario o contraseña incorrectos',
    );
    expect(errorText.length).toBeGreaterThan(0);
  });

  test('validación: campos vacíos muestra error local', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    // Selecciona Admin → Juan Perez
    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Usuario Juan Perez').props.onPress();
    });

    // Limpia la contraseña autocompletada
    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('');
    });

    // Intenta login sin contraseña
    await act(async () => {
      findByLabel(tree, 'Iniciar sesión').props.onPress();
      await flushPromises();
    });

    const errorMsg = tree.root.findAll(
      (node: any) =>
        typeof node.props.children === 'string' &&
        node.props.children === 'Ingrese su contraseña.',
    );
    expect(errorMsg.length).toBeGreaterThan(0);
  });

  test('filtro del input descarta caracteres no numéricos (máx 8)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <AuthProvider>
            <LoginScreen />
          </AuthProvider>
        </NavigationContainer>,
      );
      await flushPromises();
    });

    await act(async () => {
      findByLabel(tree, 'Perfil Admin').props.onPress();
      await flushPromises();
    });
    await act(async () => {
      findByLabel(tree, 'Usuario Juan Perez').props.onPress();
    });

    // Ingresa caracteres mixtos → solo quedan dígitos (máx 8)
    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('12345abc');
    });
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('12345');

    await act(async () => {
      findByLabel(tree, 'Contraseña').props.onChangeText('1234567890');
    });
    expect(findByLabel(tree, 'Contraseña').props.value).toBe('12345678');
  });
});

/* ================================================================== */
/* Test 3: Home según perfil (tras login exitoso)                      */
/* ================================================================== */

describe('Flujo login — Home post-login por perfil', () => {
  beforeEach(async () => {
    await clearToken();
    mockNavigate.mockClear();
  });

  test('Home de Usuario muestra botones de Sanidad', async () => {
    const Keychain = require('react-native-keychain');
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
          <HomeScreen />
        </AuthProvider>,
      );
      await flushPromises();
    });

    // Verificar botones de usuario (Sanidad) — contarTexto solo cuenta
    // nodos compuestos (function/obj), no nodos host duplicados.
    expect(contarTexto(tree, 'Nuevo Requerimiento')).toBe(1);
    expect(contarTexto(tree, 'Historial de Requerimiento')).toBe(1);
  });

  test('Home de Admin muestra botones de I+D', async () => {
    const Keychain = require('react-native-keychain');
    (Keychain.getGenericPassword as jest.Mock).mockImplementation(
      (options?: {service?: string}) =>
        options?.service === 'accessToken'
          ? {password: TOKEN_ADMIN}
          : null,
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <AuthProvider>
          <HomeScreen />
        </AuthProvider>,
      );
      await flushPromises();
    });

    expect(contarTexto(tree, 'Programación')).toBe(1);
    expect(contarTexto(tree, 'Solicitud de Requerimientos')).toBe(1);
  });
});
