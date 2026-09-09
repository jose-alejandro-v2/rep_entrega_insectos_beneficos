/**
 * ProyeccionMesCard — Tabla de proyección mensual + barra de consumo vs
 * disponibilidad (Screen 6 y Screen 9, RF-149/168/171/172/179).
 *
 * Reutilizable por el panel admin (Screen 6) y el panel user (Screen 9).
 * Muestra por semana: Sem | Papel | Sobre | Total (RN-019) y una barra de
 * progreso que mide visualmente el consumo mensual vs la disponibilidad.
 *
 * La columna "Sem" muestra el número de semana calendario (1-5) basado en
 * la fecha real del detalle, con sombreado alternado por semana.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import AppCard from './AppCard';
import {theme} from '../theme';
import type {FilaProyeccion} from '../utils/requerimientos';
import {porcentajeConsumo} from '../utils/requerimientos';

/**
 * Calcula el número de semana calendario (1-5) a partir de una fecha ISO.
 * Una semana calendario inicia en Lunes. La primera semana del mes que
 * contiene un Lunes es la semana 1.
 */
function semanaCalendario(fechaISO: string): number {
  const fecha = new Date(fechaISO + 'T00:00:00');
  const dia = fecha.getDate();
  // Fórmula: semana = ((día - 1) + offset_del_dia_inicial) / 7 + 1
  // Donde offset_del_dia_inicial es el día de la semana del día 1 del mes
  const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const offset = (primerDiaMes.getDay() + 6) % 7; // 0=Lun, 1=Mar, ..., 6=Dom
  return Math.floor((dia + offset - 1) / 7) + 1;
}

interface Props {
  filas: FilaProyeccion[];
  /** Disponibilidad mensual (total de la proyección) en millares. */
  disponibilidad: number;
  /** Consumo mensual (requerimientos del mes) en millares. */
  consumo: number;
  titulo?: string;
}

export default function ProyeccionMesCard({
  filas,
  disponibilidad,
  consumo,
  titulo,
}: Props) {
  const pct = porcentajeConsumo(consumo, disponibilidad);
  const barWidth = `${Math.min(100, pct)}%` as `${number}%`;

  return (
    <AppCard style={styles.card}>
      {titulo ? <Text style={styles.title}>{titulo}</Text> : null}
      <View style={styles.tablaHeader}>
        <Text style={[styles.colSemana, styles.headerText]}>Sem</Text>
        <Text style={[styles.colProducto, styles.headerText]}>Papel</Text>
        <Text style={[styles.colProducto, styles.headerText]}>Sobre</Text>
        <Text style={[styles.colTotal, styles.headerText]}>Total</Text>
      </View>
      {filas.length === 0 ? (
        <Text style={styles.vacio}>Sin proyección registrada para el mes.</Text>
      ) : (
        filas.map((fila, index) => {
          const semCal = semanaCalendario(fila.fecha);
          // Sombreado alternado: semana impar = fondo suave, semana par = fondo claro
          const esSemanaImpar = semCal % 2 === 1;
          return (
            <View
              key={`${fila.semana}-${index}`}
              style={[
                styles.fila,
                esSemanaImpar ? styles.filaImpar : styles.filaPar,
              ]}>
              <Text style={[styles.colSemana, styles.cell]}>{String(semCal)}</Text>
              <Text style={[styles.colProducto, styles.cell]}>{String(fila.papel)}</Text>
              <Text style={[styles.colProducto, styles.cell]}>{String(fila.sobre)}</Text>
              <Text style={[styles.colTotal, styles.cell, styles.totalCell]}>
                {String(fila.total)}
              </Text>
            </View>
          );
        })
      )}
      <View style={styles.pie}>
        <Text style={styles.pieText}>{`Proyección: ${disponibilidad} millares`}</Text>
        <Text style={styles.pieText}>{`Consumido: ${consumo} millares`}</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, {width: barWidth}]} />
      </View>
      <Text style={styles.barLabel}>
        Consumo Mensual: Proyección vs Producción - {pct}%
      </Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing[2],
  },
  title: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
  },
  tablaHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
  },
  headerText: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  filaImpar: {
    backgroundColor: theme.colors.background.neutral, // #E8EDF2 - fondo suave
  },
  filaPar: {
    backgroundColor: theme.colors.background.default, // #FFFFFF - fondo claro
  },
  cell: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.primary,
  },
  totalCell: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontWeight: '600',
  },
  colSemana: {
    width: 44,
  },
  colProducto: {
    flex: 1,
  },
  colTotal: {
    width: 56,
    textAlign: 'right',
  },
  vacio: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.tertiary,
    paddingVertical: theme.spacing[2],
  },
  pie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing[2],
  },
  pieText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
  },
  barTrack: {
    height: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background.neutral,
    overflow: 'hidden',
    marginTop: theme.spacing[2],
  },
  barFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action.secondary,
  },
  barLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing[1],
  },
});
