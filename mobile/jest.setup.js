/* global jest, require */

// Mock oficial de react-native-safe-area-context para Jest
// (documentado en https://reactnavigation.org/docs/testing/).
jest.mock('react-native-safe-area-context', () => {
  return require('react-native-safe-area-context/jest/mock').default;
});

// Los iconos se renderizan como texto en Jest; el módulo nativo real se usa en Android.
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: Text};
});

// Mock de react-native-keychain (SecureStore): evita cargar el módulo
// nativo en Jest. Por defecto no hay token ni URL guardados.
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(null),
  setGenericPassword: jest
    .fn()
    .mockResolvedValue({service: 'unit-test', storage: 'unit-test'}),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
}));

// Mock de cámara y galería: las pruebas de UI no disponen de un dispositivo físico.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn().mockResolvedValue({didCancel: true}),
  launchImageLibrary: jest.fn().mockResolvedValue({didCancel: true}),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Mock de isTokenExpired: por defecto NO expirado (tokens de test no tienen exp).
// Tests que validen el flujo real de expiración pueden overridearlo con
// jest.requireActual para testear la implementación de token.ts.
jest.mock('./src/utils/token', () => ({
  isTokenExpired: jest.fn(() => false),
}));

// Mock de axios: ApiClient usa `axios.create()` + interceptores; en Jest se
// sustituye la instancia para que NINGÚN test haga llamadas de red. Por
// defecto GET devuelve `[]` y POST `{}` (ampliable por test con jest.mock
// propio o mockImplementation sobre la instancia devuelta por create).
jest.mock('axios', () => {
  const instance = {
    get: jest.fn().mockResolvedValue({data: []}),
    post: jest.fn().mockResolvedValue({data: {}}),
    put: jest.fn().mockResolvedValue({data: {}}),
    delete: jest.fn().mockResolvedValue({data: {}}),
    interceptors: {
      request: {use: jest.fn()},
      response: {use: jest.fn()},
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
    },
    AxiosError: class AxiosError extends Error {},
  };
});

// Fix pre-existente (documentado en 04_implementacion.md §82.3): el ESM de
// @react-native-firebase/messaging NO pasa por babel (fuera de
// transformIgnorePatterns) y @notifee/react-native exige su módulo nativo.
// Ambos rompían el import de AuthContext/PermissionsScreen → 18 de 23 suites
// no llegaban a ejecutar. Mock con factory: el módulo real nunca se carga
// (patrón de los mocks de keychain/axios de este archivo).
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn().mockResolvedValue('fcm-token-test'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  requestPermission: jest.fn().mockResolvedValue(1),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('channel-id'),
    displayNotification: jest.fn().mockResolvedValue('notification-id'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getNotificationSettings: jest
      .fn()
      .mockResolvedValue({authorizationStatus: 2}),
    isChannelBlocked: jest.fn().mockResolvedValue(false),
    openNotificationSettings: jest.fn().mockResolvedValue(undefined),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
  },
  AndroidImportance: {
    NONE: 0,
    MIN: 1,
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
  EventType: {
    TRIGGER: 0,
    DELIVERED: 1,
    PRESS: 2,
    DISMISSED: 3,
  },
}));