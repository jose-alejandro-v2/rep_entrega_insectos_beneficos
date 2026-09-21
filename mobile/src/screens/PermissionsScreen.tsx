import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getMessaging, requestPermission, AuthorizationStatus} from '@react-native-firebase/messaging';
import {theme} from '../theme';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'Permisos'>;
};

interface PermissionStatus {
  camera: boolean;
  notifications: boolean;
}

/**
 * PermissionsScreen — Pantalla de permisos obligatorios (HITO-018).
 * Se muestra despues del login si el usuario no ha otorgado permisos
 * de camara y notificaciones. Obligatoria para continuar.
 */
export default function PermissionsScreen({_navigation, route}: Props) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: false,
    notifications: false,
  });
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const checkPermissions = useCallback(async () => {
    try {
      // Verificar camara
      let cameraGranted = false;
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        cameraGranted = result;
      } else {
        cameraGranted = true; // iOS se maneja diferente
      }

      // Verificar notificaciones
      let notificationsGranted = false;
      try {
        const messaging = getMessaging();
        const authStatus = await requestPermission(messaging);
        notificationsGranted =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
      } catch {
        notificationsGranted = false;
      }

      setPermissions({
        camera: cameraGranted,
        notifications: notificationsGranted,
      });
    } catch (error) {
      console.error('[PermissionsScreen] Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') {
      setPermissions(prev => ({...prev, camera: true}));
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
        setPermissions(prev => ({...prev, camera: true}));
      } else {
        Alert.alert(
          'Permiso requerido',
          'La camara es obligatoria para el funcionamiento de la app. ' +
            'Puede activarla desde Configuracion > Permisos.',
          [{text: 'Entendido'}],
        );
      }
    } catch (error) {
      console.error('[PermissionsScreen] Error requesting camera:', error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
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
        setPermissions(prev => ({...prev, notifications: true}));
      } else {
        Alert.alert(
          'Permiso requerido',
          'Las notificaciones son obligatorias para recibir alertas de ' +
            'programaciones, requerimientos y cambios de estado. ' +
            'Puede activarlas desde Configuracion > Permisos.',
          [{text: 'Entendido'}],
        );
      }
    } catch (error) {
      console.error('[PermissionsScreen] Error requesting notifications:', error);
    }
  };

  const requestAllPermissions = async () => {
    setRequesting(true);
    await Promise.all([
      requestCameraPermission(),
      requestNotificationPermission(),
    ]);
    setRequesting(false);
  };

  const canProceed = permissions.camera && permissions.notifications;

  const handleContinue = () => {
    if (canProceed) {
      route.params?.onPermissionsGranted?.();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Verificando permisos...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
              {permissions.camera ? (
                <Text style={styles.granted}>✓ Otorgado</Text>
              ) : (
                <TouchableOpacity
                  style={styles.grantButton}
                  onPress={requestCameraPermission}>
                  <Text style={styles.grantButtonText}>Otorgar</Text>
                </TouchableOpacity>
              )}
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
              {permissions.notifications ? (
                <Text style={styles.granted}>✓ Otorgado</Text>
              ) : (
                <TouchableOpacity
                  style={styles.grantButton}
                  onPress={requestNotificationPermission}>
                  <Text style={styles.grantButtonText}>Otorgar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {!canProceed && (
            <TouchableOpacity
              style={[styles.requestAllButton, requesting && styles.disabled]}
              onPress={requestAllPermissions}
              disabled={requesting}>
              <Text style={styles.requestAllText}>
                {requesting ? 'Solicitando...' : 'Otorgar todos los permisos'}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
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
