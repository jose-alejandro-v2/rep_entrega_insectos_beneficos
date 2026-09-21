import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, KeyboardAvoidingView, Platform, StyleSheet, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  api,
  BUILT_IN_API_URL,
  loadApiUrl,
  normalizeApiUrl,
  resetApiUrl,
  setApiUrl,
} from '../services/ApiClient';
import type {RootStackParamList} from '../navigation/types';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import LoadingState from '../components/LoadingState';
import {theme} from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Status = 'checking' | 'error' | 'ready';

/**
 * Pantalla inicial del flujo no autenticado.
 * Comprueba el backend antes de permitir el acceso al login. La aplicación
 * opera exclusivamente contra la API; no existe bypass de conectividad.
 */
export default function ServerCheckScreen() {
  const navigation = useNavigation<Navigation>();
  const [status, setStatus] = useState<Status>('checking');
  const [apiUrl, setApiUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const probe = useCallback(
    async (urlToTest?: string) => {
      setStatus('checking');
      setErrorMsg('');
      try {
        const url = urlToTest ?? (await loadApiUrl());
        await api.get('/auth/roles', {timeout: 5000, baseURL: url});
        setStatus('ready');
        navigation.replace('Login');
      } catch (err) {
        setStatus('error');
        setErrorMsg(describeError(err));
      }
    },
    [navigation],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedUrl = await loadApiUrl();
        if (!cancelled) {
          setApiUrlInput(savedUrl);
          await probe(savedUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(describeError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleSaveAndProbe = async () => {
    setSaving(true);
    try {
      await setApiUrl(apiUrl);
      await probe(normalizeApiUrl(apiUrl));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await resetApiUrl();
    setApiUrlInput(BUILT_IN_API_URL);
    await probe(BUILT_IN_API_URL);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Verificando servidor</Text>

          {status === 'checking' ? (
            <LoadingState message="Comprobando la conexión con el servidor…" />
          ) : (
            <>
              <Text style={styles.subtitle}>
                No se pudo conectar con el servidor. Verifique la dirección de
                la API e intente de nuevo.
              </Text>
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

              <AppInput
                label="URL de la API"
                placeholder="10.13.18.93"
                value={apiUrl}
                onChangeText={setApiUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="URL de la API"
              />

              <Text style={styles.hint}>
                Escriba la IP o URL del servidor. La aplicación completa
                http://IP:6113/api/v1 cuando corresponda.
              </Text>

              <AppButton
                label="Guardar y probar"
                onPress={handleSaveAndProbe}
                loading={saving}
                accessibilityLabel="Guardar y probar servidor"
              />

              <AppButton
                label="Reintentar"
                variant="secondary"
                onPress={() => probe()}
                accessibilityLabel="Reintentar verificación del servidor"
              />

              <AppButton
                label="Restablecer"
                variant="text"
                onPress={handleReset}
                accessibilityLabel="Restablecer URL por defecto"
              />
            </>
          )}
        </AppCard>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function describeError(err: unknown): string {
  const e = err as {code?: string; message?: string; response?: {status?: number}};
  if (e?.code === 'ECONNABORTED') {
    return 'Tiempo de espera agotado. Verifique la dirección del servidor.';
  }
  if (e?.response) {
    return `El servidor respondió con error (HTTP ${e.response.status}).`;
  }
  if (e?.message === 'Network Error') {
    return 'No se pudo conectar. Revise su conexión o la dirección.';
  }
  return e?.message || 'No se pudo conectar con el servidor.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.page,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    marginHorizontal: theme.spacing[6],
    backgroundColor: theme.colors.background.authOverlay,
    ...theme.shadows.z2,
  },
  title: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: theme.typography.h2.fontSize,
    lineHeight: theme.typography.h2.lineHeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  subtitle: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[4],
  },
  error: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.status.error,
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
