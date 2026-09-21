/**
 * URL base por defecto (fallback) del backend.
 *
 * Contrato HITO-002 (Auth v2): todas las rutas viven bajo `/api/v1` (ADR-A003
 * D-AUTH2-5). La URL real se configura en runtime y se persiste en el
 * SecureStore (Keychain, service `apiUrl`).
 *
 * Este valor SOLO se usa como fallback cuando:
 *  - No hay URL guardada en Keychain (primera instalación).
 *  - El usuario presiona "Restablecer" (Settings/ServerCheck).
 *
 * La fuente de verdad es la URL que el usuario ingresa en ServerCheck o
 * Configurar servidor — esa URL se almacena en Keychain y se usa en TODAS
 * las peticiones HTTP del proyecto (via interceptor de axios).
 *
 * `localhost` es intencional: en el celular no hay backend, así que al no
 * tener URL guardada ServerCheck obliga al usuario a ingresar la IP real.
 * En el entorno de desarrollo (emulador/máquina local) sí funciona.
 */
const API_BASE_URL = 'http://10.13.10.24:6113/api/v1';

export default API_BASE_URL;