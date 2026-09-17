/**
 * MessageDialog — Modal centrado de notificacion del Sistema de Diseño Mobile
 * Vanguard (§17, §27). Reemplaza banners inline que el usuario no nota.
 *
 * - Fondo: backdrop rgba(22,28,36,0.48); card blanca radio 16 px, sombra modal.
 * - Icono centrado por tono (check-circle-outline / alert-circle-outline).
 * - Boton unico de cierre ("Aceptar").
 * - Accesibilidad: accessibilityViewIsModal + labels explicitos.
 */

import React from 'react';
import {Modal, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {theme} from '../theme';
import AppButton from './AppButton';

export type MessageTone = 'success' | 'error';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  tone: MessageTone;
  buttonLabel?: string;
  onClose: () => void;
  /** Label de accesibilidad del boton (distinto del texto). */
  accessibilityLabel?: string;
}

export default function MessageDialog({
  visible,
  title,
  message,
  tone,
  buttonLabel = 'Aceptar',
  onClose,
  accessibilityLabel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name={
              tone === 'success' ? 'check-circle-outline' : 'alert-circle-outline'
            }
            size={48}
            color={
              tone === 'success'
                ? theme.colors.status.success
                : theme.colors.status.error
            }
            style={styles.icon}
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <AppButton
                label={buttonLabel}
                variant="primary"
                onPress={onClose}
                accessibilityLabel={accessibilityLabel ?? buttonLabel}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.background.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    alignItems: 'center',
    ...theme.shadows.modal,
  },
  icon: {
    marginBottom: theme.spacing[3],
  },
  title: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing[2],
  },
  message: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing[6],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  actionButton: {
    width: '60%',
  },
});
