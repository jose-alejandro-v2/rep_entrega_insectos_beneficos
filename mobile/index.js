/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import App from './App';

// Handler para mensajes FCM cuando el app está en background o killed.
// Firebase muestra automáticamente la notificación en la barra del sistema
// para mensajes de tipo "notification" (title+body).
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[Background] Mensaje FCM recibido:', remoteMessage.notification?.title);
});

AppRegistry.registerComponent(appName, () => App);
