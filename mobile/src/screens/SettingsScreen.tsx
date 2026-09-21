import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  BUILT_IN_API_URL,
  loadApiUrl,
  resetApiUrl,
  setApiUrl,
} from '../services/ApiClient';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import LoadingState from '../components/LoadingState';
import {theme} from '../theme';

/**
 * Configuración de la URL del servidor en runtime (modelo reutilizable §7.3).
 * Accesible desde el Login ("Configurar servidor") y desde el Home del
 * Super Admin. La URL se persiste en SecureStore (Keychain, service
 * `apiUrl`) y el interceptor de axios la aplica en la siguiente petición.
 *
 * HITO-003 (delta): tema Vanguard completo (AppCard/AppInput/AppButton, sin
 * hardcodes de la paleta antigua). Esta pantalla se muestra CON header del
 * stack ("Configurar servidor"), por lo que el inset superior lo resuelve el
 * native-stack (no se envuelve en SafeAreaView para no duplicar padding).
 */
export default function SettingsScreen() {
  const navigation = useNavigation();
  const [apiUrl, setApiUrlInput] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedUrl = await loadApiUrl();
      setApiUrlInput(savedUrl);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setMessage('');
    await setApiUrl(apiUrl);
    setMessage('URL guardada correctamente.');
  };

  const handleReset = async () => {
    await resetApiUrl();
    setApiUrlInput(BUILT_IN_API_URL);
    setMessage('Se restauró la URL por defecto.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppCard style={styles.card}>
        <Text style={styles.title}>Configurar servidor</Text>
        <Text style={styles.subtitle}>
          Ingrese la dirección de la API del sistema. Se aplicará de inmediato
          a todas las conexiones.
        </Text>

        {loading ? (
          <LoadingState message="Cargando configuración…" />
        ) : (
          <>
            <AppInput
              label="URL de la API"
              placeholder="10.13.18.93 (solo su IP de la laptop)"
              value={apiUrl}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="URL de la API"
            />

            <Text style={styles.hint}>
              Escriba solo la IP (ej. 10.13.18.93). App completa
              http://IP:6113/api/v1 automáticamente.
            </Text>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <AppButton
              label="Guardar"
              onPress={handleSave}
              accessibilityLabel="Guardar URL del servidor"
            />

            <AppButton
              label="Restablecer"
              variant="text"
              onPress={handleReset}
              accessibilityLabel="Restablecer URL por defecto"
            />

            <AppButton
              label="Volver"
              variant="text"
              onPress={() => navigation.goBack()}
              accessibilityLabel="Volver"
            />
          </>
        )}
      </AppCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.page,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    backgroundColor: theme.colors.background.authOverlay,
    ...theme.shadows.z2,
  },
  title: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: theme.typography.h2.fontSize,
    lineHeight: theme.typography.h2.lineHeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  subtitle: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  message: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.status.success,
    textAlign: 'center',
    marginBottom: theme.spacing[3],
  },
  hint: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[3],
  },
});