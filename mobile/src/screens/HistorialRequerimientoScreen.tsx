/**
 * HistorialRequerimientoScreen — Screen 12: Historial de Requerimientos
 * (MOD-18 / RF-179..181). Acceso: user sanidad.
 *
 * Estructura:
 *  1. Filtro de rango de fechas (desde-hasta).
 *  2. Galería vertical: fecha, especie y estado con color; botón Ver (popup
 *     detalle) y botón Editar (→ Screen 13).
 */

import React, {useCallback, useEffect, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  getFotoUrl,
  listarFotosRequerimiento,
  listarRequerimientos,
  type FotoRequerimientoDto,
  type RequerimientoDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {formatFecha} from '../utils/programacion';
import {esRangoValido, toISODate} from '../utils/requerimientos';

/** Lunes de la semana en curso (ISO date). */
function lunesSemanaActual(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return toISODate(monday);
}

/** Hoy en ISO date. */
function hoy(): string {
  return toISODate(new Date());
}

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function VerModal({
  req,
  onClose,
}: {
  req: RequerimientoDto | null;
  onClose: () => void;
}) {
  const [fotosUrls, setFotosUrls] = useState<Array<{foto: FotoRequerimientoDto; url: string}>>([]);
  const [loadingFotos, setLoadingFotos] = useState(false);

  useEffect(() => {
    if (!req) {
      setFotosUrls([]);
      return;
    }
    let activo = true;
    (async () => {
      setLoadingFotos(true);
      try {
        const fotos = await listarFotosRequerimiento(req.id);
        if (!activo) { return; }
        const urls = await Promise.all(
          fotos.map(async foto => ({
            foto,
            url: await getFotoUrl(req.id, foto.id),
          })),
        );
        if (activo) { setFotosUrls(urls); }
      } catch {
        if (activo) { setFotosUrls([]); }
      } finally {
        if (activo) { setLoadingFotos(false); }
      }
    })();
    return () => {
      activo = false;
    };
  }, [req]);

  if (!req) {
    return null;
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
    <Modal
      visible={req !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalle del requerimiento</Text>
            <RequerimientoStatusChip estado={req.estado} />
          </View>
          <ScrollView>
            {filas.map(([label, valor]) => (
              <View key={label} style={styles.verRow}>
                <Text style={styles.verLabel}>{label}</Text>
                <Text style={styles.verValue}>{valor}</Text>
              </View>
            ))}
            {loadingFotos ? (
              <LoadingState message="Cargando fotos…" />
            ) : fotosUrls.length > 0 ? (
              <View style={styles.fotosSection}>
                <Text style={styles.fotosSectionTitle}>Evidencia fotográfica</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {fotosUrls.map(({foto, url}, idx) => (
                    <View key={String(foto.id)} style={styles.fotoThumbnail}>
                      <Image source={{uri: url}} style={styles.fotoImagen} />
                      <Text style={styles.fotoCaption}>Foto {idx + 1}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.modalActions}>
            <View style={styles.modalAction}>
              <AppButton
                label="Cerrar"
                variant="secondary"
                onPress={onClose}
                accessibilityLabel="Cerrar detalle de requerimiento"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HistorialRequerimientoScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();

  const [desdeTexto, setDesdeTexto] = useState(lunesSemanaActual);
  const [hastaTexto, setHastaTexto] = useState(hoy);
  const [reqs, setReqs] = useState<RequerimientoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<RequerimientoDto | null>(null);

  const cargar = useCallback(
    async (desdeISO: string | null, hastaISO: string | null) => {
      if (!user) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const reqsDto = await listarRequerimientos({
          fechaDesde: desdeISO ?? undefined,
          fechaHasta: hastaISO ?? undefined,
          creadoPor: Number(user?.sub) || 0,
        });

        setReqs(reqsDto);
      } catch (e) {
        setError(extractErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Auto-cargar con fechas por defecto (lunes→hoy de la semana en curso)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    cargar(desdeTexto || null, hastaTexto || null);
  }, [cargar]);

  const aplicarFiltro = () => {
    const desdeISO = desdeTexto || lunesSemanaActual();
    const hastaISO = hastaTexto || hoy();
    if (!esRangoValido(desdeISO, hastaISO)) {
      setError('Rango de fechas inválido. Use dd/mm/aaaa con desde ≤ hasta.');
      return;
    }
    cargar(desdeISO, hastaISO);
  };

  const limpiarFiltro = () => {
    setDesdeTexto(lunesSemanaActual());
    setHastaTexto(hoy());
    cargar(lunesSemanaActual(), hoy());
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
      return <LoadingState message="Cargando historial…" />;
    }
    if (error) {
      return <ErrorState onRetry={() => cargar(desdeTexto || lunesSemanaActual(), hastaTexto || hoy())} />;
    }
    if (reqs.length === 0) {
      return (
        <EmptyState
          title="Sin requerimientos en el rango"
          message="No hay requerimientos registrados para este periodo."
          icon="history"
        />
      );
    }
    return (
      <View style={styles.list}>
        {reqs.map(r => (
          <AppCard key={r.id} style={styles.card}>
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
                label="Ver"
                variant="text"
                icon="eye-outline"
                onPress={() => {
                  setVer(r);
                }}
                accessibilityLabel={`Ver ${r.especie}`}
              />
              <AppButton
                label="Editar"
                variant="text"
                icon="pencil-outline"
                onPress={() =>
                  navigation.navigate('EditarRequerimiento', {id: r.id})
                }
                accessibilityLabel={`Editar ${r.especie}`}
              />
            </View>
          </AppCard>
        ))}
      </View>
    );
  };

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar el historial"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title="Historial de Requerimiento"
          showBack
          onBack={navigation.goBack}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom},
          ]}>
          {renderFiltro}
          {renderContenido()}
        </ScrollView>
        <VerModal req={ver} onClose={() => setVer(null)} />
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.background.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    ...theme.shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  modalTitle: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    flex: 1,
  },
  verRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  verLabel: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    color: theme.colors.text.secondary,
  },
  verValue: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
    marginTop: theme.spacing[4],
  },
  modalAction: {
    flex: 1,
  },
  fotosSection: {
    marginTop: theme.spacing[3],
  },
  fotosSectionTitle: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  fotoThumbnail: {
    width: 104,
    alignItems: 'center',
    marginRight: theme.spacing[2],
  },
  fotoImagen: {
    width: 96,
    height: 72,
    borderRadius: theme.radius.sm,
  },
  fotoCaption: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
});
