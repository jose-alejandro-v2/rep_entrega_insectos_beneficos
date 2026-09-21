/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
} from '@notifee/react-native';
import App from './App';

// Handler para mensajes FCM cuando el app está en background o killed.
// Si el mensaje tiene payload "notification", Firebase lo muestra automáticamente.
// Si es un mensaje "data-only", usamos notifee para mostrarlo en la barra.
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[Background] Mensaje FCM recibido:', remoteMessage.notification?.title);

  // Si el mensaje NO tiene payload "notification" (data-only), mostrarlo con notifee
  if (!remoteMessage.notification) {
    await notifee.displayNotification({
      title: remoteMessage.data?.titulo || 'Notificación',
      body: remoteMessage.data?.mensaje || '',
      android: {
        channelId: 'insectos_beneficos_general',
        pressAction: {id: 'default'},
        importance: AndroidImportance.HIGH,
      },
    });
  }
});

AppRegistry.registerComponent(appName, () => App);
