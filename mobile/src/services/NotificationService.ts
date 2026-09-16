/**
 * NotificationService — servicio de notificaciones push FCM (ADR-A004).
 *
 * Usa la API modular de @react-native-firebase/messaging v26+.
 *
 * Responsabilidades:
 *  1. Solicitar permisos de notificación al usuario.
 *  2. Obtener y registrar el token FCM en el backend.
 *  3. Escuchar mensajes en foreground (app abierta).
 *  4. Registrar/eliminar tokens al hacer login/logout.
 */

import {
  getMessaging,
  getToken,
  onTokenRefresh,
  onMessage,
  requestPermission,
  AuthorizationStatus,
  type Messaging,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import {Platform, Alert} from 'react-native';
import {api} from './ApiClient';

class NotificationServiceClass {
  private initialized = false;
  private currentToken: string | null = null;
  private messagingInstance: Messaging | null = null;

  /**
   * Inicializa el servicio de notificaciones push.
   * Debe llamarse después del login exitoso.
   */
  async initialize(usuarioId: number): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 1. Obtener instancia de messaging
      this.messagingInstance = getMessaging();

      // 2. Solicitar permisos
      const authStatus = await requestPermission(this.messagingInstance, {
        alert: true,
        badge: true,
        sound: true,
      });

      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[NotificationService] Permisos de notificación denegados');
        return;
      }

      // 3. Obtener token FCM
      const token = await getToken(this.messagingInstance);
      if (token) {
        this.currentToken = token;
        console.log('[NotificationService] Token FCM obtenido:', token.substring(0, 20) + '...');

        // 4. Registrar en el backend
        await this.registrarTokenEnBackend(token, usuarioId);
      }

      // 5. Listener de token refresh
      onTokenRefresh(this.messagingInstance, async (newToken: string) => {
        console.log('[NotificationService] Token refrescado');
        this.currentToken = newToken;
        await this.registrarTokenEnBackend(newToken, usuarioId);
      });

      // 6. Listener de mensajes en foreground
      this.setupForegroundListener();

      this.initialized = true;
      console.log('[NotificationService] Inicializado correctamente');
    } catch (error) {
      console.error('[NotificationService] Error al inicializar:', error);
    }
  }

  /**
   * Registra el token FCM en el backend.
   */
  private async registrarTokenEnBackend(token: string, usuarioId: number): Promise<void> {
    try {
      const platform = Platform.OS === 'android' ? 'android' : 'ios';
      await api.post(
        '/dispositivos-token',
        {token, platform},
        {headers: {'X-Usuario-Id': String(usuarioId)}},
      );
      console.log('[NotificationService] Token registrado en backend');
    } catch (error) {
      console.error('[NotificationService] Error al registrar token:', error);
    }
  }

  /**
   * Configura el listener de mensajes en foreground.
   */
  private setupForegroundListener(): void {
    if (!this.messagingInstance) {
      return;
    }

    onMessage(this.messagingInstance, async (remoteMessage: RemoteMessage) => {
      const titulo = remoteMessage.notification?.title || 'Notificación';
      const mensaje = remoteMessage.notification?.body || '';

      console.log('[NotificationService] Mensaje en foreground:', titulo, mensaje);

      // Mostrar alerta local
      Alert.alert(titulo, mensaje, [{text: 'OK', style: 'default'}]);
    });
  }

  /**
   * Limpia los recursos al hacer logout.
   */
  async cleanup(): Promise<void> {
    if (this.currentToken) {
      try {
        await api.delete(`/dispositivos-token/${this.currentToken}`);
        console.log('[NotificationService] Token eliminado del backend');
      } catch (error) {
        console.error('[NotificationService] Error al eliminar token:', error);
      }
    }

    this.currentToken = null;
    this.messagingInstance = null;
    this.initialized = false;
  }

  /**
   * Solicita permisos de notificación de forma explícita.
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!this.messagingInstance) {
        this.messagingInstance = getMessaging();
      }
      const authStatus = await requestPermission(this.messagingInstance);
      return (
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch {
      return false;
    }
  }

  /**
   * Obtiene el token FCM actual.
   */
  getToken(): string | null {
    return this.currentToken;
  }
}

// Singleton
const NotificationService = new NotificationServiceClass();
export default NotificationService;
