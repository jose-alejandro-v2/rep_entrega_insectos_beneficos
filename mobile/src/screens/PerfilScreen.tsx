import React, {useState} from 'react';
import {Modal, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppHeader from '../components/AppHeader';
import AppIconButton from '../components/AppIconButton';
import BottomNavigation from '../components/BottomNavigation';
import ConfirmDialog from '../components/ConfirmDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import {APP_VERSION} from '../constants/appVersion';
import history from '../constants/versionHistory';
import {useAuth} from '../context/AuthContext';
import {theme} from '../theme';

interface HistoryDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * HistoryDialog — Modal LOCAL de PerfilScreen con el historial de versiones.
 * Adopta la estructura informativa del PerfilScreen.js de referencia
 * (proyecto Apilamiento) pero con el patrón visual de ConfirmDialog
 * (backdrop + card Vanguard: background.backdrop, background.paper,
 * radius.lg, shadows.modal, padding spacing[6], maxWidth 400 — §17).
 * No reutiliza ConfirmDialog (es de confirmación); componente local (Ley 4).
 */
function HistoryDialog({visible, onClose}: HistoryDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <Text style={styles.dialogTitle}>Historial de versiones</Text>
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={styles.dialogContent}>
            {history.map(entry => (
              <View key={entry.version} style={styles.historyEntry}>
                <Text style={styles.historyVersion}>
                  v{entry.version} · {entry.fecha}
                </Text>
                {entry.cambios.map((cambio, index) => (
                  <Text key={index} style={styles.historyChange}>
                    • {cambio}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <AppButton
            label="Cerrar"
            variant="secondary"
            onPress={onClose}
            accessibilityLabel="Cerrar historial de versiones"
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Perfil (Sistema de Diseño Mobile Vanguard, §2.3 + blueMain):
 * estructura UX referencial del PerfilScreen.js de Apilamiento adaptada con
 * componentes propios Vanguard (AppCard/AppButton/AppIconButton/Modal local)
 * — Sin react-native-paper. Tarjeta de perfil con avatar (inicial del
 * nombre), nombre, DNI y rol; sección "Información de la Cuenta" (filas
 * label/valor Nombre · Rol · DNI); sección "Aplicación" (Versión +
 * HistoryDialog del historial de versiones); cierre de sesión con
 * ConfirmDialog (acción destructiva).
 *
 * El JWT NO trae correo (AuthUser {sub, rol, rolNombre, rolId, nombre, dni,
 * passwordResetRequired} — ApiClient.ts) → se muestra el DNI en lugar del
 * correo de la referencia.
 *
 * paddingBottom del contenido = 32 + insets.bottom + 68 (no tapa la
 * BottomNavigation).
 */
export default function PerfilScreen() {
  const {user, logout} = useAuth();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const inicial =
    (user?.nombre ?? '').trim().charAt(0).toUpperCase() || 'U';

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar el perfil"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader title="Perfil" />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom + 68},
          ]}>
          <AppCard style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{inicial}</Text>
            </View>
            <Text style={styles.name}>{user?.nombre ?? 'Usuario'}</Text>
            {/* <Text style={styles.profileLine}>DNI: {user?.dni ?? '—'}</Text> */}
            <Text style={styles.profileLine}>Perfil: {user?.rol ?? '—'}</Text>
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Información de la Cuenta</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre</Text>
              <Text style={styles.value}>{user?.nombre ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Rol</Text>
              <Text style={styles.value}>{user?.rol ?? '—'}</Text>
            </View>
            {/* <View style={styles.row}>
              <Text style={styles.label}>DNI</Text>
              <Text style={styles.value}>{user?.dni ?? '—'}</Text>
            </View> */}
          </AppCard>

          <AppCard>
            <Text style={styles.section}>Versionado de la Aplicación</Text>
            <View style={styles.row}>
              <Text style={styles.value}>Versión: {APP_VERSION}</Text>
              <AppIconButton
                name="history"
                size={22}
                color={theme.colors.action.secondary}
                accessibilityLabel="Abrir historial de versiones"
                onPress={() => setHistoryVisible(true)}
              />
            </View>
          </AppCard>

          <AppButton
            label="Cerrar sesión"
            variant="destructive"
            onPress={() => setConfirm(true)}
            accessibilityLabel="Cerrar sesión"
          />
        </ScrollView>
        <BottomNavigation active="Perfil" />
        <HistoryDialog
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
        />
        <ConfirmDialog
          visible={confirm}
          title="Cerrar sesión"
          message="¿Deseas cerrar la sesión actual?"
          confirmLabel="Cerrar sesión"
          tone="danger"
          onCancel={() => setConfirm(false)}
          onConfirm={logout}
          confirmAccessibilityLabel="Confirmar cierre de sesión"
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  content: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  profileCard: {
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[3],
  },
  avatarInitial: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 32,
    lineHeight: 40,
    color: theme.colors.text.inverse,
  },
  name: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: theme.typography.h3.fontSize,
    lineHeight: theme.typography.h3.lineHeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  profileLine: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing[1],
    textAlign: 'center',
  },
  section: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  label: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.text.secondary,
  },
  value: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.primary,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.background.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    ...theme.shadows.modal,
  },
  dialogTitle: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  dialogScroll: {
    maxHeight: 360,
    marginBottom: theme.spacing[4],
  },
  dialogContent: {
    gap: theme.spacing[2],
  },
  historyEntry: {
    marginBottom: theme.spacing[3],
  },
  historyVersion: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.action.secondary,
    marginBottom: theme.spacing[1],
  },
  historyChange: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
});