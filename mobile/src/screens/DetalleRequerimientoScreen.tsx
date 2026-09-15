/**
 * DetalleRequerimientoScreen — Detalle de un requerimiento con acciones
 * contextuales por estado (HITO-015).
 *
 * Muestra la info del requerimiento y botones de acción según estado:
 * - APROBADO → Despachos
 * - ENTREGADO → Recepciones
 * - RECIBIDO → Liberaciones
 */

import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppHeader from '../components/AppHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import RequerimientoStatusChip from '../components/RequerimientoStatusChip';
import type {RootStackParamList} from '../navigation/types';
import {
  extractErrorMessage,
  obtenerRequerimiento,
  type RequerimientoDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {formatFecha} from '../utils/programacion';

type Route = RouteProp<RootStackParamList, 'DetalleRequerimiento'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export default function DetalleRequerimientoScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const {id} = route.params;

  const [req, setReq] = useState<RequerimientoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerRequerimiento(id);
      setReq(data);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const renderContent = () => {
    if (loading) {
      return <LoadingState message="Cargando detalle…" />;
    }
    if (error) {
      return <ErrorState onRetry={cargar} />;
    }
    if (!req) {
      return <ErrorState title="Requerimiento no encontrado" />;
    }

    const lotesTexto =
      req.lotes?.length > 0
        ? req.lotes.map(l => l.nombre).join(', ')
        : req.lote;
    const plagasTexto =
      req.plagas?.length > 0
        ? req.plagas.map(p => p.nombre).join(', ')
        : req.plaga;
    const filas: Array<[string, string]> = [
      ['Fecha', formatFecha(req.fecha)],
      ['Fundo', req.fundo],
      ['Lote', lotesTexto],
      ['Especie', req.especie],
      ['Cantidad', `${req.cantidad} millares`],
      ['Plaga objetivo', plagasTexto || '—'],
      ['Fecha de liberación', formatFecha(req.fechaLiberacion)],
      ['Observaciones', req.observaciones ?? '—'],
    ];

    return (
      <>
        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{req.especie}</Text>
            <RequerimientoStatusChip estado={req.estado} />
          </View>
          {filas.map(([label, valor]) => (
            <View key={label} style={styles.fila}>
              <Text style={styles.filaLabel}>{label}</Text>
              <Text style={styles.filaValor}>{valor}</Text>
            </View>
          ))}
        </AppCard>

        <View style={styles.actions}>
          {req.estado === 'APROBADO' && (
            <AppButton
              label="Despachos"
              icon="truck-delivery-outline"
              onPress={() =>
                navigation.navigate('DespachoList', {requerimientoId: id})
              }
              accessibilityLabel="Ver despachos"
            />
          )}
          {req.estado === 'ENTREGADO' && (
            <AppButton
              label="Recepciones"
              icon="package-check"
              onPress={() =>
                navigation.navigate('RecepcionList', {requerimientoId: id})
              }
              accessibilityLabel="Ver recepciones"
            />
          )}
          {(req.estado === 'ENTREGADO' || req.estado === 'LIBERADO') && (
            <AppButton
              label="Liberaciones"
              icon="bug-outline"
              onPress={() =>
                navigation.navigate('LiberacionList', {requerimientoId: id})
              }
              accessibilityLabel="Ver liberaciones"
            />
          )}
        </View>
      </>
    );
  };

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar el detalle"
      fallbackMessage="Reintente nuevamente.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title="Detalle Requerimiento"
          showBack
          onBack={navigation.goBack}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom},
          ]}>
          {renderContent()}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing[4],
    gap: theme.spacing[4],
  },
  card: {
    gap: theme.spacing[2],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  cardTitle: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    fontSize: theme.typography.subtitle1.fontSize,
    lineHeight: theme.typography.subtitle1.lineHeight,
    color: theme.colors.text.primary,
    flex: 1,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  filaLabel: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    color: theme.colors.text.secondary,
  },
  filaValor: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    gap: theme.spacing[3],
  },
});
