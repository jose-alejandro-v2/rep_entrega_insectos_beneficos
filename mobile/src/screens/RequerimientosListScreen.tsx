/**
 * RequerimientosListScreen — Screen 7: Listado de Solicitudes de Requerimiento
 * (MOD-18 / RF-152..157). Acceso: admin i+d.
 *
 * Estructura:
 *  1. Filtro de rango de fechas (desde-hasta, formato dd/mm/aaaa).
 *  2. Galería vertical de registros: fecha, especie y estado con color
 *     (RF-154, colores exactos RN-022).
 *  3. Botón "Nuevo" → Screen 8 en modo creación (RF-156).
 *  4. Botón "Editar" por registro → Screen 8 en modo edición (RF-157).
 */

import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppHeader from '../components/AppHeader';
import DateTimePickerField from '../components/DateTimePickerField';
import EmptyState from '../components/EmptyState';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import RequerimientoStatusChip from '../components/RequerimientoStatusChip';
import {useAuth} from '../context/AuthContext';
import type {RootStackParamList} from '../navigation/types';
import {
  extractErrorMessage,
  listarRequerimientos,
  type RequerimientoDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {isAdminOrSuperAdmin} from '../utils/roles';
import {formatFecha} from '../utils/programacion';
import {
  esRangoValido,
  estadoInfo,
  toISODate,
} from '../utils/requerimientos';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function lunesSemanaActual(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return toISODate(monday);
}

function hoyISO(): string {
  return toISODate(new Date());
}

export default function RequerimientosListScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const puedeGestionar = isAdminOrSuperAdmin(user);

  const [desdeTexto, setDesdeTexto] = useState(lunesSemanaActual);
  const [hastaTexto, setHastaTexto] = useState(hoyISO);
  const [reqs, setReqs] = useState<RequerimientoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (desdeISO: string | null, hastaISO: string | null) => {
      if (!puedeGestionar) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const reqsDto = await listarRequerimientos({
          fechaDesde: desdeISO ?? undefined,
          fechaHasta: hastaISO ?? undefined,
        });

        setReqs(reqsDto);
      } catch (e) {
        setError(extractErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [puedeGestionar],
  );

  // Auto-cargar con fechas por defecto (lunes→hoy de la semana en curso)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    cargar(desdeTexto || null, hastaTexto || null);
  }, [cargar]);

  const aplicarFiltro = () => {
    const desdeISO = desdeTexto || lunesSemanaActual();
    const hastaISO = hastaTexto || hoyISO();
    if (!esRangoValido(desdeISO, hastaISO)) {
      setError('Rango de fechas inválido. Use dd/mm/aaaa con desde ≤ hasta.');
      return;
    }
    cargar(desdeISO, hastaISO);
  };

  const limpiarFiltro = () => {
    setDesdeTexto(lunesSemanaActual());
    setHastaTexto(hoyISO());
    cargar(lunesSemanaActual(), hoyISO());
  };

  const renderFiltro = (
    <View style={styles.filtro}>
      <DateTimePickerField
        label="Desde"
        value={desdeTexto}
        mode="date"
        onChange={setDesdeTexto}
        onClear={() => setDesdeTexto('')}
        accessibilityLabel="Desde"
      />
      <DateTimePickerField
        label="Hasta"
        value={hastaTexto}
        mode="date"
        onChange={setHastaTexto}
        onClear={() => setHastaTexto('')}
        accessibilityLabel="Hasta"
      />
      <View style={styles.filtroAcciones}>
        <View style={styles.filtroAction}>
          <AppButton
            label="Aplicar filtro"
            icon="filter-outline"
            onPress={aplicarFiltro}
            accessibilityLabel="Aplicar filtro"
          />
        </View>
        <View style={styles.filtroAction}>
          <AppButton
            label="Limpiar"
            variant="text"
            onPress={limpiarFiltro}
            accessibilityLabel="Limpiar filtro"
          />
        </View>
      </View>
    </View>
  );

  const renderContenido = () => {
    if (loading) {
      return <LoadingState message="Cargando solicitudes…" />;
    }
    if (error) {
      return <ErrorState onRetry={() => cargar(desdeTexto || lunesSemanaActual(), hastaTexto || hoyISO())} />;
    }
    if (reqs.length === 0) {
      return (
        <EmptyState
          title="Sin solicitudes en el rango"
          message="No hay solicitudes de requerimiento registradas para este periodo."
          icon="file-document-outline"
        />
      );
    }
    return (
      <View style={styles.list}>
        {reqs.map(r => {
          const info = estadoInfo(r.estado);
          const botonLabel =
            r.estado === 'REGISTRADO'
              ? 'Por Aprobar'
              : r.estado === 'APROBADO'
              ? 'Por Entregar'
              : r.estado === 'ENTREGADO'
              ? 'Revisar'
              : 'Editar';
          const esReadOnly = r.estado === 'ENTREGADO';
          return (
          <AppCard key={r.id} style={[styles.card, info.bg ? {backgroundColor: info.bg} : undefined]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitle}>
                <Text style={styles.cardTitleText}>{r.especie}</Text>
                <Text style={styles.cardSub}>
                  {formatFecha(r.fecha)} · {r.fundo}
                </Text>
              </View>
              <RequerimientoStatusChip estado={r.estado} />
            </View>
            <View style={styles.cardActions}>
              <AppButton
                label={botonLabel}
                variant="text"
                icon={esReadOnly ? 'eye-outline' : 'pencil-outline'}
                onPress={() =>
                  navigation.navigate('RequerimientoForm', {
                    id: r.id,
                    readOnly: esReadOnly,
                  })
                }
                accessibilityLabel={`${botonLabel} ${r.especie}`}
              />
            </View>
          </AppCard>
          );
        })}
      </View>
    );
  };

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar las solicitudes"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title="Solicitudes de Requerimiento"
          showBack
          onBack={navigation.goBack}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom},
          ]}>
          {puedeGestionar ? (
            <>
              {renderFiltro}
              <AppButton
                label="Nuevo"
                icon="plus"
                onPress={() => navigation.navigate('RequerimientoForm', {})}
                accessibilityLabel="Crear nueva solicitud"
              />
              {renderContenido()}
            </>
          ) : (
            <ErrorState
              title="Acceso restringido"
              message="Esta sección solo está disponible para el perfil admin (I+D)."
              onRetry={undefined}
            />
          )}
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
  filtro: {
    gap: theme.spacing[1],
  },
  filtroAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
  filtroAction: {
    flex: 1,
  },
  list: {
    gap: theme.spacing[3],
  },
  card: {
    gap: theme.spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
  },
  cardTitle: {
    flex: 1,
  },
  cardTitleText: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    fontSize: theme.typography.subtitle1.fontSize,
    lineHeight: theme.typography.subtitle1.lineHeight,
    color: theme.colors.text.primary,
  },
  cardSub: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
  },
});
