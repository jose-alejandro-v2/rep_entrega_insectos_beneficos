/**
 * EditarRequerimientoScreen — Screen 13: Edición de Requerimiento (user)
 * (MOD-18 / RF-182..185 / RN-035..036). Acceso: user sanidad.
 *
 * Mismos campos de Screen 10 pre-cargados (base solo lectura), más:
 *  - Fecha y Hora de liberación: se auto-completan con los metadatos del
 *    sistema al tomar la foto (RN-036).
 *  - Botón Foto (cámara/galería, hasta 2); carga fotos existentes del
 *    servidor, sube nuevas fotos y permite eliminar fotos del servidor.
 *  - Alerta permanente de 30 h (RN-035): si desde que el estado pasó a
 *    RECIBIDO transcurrió >30 h sin foto de liberación.
 *  - Botón "Actualizar" → guarda, sube fotos y vuelve a Screen 12.
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import AppInput from '../components/AppInput';
import DateTimePickerField from '../components/DateTimePickerField';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import SelectField from '../components/SelectField';
import MultiSelectField from '../components/MultiSelectField';
import {usePhotoCapture} from '../hooks/usePhotoCapture';
import {useRequerimientosCatalogos} from '../hooks/useRequerimientosCatalogos';
import type {RootStackParamList} from '../navigation/types';
import {
  actualizarRequerimiento,
  eliminarFotoRequerimiento,
  extractErrorMessage,
  getFotoUrl,
  listarFotosRequerimiento,
  obtenerRequerimiento,
  obtenerStockEspecie,
  subirFotoRequerimiento,
  type FotoRequerimientoDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {
  cantidadDesdeTexto,
  horaActual,
  hoyISO,
  requiereAlertaLiberacion,
  toISODate,
} from '../utils/requerimientos';
import RequerimientoStatusChip from '../components/RequerimientoStatusChip';
import {formatFecha} from '../utils/programacion';

type Route = RouteProp<RootStackParamList, 'EditarRequerimiento'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MAX_PHOTOS = 2;

export default function EditarRequerimientoScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const id = route.params.id;
  const catalogo = useRequerimientosCatalogos();
  const {
    fotos,
    fotoError,
    tomarFoto,
    seleccionarFoto,
    quitarFoto,
  } = usePhotoCapture(MAX_PHOTOS);

  const [fechaInput, setFechaInput] = useState('');
  const [fundoId, setFundoId] = useState<number | null>(null);
  const [loteId, setLoteId] = useState<number | null>(null);
  const [lotesIds, setLotesIds] = useState<number[]>([]);
  const [especieId, setEspecieId] = useState<number | null>(null);
  const [etapaId, setEtapaId] = useState<number | null>(null);
  const [cantidadTexto, setCantidadTexto] = useState('');
  const [plagaId, setPlagaId] = useState<number | null>(null);
  const [plagasIds, setPlagasIds] = useState<number[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [fechaLiberacionInput, setFechaLiberacionInput] = useState('');
  const [horaLiberacion, setHoraLiberacion] = useState('');
  const [estado, setEstado] = useState<string>('REGISTRADO');
  const [stock, setStock] = useState<number | null>(null);
  const [fotosExistentes, setFotosExistentes] = useState<Array<{foto: FotoRequerimientoDto; url: string}>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alerta30, setAlerta30] = useState(false);

  // Rellena fecha/hora de liberación al agregar una foto (RN-036).
  const prevFotoCount = useRef(fotos.length);
  useEffect(() => {
    if (fotos.length > prevFotoCount.current) {
      setFechaLiberacionInput(toISODate(new Date()));
      setHoraLiberacion(horaActual());
    }
    prevFotoCount.current = fotos.length;
  }, [fotos.length]);

  useEffect(() => {
    let activo = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await obtenerRequerimiento(id);
        if (!activo) { return; }
        setFechaInput(r.fecha);
        setFundoId(r.fundoId);
        setLoteId(r.loteId);
        setLotesIds((r.lotes ?? []).map(l => l.id));
        setEspecieId(r.especieId);
        setEtapaId(r.etapaFenologicaId);
        setCantidadTexto(String(r.cantidad));
        setPlagaId(r.plagaId);
        setPlagasIds((r.plagas ?? []).map(p => p.id));
        setObservaciones(r.observaciones ?? '');
        setFechaLiberacionInput(r.fechaLiberacion ?? '');
        setHoraLiberacion(r.horaLiberacion ?? '');
        setEstado(r.estado);
        setAlerta30(requiereAlertaLiberacion(r));

        // Stock
        try {
          const s = await obtenerStockEspecie(r.especieId);
          if (activo) { setStock(s.stock); }
        } catch {
          if (activo) { setStock(null); }
        }

        // Cargar fotos desde servidor
        try {
          const fotosServer = await listarFotosRequerimiento(id);
          if (!activo) { return; }
          const fotosConUrl = await Promise.all(
            fotosServer.map(async f => ({
              foto: f,
              url: await getFotoUrl(id, f.id),
            })),
          );
          setFotosExistentes(fotosConUrl);
        } catch {
          if (activo) { setFotosExistentes([]); }
        }
      } catch (e) {
        if (activo) {
          setError(extractErrorMessage(e));
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, [id]);

  const eliminarFotoServidor = async (fotoId: number) => {
    try {
      try {
        await eliminarFotoRequerimiento(id, fotoId);
      } catch {
        // Silenciar — el usuario puede reintentar
      }
      setFotosExistentes(prev => prev.filter(item => item.foto.id !== fotoId));
    } catch {
      // Silenciar — el usuario puede reintentar
    }
  };

  const actualizar = async () => {
    setSaving(true);
    setError(null);
    try {
      await actualizarRequerimiento(id, {
        fecha: fechaInput || hoyISO(),
        fundoId: fundoId!,
        loteId: loteId ?? undefined,
        lotes: lotesIds.length > 0 ? lotesIds : [loteId!],
        especieId: especieId!,
        etapaFenologicaId: etapaId,
        cantidad: cantidadDesdeTexto(cantidadTexto),
        plagaId: plagaId ?? null,
        plagas: plagasIds,
        estado: estado as never,
        fechaLiberacion: fechaLiberacionInput || null,
        horaLiberacion: horaLiberacion.trim() || null,
        observaciones: observaciones.trim() || null,
      });
      // Subir fotos nuevas al servidor
      for (const foto of fotos) {
        try {
          await subirFotoRequerimiento(id, {
            uri: foto.uri,
            type: foto.type,
            name: foto.fileName,
          }, JSON.stringify({tipo: 'LIBERACION'}));
        } catch {
          // Silenciar — la foto se subirá en el próximo sync
        }
      }
      navigation.goBack();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const opcionesFundo = catalogo.fundos.map(f => ({label: f.nombre, value: f.id}));
  const opcionesLote = catalogo.lotes.map(l => ({label: l.nombre, value: l.id}));
  const opcionesEspecie = catalogo.especies.map(e => ({label: e.nombre, value: e.id}));
  const opcionesEtapa = catalogo.etapas.map(e => ({label: e.nombre, value: e.id}));
  const opcionesPlaga = catalogo.plagas.map(p => ({label: p.nombre, value: p.id}));

  if (error) {
    return (
      <ErrorBoundary
        fallbackTitle="No se pudo cargar el requerimiento"
        fallbackMessage="Reintente nuevamente o cierre su sesión.">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <AppHeader title="Editar Requerimiento" showBack onBack={navigation.goBack} />
          <ErrorState onRetry={undefined} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar el requerimiento"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title="Editar Requerimiento"
          showBack
          onBack={navigation.goBack}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              {paddingBottom: 32 + insets.bottom},
            ]}
            keyboardShouldPersistTaps="handled">
            {loading ? (
              <LoadingState message="Cargando requerimiento…" />
            ) : (
              <>
                <View style={styles.estadoChip}>
                  <RequerimientoStatusChip estado={estado as never} />
                </View>

                {alerta30 ? (
                  <View
                    accessibilityRole="alert"
                    style={styles.alerta30}>
                    <Text style={styles.alerta30Text}>
                      {`Alerta: No se ingresó la información de la liberación, fecha de solicitud: ${formatFecha(fechaInput)}`}
                    </Text>
                  </View>
                ) : null}

                <DateTimePickerField
                  label="Fecha"
                  value={fechaInput}
                  mode="date"
                  onChange={setFechaInput}
                  editable={false}
                  accessibilityLabel="Fecha"
                />
                <SelectField
                  label="Fundo"
                  accessibilityLabel="Fundo"
                  optionAccessibilityPrefix="Opción Fundo"
                  value={catalogo.fundos.find(f => f.id === fundoId)?.nombre ?? ''}
                  options={opcionesFundo}
                  onSelect={v => setFundoId(Number(v))}
                  disabled
                />
                <MultiSelectField
                  label="Lote"
                  accessibilityLabel="Lote"
                  optionAccessibilityPrefix="Opción Lote"
                  selectedValues={lotesIds}
                  options={opcionesLote}
                  onSelect={setLotesIds}
                  disabled
                />
                <SelectField
                  label="Especie"
                  accessibilityLabel="Especie"
                  optionAccessibilityPrefix="Opción Especie"
                  value={catalogo.especies.find(e => e.id === especieId)?.nombre ?? ''}
                  options={opcionesEspecie}
                  onSelect={v => setEspecieId(Number(v))}
                  disabled
                />
                <SelectField
                  label="Etapa fenológica"
                  accessibilityLabel="Etapa fenológica"
                  optionAccessibilityPrefix="Opción Etapa"
                  value={catalogo.etapas.find(e => e.id === etapaId)?.nombre ?? ''}
                  options={opcionesEtapa}
                  onSelect={v => setEtapaId(Number(v))}
                  disabled
                />
                <AppInput
                  label="Cantidad (millares)"
                  value={cantidadTexto}
                  editable={false}
                  accessibilityLabel="Cantidad"
                />
                <View style={styles.stockBlock}>
                  <Text style={styles.stockLabel}>Stock disponible</Text>
                  <Text style={styles.stockValue} accessibilityLabel="Stock disponible">
                    {stock != null ? `${stock} millares` : 'Cargando…'}
                  </Text>
                </View>
                <MultiSelectField
                  label="Plaga objetivo"
                  accessibilityLabel="Plaga objetivo"
                  optionAccessibilityPrefix="Opción Plaga"
                  selectedValues={plagasIds}
                  options={opcionesPlaga}
                  onSelect={setPlagasIds}
                  disabled
                />
                <AppInput
                  label="Observaciones"
                  value={observaciones}
                  onChangeText={setObservaciones}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  accessibilityLabel="Observaciones"
                />
                <DateTimePickerField
                  label="Fecha de liberación"
                  value={fechaLiberacionInput}
                  mode="date"
                  onChange={setFechaLiberacionInput}
                  onClear={() => setFechaLiberacionInput('')}
                  accessibilityLabel="Fecha de liberación"
                />
                <DateTimePickerField
                  label="Hora de liberación"
                  value={horaLiberacion}
                  mode="time"
                  onChange={setHoraLiberacion}
                  onClear={() => setHoraLiberacion('')}
                  accessibilityLabel="Hora de liberación"
                />

                <Text style={styles.fotoTitulo}>Foto de liberación</Text>
                {fotosExistentes.length > 0 && (
                  <View style={styles.fotoPreviews}>
                    {fotosExistentes.map(({foto, url}, idx) => (
                      <View key={String(foto.id)} style={styles.fotoPreview}>
                        <Image
                          source={{uri: url}}
                          style={styles.fotoImagen}
                        />
                        <Text style={styles.fotoPreviewText}>Servidor {idx + 1}</Text>
                        <AppButton
                          label="Quitar"
                          icon="delete-outline"
                          variant="text"
                          onPress={() => eliminarFotoServidor(foto.id)}
                          accessibilityLabel={`Quitar foto del servidor ${idx + 1}`}
                        />
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.fotoAcciones}>
                  <View style={styles.fotoAccion}>
                    <AppButton
                      label="Cámara"
                      icon="camera-outline"
                      variant="secondary"
                      disabled={fotos.length + fotosExistentes.length >= MAX_PHOTOS}
                      onPress={tomarFoto}
                      accessibilityLabel="Tomar foto de liberación"
                    />
                  </View>
                  <View style={styles.fotoAccion}>
                    <AppButton
                      label="Galería"
                      icon="image-outline"
                      variant="secondary"
                      disabled={fotos.length + fotosExistentes.length >= MAX_PHOTOS}
                      onPress={seleccionarFoto}
                      accessibilityLabel="Seleccionar foto de liberación de la galería"
                    />
                  </View>
                </View>
                {fotoError ? (
                  <Text accessibilityRole="alert" style={styles.fotoError}>
                    {fotoError}
                  </Text>
                ) : null}
                <View style={styles.fotoPreviews}>
                  {fotos.map((foto, idx) => (
                    <View key={foto.uri} style={styles.fotoPreview}>
                      <Image source={{uri: foto.uri}} style={styles.fotoImagen} />
                      <Text style={styles.fotoPreviewText}>Local {idx + 1}</Text>
                      <AppButton
                        label="Quitar"
                        icon="delete-outline"
                        variant="text"
                        onPress={() => quitarFoto(idx)}
                        accessibilityLabel={`Quitar foto de liberación ${idx + 1}`}
                      />
                    </View>
                  ))}
                </View>

                <AppButton
                  label="Actualizar"
                  icon="content-save-outline"
                  loading={saving}
                  onPress={actualizar}
                  accessibilityLabel="Actualizar requerimiento"
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing[4],
  },
  estadoChip: {
    marginBottom: theme.spacing[3],
  },
  alerta30: {
    backgroundColor: theme.colors.status.errorBackground,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.status.error,
  },
  alerta30Text: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.status.error,
  },
  stockBlock: {
    marginBottom: theme.spacing[3],
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
  },
  stockLabel: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 2,
  },
  stockValue: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    fontSize: theme.typography.subtitle1.fontSize,
    color: theme.colors.text.primary,
  },
  fotoTitulo: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  fotoPreviews: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    flexWrap: 'wrap',
    marginBottom: theme.spacing[2],
  },
  fotoAcciones: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  fotoAccion: {
    flex: 1,
  },
  fotoError: {
    color: theme.colors.status.error,
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing[2],
  },
  fotoPreview: {
    width: 112,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background.neutral,
    alignItems: 'center',
    paddingTop: theme.spacing[1],
  },
  fotoImagen: {
    width: 104,
    height: 76,
    borderRadius: theme.radius.sm,
  },
  fotoPreviewText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
});
