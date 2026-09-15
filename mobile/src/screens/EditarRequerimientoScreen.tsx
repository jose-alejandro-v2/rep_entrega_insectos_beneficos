/**
 * EditarRequerimientoScreen — Screen 13: Edición de Requerimiento (user)
 * (MOD-18 / RF-182..185 / RN-035..036). Acceso: user sanidad.
 *
 * Comportamiento por estado:
 *  - APROBADO: todos los campos deshabilitados, sin botón Guardar (solo lectura).
 *  - ENTREGADO: formulario de liberación por lote (campos editables):
 *    · Select de lote (único, solo lotes no liberados).
 *    · Cantidad muestra el PENDIENTE por liberar (cantidad pedida − Σ papel+sobre
 *      de las liberaciones ya registradas), no editable (v1.12.0).
 *    · Papel/Sobre editables con defaults del restante por presentación.
 *    · Plaga multi-select (habilitada, permite 1..N).
 *    · Fecha/Hora de liberación (defaults del sistema, editables).
 *    · Fotos: "Foto de Entrega" (izq, fetch con auth) + "Foto de Liberación" (der, cámara/galería).
 *    · Guardar → llama crearLiberacion + sube fotos → vuelve a Screen 12.
 *
 * Notas:
 *  - Botón "Acta PDF" eliminado (evidencia = imagen).
 *  - Alerta 30h (RN-035) se muestra si pasaron >30h sin liberación.
 *  - V22: campos habilitados, plagas persitidas, fechaLiberacion editable.
 *  - v1.12.0: la `cantidadLiberada` persistida es papel + sobre de ESA liberación
 *    y ese total se descuenta del pendiente de la siguiente liberación.
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
import AppIconButton from '../components/AppIconButton';
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
  extractErrorMessage,
  fetchFotoBinaria,
  listarFotosRequerimiento,
  listarLiberaciones,
  obtenerRequerimiento,
  subirFotoRequerimiento,
  type FotoRequerimientoDto,
  type LiberacionDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {
  cantidadDesdeTexto,
  horaActual,
  pendienteLiberacion,
  requiereAlertaLiberacion,
  restantePresentaciones,
  toISODate,
  validarPresentacionesVsPendiente,
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
  } = usePhotoCapture(MAX_PHOTOS);

  const [fechaInput, setFechaInput] = useState('');
  const [fundoId, setFundoId] = useState<number | null>(null);
  const [cantidadTexto, setCantidadTexto] = useState('');
  const [plagasIds, setPlagasIds] = useState<number[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState<string>('REGISTRADO');
  const [fotosExistentes, setFotosExistentes] = useState<Array<{foto: FotoRequerimientoDto; dataUri: string}>>([]);

  // V21/V22: campos de liberación por lote
  const [loteLiberacionId, setLoteLiberacionId] = useState<number | null>(null);
  const [papelTexto, setPapelTexto] = useState('');
  const [sobreTexto, setSobreTexto] = useState('');
  const [fechaLiberacionInput, setFechaLiberacionInput] = useState('');
  const [horaLiberacion, setHoraLiberacion] = useState('');
  const [lotesNoLiberados, setLotesNoLiberados] = useState<Array<{id: number; nombre: string}>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [alerta30, setAlerta30] = useState(false);

  // Derivar modo desde el estado
  const esSoloLectura = estado === 'APROBADO';
  const esModoLiberacion = estado === 'ENTREGADO' || estado === 'LIBERADO';

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
      setPlagasIds((r.plagas ?? []).map(p => p.id));
      setObservaciones(r.observaciones ?? '');
      setEstado(r.estado);
      setAlerta30(requiereAlertaLiberacion(r));

      // V21/V22: si ENTREGADO o LIBERADO, cargar las liberaciones registradas
      // (base del pendiente por liberar y de los defaults de papel/sobre).
      let liberaciones: LiberacionDto[] = [];
      if (r.estado === 'ENTREGADO' || r.estado === 'LIBERADO') {
        try {
          liberaciones = await listarLiberaciones(id);
        } catch {
          liberaciones = [];
        }
      }

      // v1.12.0: la cantidad mostrada es el PENDIENTE por liberar
      // (cantidad pedida − Σ papel+sobre de las liberaciones ya registradas).
      setCantidadTexto(String(pendienteLiberacion(r.cantidad, liberaciones)));

      // v1.12.0: defaults de papel/sobre = restante por presentación.
      const restante = restantePresentaciones(r, liberaciones);
      setPapelTexto(restante.papel > 0 ? String(restante.papel) : '');
      setSobreTexto(restante.sobre > 0 ? String(restante.sobre) : '');

      // V21/V22: si ENTREGADO o LIBERADO, pre-llenar fecha/hora de liberación con defaults del sistema
      if (r.estado === 'ENTREGADO' || r.estado === 'LIBERADO') {
        setFechaLiberacionInput(prev => prev || toISODate(new Date()));
        setHoraLiberacion(prev => prev || horaActual());
      }

      // V21: si ENTREGADO o LIBERADO, calcular lotes no liberados (un lote ya
      // liberado no vuelve a ofrecerse en el select "Lote a liberar").
      if ((r.estado === 'ENTREGADO' || r.estado === 'LIBERADO') && r.lotes && r.lotes.length > 0) {
        const liberadosIds = new Set(liberaciones.map(l => l.loteId));
        const noLiberados = r.lotes.filter(l => !liberadosIds.has(l.id));
        setLotesNoLiberados(noLiberados);
        if (noLiberados.length > 0) {
          setLoteLiberacionId(noLiberados[0].id);
        }
      }

      // Cargar fotos desde servidor (fetch con autenticación para que <Image> las muestre)
      try {
        const fotosServer = await listarFotosRequerimiento(id);
        const fotosConDataUri = await Promise.all(
          fotosServer.map(async f => ({
            foto: f,
            dataUri: await fetchFotoBinaria(id, f.id),
          })),
        );
        setFotosExistentes(fotosConDataUri);
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

  // v1.12.0: pendiente por liberar (valor mostrado en "Cantidad (millares)") y
  // presentaciones digitadas por el usuario; su suma se descuenta del pendiente.
  const pendiente = cantidadDesdeTexto(cantidadTexto);
  const papelNum = cantidadDesdeTexto(papelTexto);
  const sobreNum = cantidadDesdeTexto(sobreTexto);
  const presentacionesError = esModoLiberacion
    ? validarPresentacionesVsPendiente(papelNum, sobreNum, pendiente)
    : null;

  // V21/V22: guardar liberación (solo ENTREGADO)
  const guardarLiberacion = async () => {
    if (!esModoLiberacion || loteLiberacionId == null || presentacionesError != null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const fundoParaLiberacion = fundoId ?? 0;
      await crearLiberacion(id, {
        fundoId: fundoParaLiberacion,
        loteId: loteLiberacionId,
        // v1.12.0: cantidad liberada = papel + sobre de ESTA liberación
        cantidadLiberada: papelNum + sobreNum,
        papelConPostura: papelNum || undefined,
        sobreConCascarilla: sobreNum || undefined,
        horaLiberacion: horaLiberacion || horaActual(),
        fechaLiberacion: fechaLiberacionInput || toISODate(new Date()),
        plagas: plagasIds.length > 0 ? plagasIds : undefined,
        observaciones: observaciones.trim() || undefined,
      });

      // Subir fotos de liberación (RN-009: al menos 1)
      for (const foto of fotos) {
        try {
          await subirFotoRequerimiento(id, {
            uri: foto.uri,
            type: foto.type,
            name: foto.fileName,
          }, JSON.stringify({tipo: 'LIBERACION'}));
        } catch {
          // Silenciar — se reintenta en el próximo guardado
        }
      }

      navigation.goBack();
    } catch (e) {
      setSaveError(extractErrorMessage(e));
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
                      />
                    )}

                    <Text style={styles.subtitulo}>Presentaciones entregadas</Text>
                    <AppInput
                      label="Papel con postura"
                      value={papelTexto}
                      onChangeText={setPapelTexto}
                      keyboardType="number-pad"
                      maxLength={6}
                      accessibilityLabel="Papel con postura"
                    />
                    <AppInput
                      label="Sobre con cascarilla de arroz"
                      value={sobreTexto}
                      onChangeText={setSobreTexto}
                      keyboardType="number-pad"
                      maxLength={6}
                      accessibilityLabel="Sobre con cascarilla"
                    />

                    {presentacionesError ? (
                      <Text
                        accessibilityRole="alert"
                        style={styles.validacionError}>
                        {presentacionesError}
                      </Text>
                    ) : null}

                    <Text style={styles.subtitulo}>Plaga objetivo</Text>
                    <MultiSelectField
                      label="Plaga"
                      accessibilityLabel="Plaga objetivo"
                      optionAccessibilityPrefix="Opción Plaga"
                      selectedValues={plagasIds}
                      options={opcionesPlaga}
                      onSelect={setPlagasIds}
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

                    <View style={styles.fotoDosColumnas}>
                      <View style={styles.fotoColumna}>
                        <Text style={styles.fotoTitulo}>Foto de Entrega</Text>
                        {fotosExistentes.length > 0 ? (
                          <View style={styles.fotoPreviews}>
                            {fotosExistentes.map(({foto, dataUri}, idx) => (
                              <View key={String(foto.id)} style={styles.fotoPreview}>
                                <Image
                                  source={{uri: dataUri}}
                                  style={styles.fotoImagen}
                                />
                                <Text style={styles.fotoPreviewText}>Entrega {idx + 1}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.ayuda}>Sin foto de entrega</Text>
                        )}
                      </View>
                      <View style={styles.fotoColumna}>
                        <Text style={styles.fotoTitulo}>Foto de Liberación</Text>
                        {fotos.length > 0 ? (
                          <View style={styles.fotoPreviews}>
                            {fotos.map((foto, idx) => (
                              <View key={foto.uri} style={styles.fotoPreview}>
                                <Image source={{uri: foto.uri}} style={styles.fotoImagen} />
                                <Text style={styles.fotoPreviewText}>Liberación {idx + 1}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.ayuda}>Sin foto de liberación</Text>
                        )}
                        <View style={styles.fotoAcciones}>
                          <AppIconButton
                            name="camera-outline"
                            accessibilityLabel="Tomar foto de liberación"
                            onPress={tomarFoto}
                            disabled={fotos.length >= MAX_PHOTOS}
                          />
                          <AppIconButton
                            name="image-outline"
                            accessibilityLabel="Seleccionar foto de liberación"
                            onPress={seleccionarFoto}
                            disabled={fotos.length >= MAX_PHOTOS}
                          />
                        </View>
                        {fotoError ? (
                          <Text style={styles.fotoError}>{fotoError}</Text>
                        ) : null}
                      </View>
                    </View>

                    {saveError ? (
                      <View style={styles.saveErrorContainer}>
                        <Text accessibilityRole="alert" style={styles.saveErrorText}>
                          {saveError}
                        </Text>
                        <AppButton
                          label="Cerrar"
                          variant="text"
                          onPress={() => setSaveError(null)}
                          accessibilityLabel="Cerrar error"
                        />
                      </View>
                    ) : null}

                    <AppButton
                      label="Guardar liberación"
                      icon="content-save-outline"
                      loading={saving}
                      disabled={
                        loteLiberacionId == null ||
                        lotesNoLiberados.length === 0 ||
                        fotos.length === 0 ||
                        presentacionesError != null
                      }
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
  fotoDosColumnas: {
    flexDirection: 'row',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  fotoColumna: {
    flex: 1,
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
  /** Validación de presentaciones vs pendiente por liberar (v1.12.0). */
  validacionError: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.status.error,
    marginBottom: theme.spacing[3],
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
  saveErrorContainer: {
    backgroundColor: theme.colors.status.errorBackground,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.status.error,
  },
  saveErrorText: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.status.error,
    marginBottom: theme.spacing[2],
  },
});
