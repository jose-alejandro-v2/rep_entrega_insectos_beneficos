/**
 * EditarRequerimientoScreen — Screen 13: Edición de Requerimiento (user)
 * (MOD-18 / RF-182..185 / RN-035..036). Acceso: user sanidad.
 *
 * Comportamiento por estado:
 *  - APROBADO: todos los campos deshabilitados, sin botón Guardar (solo lectura).
 *  - ENTREGADO: formulario de liberación por lote:
 *    · Select de lote (único, solo lotes no liberados).
 *    · Cantidad muestra la cantidad entregada (no editable).
 *    · Papel/Sobre habilitados.
 *    · Select de plaga (multi, habilitado).
 *    · Fecha/Hora habilitados con defaults del sistema.
 *    · Cámara/Galería habilitados (hasta 2 fotos).
 *    · Guardar → llama crearLiberacion + sube fotos → vuelve a Screen 12.
 *
 * Notas:
 *  - Botón "Acta PDF" eliminado (evidencia = imagen).
 *  - Alerta 30h (RN-035) se muestra si pasaron >30h sin liberación.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
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
  crearLiberacion,
  eliminarFotoRequerimiento,
  extractErrorMessage,
  getFotoUrl,
  listarFotosRequerimiento,
  listarLiberaciones,
  obtenerRequerimiento,
  subirFotoRequerimiento,
  type FotoRequerimientoDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {
  cantidadDesdeTexto,
  horaActual,
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
  const [cantidadTexto, setCantidadTexto] = useState('');
  const [plagasIds, setPlagasIds] = useState<number[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState<string>('REGISTRADO');
  const [fotosExistentes, setFotosExistentes] = useState<Array<{foto: FotoRequerimientoDto; url: string}>>([]);

  // V21: campos de liberación por lote
  const [loteLiberacionId, setLoteLiberacionId] = useState<number | null>(null);
  const [papelTexto, setPapelTexto] = useState('');
  const [sobreTexto, setSobreTexto] = useState('');
  const [fechaLiberacionInput, setFechaLiberacionInput] = useState('');
  const [horaLiberacion, setHoraLiberacion] = useState('');
  const [lotesNoLiberados, setLotesNoLiberados] = useState<Array<{id: number; nombre: string}>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alerta30, setAlerta30] = useState(false);

  // Derivar modo desde el estado
  const esSoloLectura = estado === 'APROBADO';
  const esModoLiberacion = estado === 'ENTREGADO';

  // Rellena fecha/hora de liberación al agregar una foto (RN-036).
  const prevFotoCount = useRef(fotos.length);
  useEffect(() => {
    if (fotos.length > prevFotoCount.current) {
      setFechaLiberacionInput(toISODate(new Date()));
      setHoraLiberacion(horaActual());
    }
    prevFotoCount.current = fotos.length;
  }, [fotos.length]);

  const cargarRequerimiento = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await obtenerRequerimiento(id);
      setFechaInput(r.fecha);
      setFundoId(r.fundoId);
      setCantidadTexto(String(r.cantidad));
      setPlagasIds((r.plagas ?? []).map(p => p.id));
      setObservaciones(r.observaciones ?? '');
      setEstado(r.estado);
      setAlerta30(requiereAlertaLiberacion(r));

      // V21: si ENTREGADO, pre-llenar fecha/hora de liberación con defaults del sistema
      if (r.estado === 'ENTREGADO') {
        setFechaLiberacionInput(toISODate(new Date()));
        setHoraLiberacion(horaActual());
      }

      // V21: si ENTREGADO, calcular lotes no liberados
      if (r.estado === 'ENTREGADO' && r.lotes && r.lotes.length > 0) {
        try {
          const liberaciones = await listarLiberaciones(id);
          const liberadosIds = new Set(liberaciones.map(l => l.loteId));
          const noLiberados = r.lotes.filter(l => !liberadosIds.has(l.id));
          setLotesNoLiberados(noLiberados);
          if (noLiberados.length > 0) {
            setLoteLiberacionId(noLiberados[0].id);
          }
        } catch {
          setLotesNoLiberados(r.lotes);
          if (r.lotes.length > 0) {
            setLoteLiberacionId(r.lotes[0].id);
          }
        }
      }

      // Cargar fotos desde servidor
      try {
        const fotosServer = await listarFotosRequerimiento(id);
        const fotosConUrl = await Promise.all(
          fotosServer.map(async f => ({
            foto: f,
            url: await getFotoUrl(id, f.id),
          })),
        );
        setFotosExistentes(fotosConUrl);
      } catch {
        setFotosExistentes([]);
      }
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargarRequerimiento();
  }, [cargarRequerimiento]);

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

  // V21: guardar liberación (solo ENTREGADO)
  const guardarLiberacion = async () => {
    if (!esModoLiberacion || loteLiberacionId == null) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fundoParaLiberacion = fundoId ?? 0;
      await crearLiberacion(id, {
        fundoId: fundoParaLiberacion,
        loteId: loteLiberacionId,
        cantidadLiberada: cantidadDesdeTexto(cantidadTexto),
        papelConPostura: cantidadDesdeTexto(papelTexto) || undefined,
        sobreConCascarilla: cantidadDesdeTexto(sobreTexto) || undefined,
        horaLiberacion: horaLiberacion || horaActual(),
        observaciones: observaciones.trim() || undefined,
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

  const opcionesLote = lotesNoLiberados.map(l => ({label: l.nombre, value: l.id}));
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
          title={esSoloLectura ? 'Detalle Requerimiento' : 'Liberar Requerimiento'}
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
                <AppInput
                  label="Cantidad (millares)"
                  value={cantidadTexto}
                  editable={false}
                  accessibilityLabel="Cantidad"
                />

                {/* ---- APROBADO: solo lectura ---- */}
                {esSoloLectura && (
                  <Text style={styles.ayuda}>
                    Este requerimiento está Aprobado. No hay campos editables.
                  </Text>
                )}

                {/* ---- ENTREGADO: formulario de liberación por lote ---- */}
                {esModoLiberacion && (
                  <>
                    <Text style={styles.subtitulo}>Liberar lote</Text>
                    {lotesNoLiberados.length === 0 ? (
                      <Text style={styles.ayuda}>Todos los lotes ya fueron liberados.</Text>
                    ) : (
                      <SelectField
                        label="Lote a liberar"
                        accessibilityLabel="Lote a liberar"
                        optionAccessibilityPrefix="Opción Lote"
                        value={lotesNoLiberados.find(l => l.id === loteLiberacionId)?.nombre ?? ''}
                        options={opcionesLote}
                        onSelect={v => setLoteLiberacionId(Number(v))}
                        disabled={false}
                      />
                    )}

                    <Text style={styles.subtitulo}>Presentaciones entregadas</Text>
                    <AppInput
                      label="Papel con postura"
                      value={papelTexto}
                      onChangeText={setPapelTexto}
                      keyboardType="number-pad"
                      editable={esModoLiberacion}
                      maxLength={6}
                      accessibilityLabel="Papel con postura"
                    />
                    <AppInput
                      label="Sobre con cascarilla de arroz"
                      value={sobreTexto}
                      onChangeText={setSobreTexto}
                      keyboardType="number-pad"
                      editable={esModoLiberacion}
                      maxLength={6}
                      accessibilityLabel="Sobre con cascarilla"
                    />

                    <Text style={styles.subtitulo}>Plaga objetivo</Text>
                    <MultiSelectField
                      label="Plaga"
                      accessibilityLabel="Plaga objetivo"
                      optionAccessibilityPrefix="Opción Plaga"
                      selectedValues={plagasIds}
                      options={opcionesPlaga}
                      onSelect={setPlagasIds}
                      disabled={!esModoLiberacion}
                    />

                    <DateTimePickerField
                      label="Fecha de liberación"
                      value={fechaLiberacionInput}
                      mode="date"
                      onChange={setFechaLiberacionInput}
                      onClear={() => setFechaLiberacionInput('')}
                      editable={esModoLiberacion}
                      accessibilityLabel="Fecha de liberación"
                    />
                    <DateTimePickerField
                      label="Hora de liberación"
                      value={horaLiberacion}
                      mode="time"
                      onChange={setHoraLiberacion}
                      onClear={() => setHoraLiberacion('')}
                      editable={esModoLiberacion}
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
                      label="Guardar liberación"
                      icon="content-save-outline"
                      loading={saving}
                      disabled={loteLiberacionId == null || lotesNoLiberados.length === 0}
                      onPress={guardarLiberacion}
                      accessibilityLabel="Guardar liberación"
                    />
                  </>
                )}
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
  subtitulo: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  ayuda: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
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
