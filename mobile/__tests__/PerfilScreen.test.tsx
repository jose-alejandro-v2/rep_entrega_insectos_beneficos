/**
 * PerfilScreen (estructura UX referencial del PerfilScreen.js de Apilamiento
 * adaptada a componentes Vanguard — §32.6):
 *  - Tarjeta de perfil centrada: avatar + nombre + DNI + rol.
 *  - Sección "Información de la Cuenta": filas Nombre / Rol / DNI.
 *  - Sección "Aplicación": Versión {APP_VERSION} + AppIconButton que abre el
 *    HistoryDialog del historial de versiones (modal local).
 *  - Botón "Cerrar sesión" → ConfirmDialog (acción destructiva).
 *
 * Approach (igual que HomeScreen.test.tsx): react-test-renderer + AuthProvider
 * + mock de Keychain (token JWT fabricado con makeToken → AuthUser con dni y
 * rol literales exactos 'Super Admin' | 'Admin' | 'Usuario').
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import {AuthProvider} from '../src/context/AuthContext';
import PerfilScreen from '../src/screens/PerfilScreen';
import {clearToken} from '../src/services/ApiClient';
import {
  contarTexto,
  findByLabel,
  flushPromises,
  makeToken,
} from '../test-utils/helpers';

// BottomNavigation usa useNavigation: se mockea como en HomeScreen.test.tsx
// para no depender del navigation container nativo en el árbol de Jest.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({navigate: jest.fn()})),
  };
});

const TOKEN = makeToken({
  sub: '9',
  groups: ['Usuario'],
  rolId: 3,
  nombre: 'Persona Test',
  dni: '12345678',
  passwordResetRequired: false,
});

async function renderPerfil() {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    (options?: {service?: string}) =>
      options?.service === 'accessToken'
        ? {password: TOKEN}
        : null,
  );

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider>
        <PerfilScreen />
      </AuthProvider>,
    );
    await flushPromises();
  });
  return tree;
}

describe('PerfilScreen (estructura UX Apilamiento → Vanguard)', () => {
  beforeEach(async () => {
    await clearToken(); // cache en memoria de ApiClient (getToken) + Keychain
  });

  test('tarjeta de perfil con nombre, DNI y rol; secciones de cuenta y aplicación', async () => {
    const tree = await renderPerfil();

    // Tarjeta de perfil (avatar + inicial + nombre + DNI + rol).
    expect(contarTexto(tree, 'Persona Test')).toBeGreaterThan(0);
    expect(contarTexto(tree, 'DNI: 12345678')).toBe(1);
    expect(contarTexto(tree, 'Perfil: Usuario')).toBe(1);

    // Sección "Información de la Cuenta": filas label/valor.
    expect(contarTexto(tree, 'Información de la Cuenta')).toBe(1);
    expect(contarTexto(tree, 'Nombre')).toBe(1);
    expect(contarTexto(tree, 'Rol')).toBe(1);
    expect(contarTexto(tree, 'DNI')).toBe(1);
    expect(contarTexto(tree, '12345678')).toBe(1); // valor de la fila DNI

    // Sección "Aplicación": versión + acceso al historial.
    expect(contarTexto(tree, 'Aplicación')).toBe(1);
    expect(contarTexto(tree, 'Versión 1.9.0')).toBe(1);
    expect(findByLabel(tree, 'Abrir historial de versiones')).toBeTruthy();
  });

  test('abre y cierra el HistoryDialog del historial de versiones', async () => {
    const tree = await renderPerfil();

    // Oculto por defecto.
    expect(contarTexto(tree, 'Historial de versiones')).toBe(0);

    // Abre desde el AppIconButton de la sección Aplicación.
    await act(async () => {
      findByLabel(tree, 'Abrir historial de versiones').props.onPress();
    });
    expect(contarTexto(tree, 'Historial de versiones')).toBe(1);
    expect(contarTexto(tree, 'v1.7.0 · 2026-09-02')).toBe(1);
    expect(contarTexto(tree, 'v1.0.0 · 2026-08-18')).toBe(1);
    expect(
      contarTexto(tree, '• Backend en /api/v1 con autenticación v2 (JWT local).'),
    ).toBe(1);

    // Cierra con su botón (label de accesibilidad propio del modal).
    await act(async () => {
      findByLabel(tree, 'Cerrar historial de versiones').props.onPress();
    });
    expect(contarTexto(tree, 'Historial de versiones')).toBe(0);
  });

  test('botón "Cerrar sesión" abre el ConfirmDialog de confirmación', async () => {
    const tree = await renderPerfil();
    expect(contarTexto(tree, '¿Deseas cerrar la sesión actual?')).toBe(0);

    await act(async () => {
      findByLabel(tree, 'Cerrar sesión').props.onPress();
    });

    expect(contarTexto(tree, '¿Deseas cerrar la sesión actual?')).toBe(1);
    expect(findByLabel(tree, 'Confirmar cierre de sesión')).toBeTruthy();
  });
});