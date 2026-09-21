/**
 * NotificationService — servicio de notificaciones push FCM (ADR-A004).
 *
 * Usa @react-native-firebase/messaging v26+ (API modular) + @notifee/react-native
 * para mostrar notificaciones en la barra de notificaciones (estilo WhatsApp).
 *
 * Responsabilidades:
 *  1. Crear canales de notificación Android.
 *  2. Obtener y registrar el token FCM en el backend.
 *  3. Escuchar mensajes en foreground → mostrar en la barra (no popup).
 *  4. Manejar tap en notificación (background/killed) → navegar a pantalla.
 *  5. Registrar/eliminar tokens al hacer login/logout.
 */

import {
  getMessaging,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
  type Messaging,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  type Event,
  EventType,
} from '@notifee/react-native';
import {Platform} from 'react-native';
import {api} from './ApiClient';

const CHANNEL_GENERAL = 'insectos_beneficos_general';
const CHANNEL_SUCCESS = 'insectos_beneficos_success';

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
      // 1. Crear canales Android (necesario para que las notificaciones aparezcan en la barra)
      await this.createNotificationChannels();

      // 2. Obtener instancia de messaging
      this.messagingInstance = getMessaging();

      // 3. Solicitar permisos
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

      // 4. Obtener token FCM
      const token = await getToken(this.messagingInstance);
      if (token) {
        this.currentToken = token;
        console.log('[NotificationService] Token FCM obtenido:', token.substring(0, 20) + '...');

        // 5. Registrar en el backend
        await this.registrarTokenEnBackend(token, usuarioId);
      }

      // 6. Listener de token refresh
      onTokenRefresh(this.messagingInstance, async (newToken: string) => {
        console.log('[NotificationService] Token refrescado');
        this.currentToken = newToken;
        await this.registrarTokenEnBackend(newToken, usuarioId);
      });

      // 7. Listener de mensajes en foreground → mostrar en barra de notificaciones
      this.setupForegroundListener();

      // 8. Listener de tap en notificación (app en background)
      this.setupNotificationOpenedListener();

      // 9. Verificar si la app se abrió desde una notificación (app estaba cerrada)
      await this.checkInitialNotification();

      this.initialized = true;
      console.log('[NotificationService] Inicializado correctamente');
    } catch (error) {
      console.error('[NotificationService] Error al inicializar:', error);
    }
  }

  /**
   * Crea los canales de notificación Android.
   */
  private async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    await notifee.createChannel({
      id: CHANNEL_GENERAL,
      name: 'Notificaciones generales',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });

    await notifee.createChannel({
      id: CHANNEL_SUCCESS,
      name: 'Confirmaciones',
      importance: AndroidImportance.DEFAULT,
      vibration: false,
      sound: 'default',
    });

    console.log('[NotificationService] Canales de notificación creados');
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
   * En vez de mostrar un popup (Alert), muestra la notificación en la barra
   * de notificaciones del sistema (estilo WhatsApp).
   */
  private setupForegroundListener(): void {
    if (!this.messagingInstance) {
      return;
    }

    onMessage(this.messagingInstance, async (remoteMessage: RemoteMessage) => {
      // Soportar ambos formatos: payload "notification" (Firebase) y "data" (custom)
      const titulo = remoteMessage.notification?.title || remoteMessage.data?.titulo || 'Notificación';
      const mensaje = remoteMessage.notification?.body || remoteMessage.data?.mensaje || '';

      console.log('[NotificationService] Mensaje en foreground:', titulo, mensaje);

      // Mostrar notificación en la barra del sistema (no popup)
      await notifee.displayNotification({
        title: titulo,
        body: mensaje,
        android: {
          channelId: CHANNEL_GENERAL,
          pressAction: {id: 'default'},
        },
        ios: {
          sound: 'default',
        },
      });
    });
  }

  /**
   * Configura el listener de tap en notificaciones (app en background).
   * Navega a la pantalla correspondiente según el tipo de notificación.
   */
  private setupNotificationOpenedListener(): void {
    // Listener de @notifee para acciones de notificación
    notifee.onForegroundEvent(async ({type, _detail}: Event) => {
      if (type === EventType.PRESS) {
        console.log('[NotificationService] Notificación presionada en foreground');
        // TODO: navegar a pantalla relevante cuando se implemente deep linking
      }
    });

    // Listener de Firebase para app en background
    onNotificationOpenedApp(this.messagingInstance!, _remoteMessage => {
      console.log('[NotificationService] App abierta desde notificación (background)');
      // TODO: navegar a pantalla relevante cuando se implemente deep linking
    });
  }

  /**
   * Verifica si la app se abrió desde una notificación (app estaba cerrada).
   */
  private async checkInitialNotification(): Promise<void> {
    try {
      const remoteMessage = await getInitialNotification(this.messagingInstance!);
      if (remoteMessage) {
        console.log('[NotificationService] App abierta desde notificación (killed)');
        // TODO: navegar a pantalla relevante cuando se implemente deep linking
      }
    } catch (error) {
      console.error('[NotificationService] Error al verificar notificación inicial:', error);
    }
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
