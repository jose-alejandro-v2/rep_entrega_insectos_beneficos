/**
 * permissions.ts — Verificación pasiva de permisos obligatorios (HITO-019).
 *
 * NO dispara diálogos del sistema (a diferencia de requestPermission).
 * Devuelve el estado actual para que la UI decida mostrar/ocultar la pantalla
 * de permisos y qué botones habilitar.
 *
 * Estados por permiso:
 *  - granted:  otorgado y funcional
 *  - askable:  no otorgado pero se puede pedir (no ha dicho "no preguntar más")
 *  - blocked:  desactivado en ajustes del sistema (requiere abrir ajustes)
 */

import {Platform} from 'react-native';
import {PermissionsAndroid} from 'react-native';
import notifee, {AuthorizationStatus, AndroidImportance} from '@notifee/react-native';
import {CHANNEL_GENERAL} from '../services/NotificationService';

export type PermissionState = 'granted' | 'askable' | 'blocked';

/**
 * Verifica permiso de cámara (pasivo, sin dialogo).
 * Android <13 no requiere POST_NOTIFICATIONS; cámara siempre aplica.
 */
export async function checkCameraPermission(): Promise<PermissionState> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (granted) {
      return 'granted';
    }

    // check() solo devuelve false; no distingue "nunca preguntado" de "bloqueado".
    // Usamos requestPermission con rationale para detectar NEVER_ASK_AGAIN.
    // Pero esto solo funciona la PRIMERA vez; después el check ya lo tenemos.
    // En la práctica, PermissionsScreen es quien maneja la distinción vía el
    // resultado de PermissionsAndroid.request().
    return 'askable';
  } catch {
    return 'askable';
  }
}

/**
 * Verifica permiso de notificaciones (pasivo, sin dialogo).
 *
 * Combina dos fuentes:
 *  1. notifee.getNotificationSettings().authorizationStatus — refleja
 *     POST_NOTIFICATIONS en Android 13+ (DENIED/AUTHORIZED).
 *  2. notifee.isChannelBlocked(CHANNEL_GENERAL) — refleja si el usuario
 *     desactivó el canal específico desde ajustes del sistema.
 *
 * En Android <13 no existe POST_NOTIFICATIONS (siempre autorizado a nivel
 * permiso), pero el usuario puede bloquear canales individualmente.
 */
export async function checkNotificationsPermission(): Promise<PermissionState> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  try {
    // Asegurar que el canal exista ANTES de isChannelBlocked: en el primer
    // arranque el canal aún no fue creado por NotificationService.initialize()
    // y isChannelBlocked sobre canal inexistente puede fallar o dar falsos.
    // createChannel es idempotente (si ya existe, no hace nada).
    await notifee.createChannel({
      id: CHANNEL_GENERAL,
      name: 'Notificaciones generales',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });

    const settings = await notifee.getNotificationSettings();
    const authStatus = settings.authorizationStatus;

    // Si el sistema indica autorizado, verificar canal específico
    if (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    ) {
      const channelBlocked = await notifee.isChannelBlocked(CHANNEL_GENERAL);
      return channelBlocked ? 'blocked' : 'granted';
    }

    // En Android <13 no hay POST_NOTIFICATIONS; authorizationStatus puede
    // ser DENIED/AUTHORIZED. Si canales no bloqueados → granted.
    if (Platform.Version < 33) {
      const channelBlocked = await notifee.isChannelBlocked(CHANNEL_GENERAL);
      return channelBlocked ? 'blocked' : 'granted';
    }

    // Android 13+ y no autorizado: notifee en Android solo devuelve DENIED
    // (no distingue "nunca preguntado" de "denegado"). Tratamos como
    // 'askable' para mostrar "Otorgar"; el estado 'blocked' real se detecta
    // tras un request que devuelve NEVER_ASK_AGAIN (PermissionsScreen).
    // Antes se retornaba 'blocked' aquí y el bucle de permisos no avanzaba.
    return 'askable';
  } catch {
    return 'askable';
  }
}

/**
 * Verifica ambos permisos. Usado por RootNavigator en cada app start.
 */
export async function checkAllPermissions(): Promise<{
  camera: PermissionState;
  notifications: PermissionState;
  allGranted: boolean;
}> {
  const [camera, notifications] = await Promise.all([
    checkCameraPermission(),
    checkNotificationsPermission(),
  ]);

  return {
    camera,
    notifications,
    allGranted: camera === 'granted' && notifications === 'granted',
  };
}
