import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import notifee from '@notifee/react-native';
import {getMessaging, requestPermission, AuthorizationStatus} from '@react-native-firebase/messaging';
import {theme} from '../theme';
import {checkAllPermissions, type PermissionState} from '../utils/permissions';
import {CHANNEL_GENERAL} from '../services/NotificationService';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'Permisos'>;
};

/**
 * PermissionsScreen — Pantalla de permisos obligatorios (HITO-018/HITO-019).
 * Se muestra cuando la sesion esta activa pero al menos un permiso no esta
 * otorgado. Los 3 estados por permiso:
 *  - granted:  otorgado (check mark verde)
 *  - askable:  no otorgado pero se puede pedir (boton "Otorgar")
 *  - blocked:  desactivado en ajustes del sistema (boton "Abrir ajustes")
 */
export default function PermissionsScreen({route}: Props) {
  const [camera, setCamera] = useState<PermissionState>(
    route.params?.initialCameraState ?? 'askable',
  );
  const [notifications, setNotifications] = useState<PermissionState>(
    route.params?.initialNotificationsState ?? 'askable',
  );
  const [loading, setLoading] = useState(false);

  const recheck = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkAllPermissions();
      setCamera(result.camera);
      setNotifications(result.notifications);
    } catch {
      // Mantener estados actuales si falla
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    recheck();
  }, [recheck]);

  const requestCamera = async () => {
    if (Platform.OS !== 'android') {
      setCamera('granted');
      return;
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Permiso de Camara',
          message:
            'La camara es necesaria para tomar fotos de evidencia en campo ' +
            '(despachos, recepciones y liberaciones).',
          buttonNeutral: 'Preguntar despues',
          buttonNegative: 'No permitir',
          buttonPositive: 'Permitir',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setCamera('granted');
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setCamera('blocked');
        Alert.alert(
          'Permiso bloqueado',
          'La camara esta bloqueada permanentemente. Debe activarla desde ' +
            'Ajustes del sistema > Aplicaciones > Insectos Beneficos > Permisos > Camara.',
          [{text: 'Entendido'}],
        );
      } else {
        setCamera('askable');
      }

      // Re-sincronizar estado tras request (consistente con notificaciones)
      await recheck();
    } catch (error) {
      console.error('[PermissionsScreen] Error requesting camera:', error);
    }
  };

  const requestNotifications = async () => {
    try {
      // Android 13+ (API 33): usar el runtime permission nativo POST_NOTIFICATIONS.
      // Firebase requestPermission no muestra el dialogo de forma fiable en
      // Android y, en combinacion con requests concurrentes de camara, el
      // dialogo se perdia → el permiso nunca se otorgaba (bucle de permisos).
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Permiso de Notificaciones',
            message:
              'Las notificaciones son necesarias para recibir alertas de ' +
              'programaciones publicadas, requerimientos y cambios de estado.',
            buttonNeutral: 'Preguntar despues',
            buttonNegative: 'No permitir',
            buttonPositive: 'Permitir',
          },
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          setNotifications('granted');
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setNotifications('blocked');
          Alert.alert(
            'Permiso bloqueado',
            'Las notificaciones estan desactivadas. Debe activarlas desde ' +
              'Ajustes del sistema > Aplicaciones > Insectos Beneficos > Notificaciones.',
            [{text: 'Entendido'}],
          );
        } else {
          // DENIED simple: aun se puede volver a pedir
          setNotifications('askable');
        }
      } else {
        // Android <13 o iOS: Firebase messaging requestPermission
        const messaging = getMessaging();
        const authStatus = await requestPermission(messaging, {
          alert: true,
          badge: true,
          sound: true,
        });

        if (
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL
        ) {
          setNotifications('granted');
        } else {
          setNotifications('blocked');
          Alert.alert(
            'Permiso bloqueado',
            'Las notificaciones estan desactivadas. Debe activarlas desde ' +
              'Ajustes del sistema > Aplicaciones > Insectos Beneficos > Notificaciones.',
            [{text: 'Entendido'}],
          );
        }
      }

      // Re-sincronizar con la fuente pasiva (notifee) tras el request,
      // en vez de confiar solo en la respuesta del dialogo.
      await recheck();
    } catch (error) {
      console.error('[PermissionsScreen] Error requesting notifications:', error);
    }
  };

  const openCameraSettings = () => {
    Linking.openSettings();
  };

  const openNotificationSettings = async () => {
    try {
      await notifee.openNotificationSettings(CHANNEL_GENERAL);
    } catch {
      Linking.openSettings();
    }
  };

  const requestAllPermissions = async () => {
    // SERIALIZAR (no Promise.all): Android no maneja bien dos dialogos de
    // permiso simultaneos; el de notificaciones se perdia silenciosamente y
    // el permiso nunca se otorgaba (bucle de permisos al reabrir la app).
    await requestCamera();
    await requestNotifications();
  };

  const canProceed = camera === 'granted' && notifications === 'granted';

  const handleContinue = () => {
    if (canProceed) {
      route.params?.onPermissionsGranted?.();
    }
  };

  const renderStatus = (state: PermissionState, onRequest: () => void, onOpenSettings: () => void) => {
    switch (state) {
      case 'granted':
        return <Text style={styles.granted}>✓ Otorgado</Text>;
      case 'blocked':
        return (
          <TouchableOpacity style={styles.blockedButton} onPress={onOpenSettings}>
            <Text style={styles.blockedButtonText}>Abrir ajustes</Text>
          </TouchableOpacity>
        );
      case 'askable':
      default:
        return (
          <TouchableOpacity style={styles.grantButton} onPress={onRequest}>
            <Text style={styles.grantButtonText}>Otorgar</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Permisos de la aplicacion</Text>
          <Text style={styles.subtitle}>
            Para el correcto funcionamiento de Entrega de Insectos Beneficos,
            necesitamos los siguientes permisos:
          </Text>
        </View>

        <View style={styles.permissionsList}>
          {/* Camara */}
          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionIcon}>📷</Text>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Camara</Text>
                <Text style={styles.permissionDesc}>
                  Necesaria para tomar fotos de evidencia en campo (despachos,
                  recepciones y liberaciones).
                </Text>
              </View>
            </View>
            <View style={styles.permissionStatus}>
              {renderStatus(camera, requestCamera, openCameraSettings)}
            </View>
          </View>

          {/* Notificaciones */}
          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionIcon}>🔔</Text>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Notificaciones</Text>
                <Text style={styles.permissionDesc}>
                  Para recibir alertas de programaciones publicadas,
                  requerimientos y cambios de estado.
                </Text>
              </View>
            </View>
            <View style={styles.permissionStatus}>
              {renderStatus(notifications, requestNotifications, openNotificationSettings)}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {(camera !== 'granted' || notifications !== 'granted') && (
            <TouchableOpacity
              style={[styles.requestAllButton, loading && styles.disabled]}
              onPress={requestAllPermissions}
              disabled={loading}>
              <Text style={styles.requestAllText}>
                {loading ? 'Verificando...' : 'Otorgar todos los permisos'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.continueButton, !canProceed && styles.disabledContinue]}
            onPress={handleContinue}
            disabled={!canProceed}>
            <Text style={[styles.continueText, !canProceed && styles.disabledContinueText]}>
              Continuar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.page,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    lineHeight: 22,
  },
  permissionsList: {
    marginBottom: 32,
  },
  permissionItem: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.action.primary,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  permissionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  permissionStatus: {
    alignItems: 'flex-end',
  },
  granted: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  grantButton: {
    backgroundColor: theme.colors.action.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  grantButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blockedButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  blockedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actions: {
    gap: 12,
  },
  requestAllButton: {
    backgroundColor: theme.colors.action.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
  disabledContinue: {
    backgroundColor: '#E0E0E0',
  },
  disabledContinueText: {
    color: '#9E9E9E',
  },
});
