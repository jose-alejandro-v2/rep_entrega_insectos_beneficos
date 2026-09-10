/**
 * MultiSelectField — Desplegable de selección múltiple del Sistema de Diseño
 * Mobile Vanguard. Basado en SelectField.tsx (DRY — Ley 4).
 *
 * Permite seleccionar múltiples opciones mediante checkboxes en un Modal.
 * Muestra chips con los elementos seleccionados debajo del campo.
 * Mantiene la misma estética y accesibilidad que SelectField.
 */

import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {theme} from '../theme';
import type {SelectOption} from './SelectField';

interface Props {
  label: string;
  /** IDs seleccionados. */
  selectedValues: number[];
  options: SelectOption[];
  onSelect: (values: number[]) => void;
  disabled?: boolean;
  error?: string;
  accessibilityLabel?: string;
  optionAccessibilityPrefix?: string;
  onOpen?: () => void;
}

export default function MultiSelectField({
  label,
  selectedValues,
  options,
  onSelect,
  disabled = false,
  error,
  accessibilityLabel,
  optionAccessibilityPrefix,
  onOpen,
}: Props) {
  const [open, setOpen] = useState(false);

  const abrir = () => {
    if (disabled) {
      return;
    }
    onOpen?.();
    setOpen(true);
  };

  const toggle = (optionValue: number | string) => {
    const numVal = Number(optionValue);
    const isSelected = selectedValues.includes(numVal);
    const next = isSelected
      ? selectedValues.filter(v => v !== numVal)
      : [...selectedValues, numVal];
    onSelect(next);
  };

  const seleccionadosLabels = options
    .filter(o => selectedValues.includes(Number(o.value)))
    .map(o => o.label);

  const borderColor = error
    ? theme.colors.border.error
    : theme.colors.border.default;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{disabled}}
        onPress={abrir}
        disabled={disabled}
        style={[styles.box, {borderColor}, disabled && styles.boxDisabled]}>
        <Text
          style={[styles.value, seleccionadosLabels.length === 0 && styles.placeholder]}
          numberOfLines={1}>
          {seleccionadosLabels.length > 0
            ? seleccionadosLabels.join(', ')
            : 'Seleccionar…'}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={disabled ? theme.colors.text.disabled : theme.colors.text.secondary}
        />
      </Pressable>

      {/* Chips de elementos seleccionados */}
      {seleccionadosLabels.length > 0 && (
        <View style={styles.chipsContainer}>
          {seleccionadosLabels.map(labelText => (
            <View key={labelText} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {labelText}
              </Text>
              <MaterialCommunityIcons
                name="close"
                size={14}
                color={theme.colors.text.inverse}
                style={styles.chipIcon}
              />
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            <ScrollView style={styles.list}>
              {options.map(option => {
                const isSelected = selectedValues.includes(Number(option.value));
                return (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      optionAccessibilityPrefix
                        ? `${optionAccessibilityPrefix} ${option.label}`
                        : option.label
                    }
                    accessibilityState={{selected: isSelected}}
                    onPress={() => toggle(option.value)}
                    style={[styles.option, isSelected && styles.optionSelected]}>
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={
                        isSelected
                          ? theme.colors.action.secondary
                          : theme.colors.text.secondary
                      }
                      style={styles.checkbox}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirmar selección"
              style={styles.doneButton}
              onPress={() => setOpen(false)}>
              <Text style={styles.doneButtonText}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing[3],
  },
  label: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1] + 2,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    backgroundColor: theme.colors.background.paper,
    paddingHorizontal: theme.spacing[4],
  },
  boxDisabled: {
    backgroundColor: theme.colors.background.neutral,
    opacity: 0.7,
  },
  value: {
    flex: 1,
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
  },
  placeholder: {
    color: theme.colors.text.tertiary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[1],
    marginTop: theme.spacing[1],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.action.secondary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  chipText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.inverse,
    maxWidth: 120,
  },
  chipIcon: {
    marginLeft: 4,
  },
  errorText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.status.error,
    marginTop: theme.spacing[1],
  },
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
    padding: theme.spacing[5],
    ...theme.shadows.modal,
    maxHeight: '70%',
  },
  cardTitle: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[3],
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  optionSelected: {
    backgroundColor: theme.colors.background.neutral,
  },
  checkbox: {
    marginRight: theme.spacing[2],
  },
  optionText: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
    flex: 1,
  },
  optionTextSelected: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontWeight: '600',
  },
  doneButton: {
    marginTop: theme.spacing[3],
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.action.secondary,
    borderRadius: theme.radius.sm,
  },
  doneButtonText: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: 14,
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
});
