/**
 * RequerimientoFormScreen — Screen 8: Formulario de Solicitud de Requerimiento
 * (MOD-18 / RF-158..167). Acceso: admin i+d.
 *
 * Comportamiento por modo:
 *  - Creación (sin `id`): campos base habilitados con selección múltiple de
 *    lotes y plagas (V19); Papel/Sobre deshabilitados (RF-162).
 *  - Edición (con `id`): solo Estado habilitado; Papel/Sobre + cámara/galería
 *    se habilitan SOLO cuando el admin cambia de APROBADO a ENTREGADO
 *    (RF-163/164). Si el request viene de REGISTRADO/PENDIENTE y pasa a
 *    APROBADO, solo cambia el estado (sin papel/sobre ni fotos).
 *
 * Validación (RF-165): si Estado = Entregado → Papel + Sobre obligatorios y su
 * suma == cantidad plaga para habilitar Guardar. Al guardar → vuelve a Screen 7.
 *
 * Notas:
 *  - El botón "Acta PDF" (RF-160/161) fue eliminado: la evidencia se captura
 *    como imagen (documento de entrega), no como PDF.
 *  - La transición de estado APROBADO→ENTREGADO se mantiene manual (selector).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
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
import MultiSelectField from '../components/MultiSelectField';
import SelectField from '../components/SelectField';
import {usePhotoCapture} from '../hooks/usePhotoCapture';
import {useRequerimientosCatalogos} from '../hooks/useRequerimientosCatalogos';
import {useAuth} from '../context/AuthContext';
import type {RootStackParamList} from '../navigation/types';
import {
  actualizarRequerimiento,
  crearRequerimiento,
  eliminarFotoRequerimiento,
  extractErrorMessage,
  getFotoUrl,
  listarFotosRequerimiento,
  obtenerRequerimiento,
  subirFotoRequerimiento,
  type EstadoRequerimiento,
  type FotoRequerimientoDto,
  type PlagaDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {
  cantidadDesdeTexto,
  estadoInfo,
  ESTADOS_ADMIN,
  esEstadoEntregado,
  horaActual,
  hoyISO,
} from '../utils/requerimientos';

type Route = RouteProp<RootStackParamList, 'RequerimientoForm'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MAX_PHOTOS = 2;

export default function RequerimientoFormScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const id = route.params?.id;
  const readOnly = route.params?.readOnly ?? false;
  const modo: 'crear' | 'editar' = id != null ? 'editar' : 'crear';

  const catalogo = useRequerimientosCatalogos();

  const [fechaInput, setFechaInput] = useState('');
  const [fundoId, setFundoId] = useState<number | null>(null);
  const [loteId, setLoteId] = useState<number | null>(null);
  const [lotesIds, setLotesIds] = useState<number[]>([]);
  const [especieId, setEspecieId] = useState<number | null>(null);
  const [cantidadTexto, setCantidadTexto] = useState('');
  const [plagaId, setPlagaId] = useState<number | null>(null);
  const [plagasIds, setPlagasIds] = useState<number[]>([]);
  const [estado, setEstado] = useState<EstadoRequerimiento>('PENDIENTE');
  const [fechaLiberacionInput, setFechaLiberacionInput] = useState('');
  const [horaLiberacion, setHoraLiberacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [papelTexto, setPapelTexto] = useState('');
  const [sobreTexto, setSobreTexto] = useState('');
  // Estado original del request al cargar (para distinguir APROBADO→ENTREGADO de REGISTRADO→APROBADO).
  const estadoOriginal = useRef<EstadoRequerimiento | null>(null);

  const [loading, setLoading] = useState(modo === 'editar');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avisoActa, setAvisoActa] = useState<string | null>(null);

  const {
    fotos,
    fotoError,
    tomarFoto,
    seleccionarFoto,
    quitarFoto,
  } = usePhotoCapture(MAX_PHOTOS);
  const [fotosExistentes, setFotosExistentes] = useState<Array<{foto: FotoRequerimientoDto; url: string}>>([]);

  // Rellena fecha/hora de liberación al agregar una foto de entrega (traza).
  const prevFotoCount = useRef(fotos.length);
  useEffect(() => {
    if (fotos.length > prevFotoCount.current) {
      const now = new Date();
      setFechaLiberacionInput(now.toISOString());
      setHoraLiberacion(horaActual());
    }
    prevFotoCount.current = fotos.length;
  }, [fotos.length]);

  // Fecha por defecto (creación): hoy.
  useEffect(() => {
    if (modo === 'crear') {
      setFechaInput(hoyISO());
    }
  }, [modo]);

  const cargarLotes = catalogo.cargarLotes;

  const cargarRequerimiento = useCallback(async (targetId: number) => {
    setLoading(true);
    setError(null);

    // Helper: llenar state desde un DTO del API
    const fillFromDto = (r: {fecha: string; fundoId: number; loteId?: number | null; lotes?: Array<{id: number; nombre: string}>; especieId: number; cantidad: number; plagaId?: number | null; plagas?: Array<{id: number; nombre: string}>; estado: EstadoRequerimiento; fechaLiberacion?: string | null; horaLiberacion?: string | null; observaciones?: string | null; papelConPostura?: number | null; sobreConCascarilla?: number | null}) => {
      setFechaInput(r.fecha);
      setFundoId(r.fundoId);
      setLoteId(r.loteId ?? null);
      setLotesIds((r.lotes ?? []).map(l => l.id));
      setEspecieId(r.especieId);
      setCantidadTexto(String(r.cantidad));
      setPlagaId(r.plagaId ?? null);
      setPlagasIds((r.plagas ?? []).map(p => p.id));
      estadoOriginal.current = r.estado;
      setEstado(r.estado);
      setFechaLiberacionInput(r.fechaLiberacion ?? '');
      setHoraLiberacion(r.horaLiberacion ?? '');
      setObservaciones(r.observaciones ?? '');
      setPapelTexto(r.papelConPostura != null ? String(r.papelConPostura) : '');
      setSobreTexto(r.sobreConCascarilla != null ? String(r.sobreConCascarilla) : '');
    };

    try {
      const r = await obtenerRequerimiento(targetId);
      fillFromDto(r);
      if (r.fundoId != null) {
        try {
          await cargarLotes(r.fundoId);
        } catch {
          // Silenciar — los lotes se muestran mejor esfuerzo
        }
      }
      // Cargar evidencia fotográfica existente (documento de entrega)
      try {
        const fotosServer = await listarFotosRequerimiento(targetId);
        const fotosConUrl = await Promise.all(
          fotosServer.map(async f => ({
            foto: f,
            url: await getFotoUrl(targetId, f.id),
          })),
        );
        setFotosExistentes(fotosConUrl);
      } catch {
        setFotosExistentes([]);
      }
    } catch (e) {
      setError(extractErrorMessage(e));
    }

    setLoading(false);
  }, [cargarLotes]);

  useEffect(() => {
    if (modo === 'editar' && id != null) {
      cargarRequerimiento(id);
    }
  }, [id, modo, cargarRequerimiento]);

  const cambiarFundo = (value: number | string) => {
    const fid = Number(value);
    setFundoId(fid);
    setLoteId(null);
    setLotesIds([]);
    catalogo.cargarLotes(fid);
  };

  // RF-162: en creación Papel/Sobre están deshabilitados; en edición se
  // habilitan solo cuando el admin cambia de APROBADO a ENTREGADO (RF-163/164).
  // Si el request viene de REGISTRADO/PENDIENTE y pasa a APROBADO, NO se habilitan.
  // V21: readOnly desactiva todo.
  const papelSobreHabilitados =
    !readOnly && modo === 'editar' && esEstadoEntregado(estado) && estadoOriginal.current === 'APROBADO';
  // La captura de evidencia (cámara/galería) solo aplica cuando el admin
  // cambia de APROBADO a ENTREGADO (documento de entrega).
  const evidencioSeccionVisible =
    !readOnly && modo === 'editar' && esEstadoEntregado(estado) && estadoOriginal.current === 'APROBADO';
  // Otros campos (fecha/fundo/lote/especie/cantidad/objetivo) solo editables en creación.
  const camposBaseHabilitados = !readOnly && modo === 'crear';
  // El campo Estado es siempre editable (creación y edición, RF-163), salvo readOnly.
  const estadoEditable = !readOnly;

  const isoFecha = fechaInput;
  const isoFechaLiberacion = fechaLiberacionInput || null;
  const cantidadNum = cantidadDesdeTexto(cantidadTexto);
  const papelNum = cantidadDesdeTexto(papelTexto);
  const sobreNum = cantidadDesdeTexto(sobreTexto);
  const baseOk =
    !!isoFecha &&
    fundoId != null &&
    (loteId != null || lotesIds.length > 0) &&
    especieId != null &&
    cantidadNum > 0;
  const presentacionesOk =
    papelNum > 0 && sobreNum > 0 && papelNum + sobreNum === cantidadNum;
  const puedeGuardar =
    baseOk && (estado !== 'ENTREGADO' || presentacionesOk);

  const guardar = async () => {
    setSaving(true);
    setAvisoActa(null);
    try {
      const lotesEnvio = (lotesIds.length > 0 ? lotesIds : loteId != null ? [loteId] : []);
      if (modo === 'crear') {
        await crearRequerimiento({
          fecha: isoFecha ?? hoyISO(),
          fundoId: fundoId!,
          loteId: loteId ?? undefined,
          lotes: lotesEnvio,
          especieId: especieId!,
          etapaFenologicaId: null,
          cantidad: cantidadNum,
          plagaId: plagaId ?? null,
          plagas: plagasIds,
          observaciones: observaciones.trim() || null,
        });
      } else {
        await actualizarRequerimiento(id!, {
          fecha: isoFecha ?? hoyISO(),
          fundoId: fundoId!,
          loteId: loteId ?? undefined,
          lotes: lotesEnvio,
          especieId: especieId!,
          etapaFenologicaId: null,
          cantidad: cantidadNum,
          plagaId: plagaId ?? null,
          plagas: plagasIds,
          estado,
          papelConPostura: papelNum > 0 ? papelNum : null,
          sobreConCascarilla: sobreNum > 0 ? sobreNum : null,
          fechaLiberacion: isoFechaLiberacion,
          horaLiberacion: horaLiberacion.trim() || null,
          observaciones: observaciones.trim() || null,
        });
      }
      // Subir evidencia fotográfica del documento de entrega (máx 2)
      for (const foto of fotos) {
        try {
          await subirFotoRequerimiento(id!, {
            uri: foto.uri,
            type: foto.type,
            name: foto.fileName,
          }, JSON.stringify({tipo: 'DOCUMENTO_ENTREGA'}));
        } catch {
          // Silenciar — se reintenta en el próximo guardado
        }
      }
      navigation.goBack();
    } catch (e) {
      setAvisoActa(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const eliminarFotoServidor = async (fotoId: number) => {
    try {
      try {
        await eliminarFotoRequerimiento(id!, fotoId);
      } catch {
        // Silenciar — el usuario puede reintentar
      }
      setFotosExistentes(prev => prev.filter(item => item.foto.id !== fotoId));
    } catch {
      // Silenciar — el usuario puede reintentar
    }
  };

  if (!user) {
    return null;
  }

  // Opciones del selector de Estado (incluye el estado actual si no está en la lista admin).
  const opcionesEstado = (() => {
    const lista = ESTADOS_ADMIN.includes(estado) ? ESTADOS_ADMIN : [estado, ...ESTADOS_ADMIN];
    return lista.map(est => ({label: estadoInfo(est).label, value: est}));
  })();

  const opcionesFundo = catalogo.fundos.map(f => ({label: f.nombre, value: f.id}));
  const opcionesLote = catalogo.lotes.map(l => ({label: l.nombre, value: l.id}));
  const opcionesEspecie = catalogo.especies.map(e => ({label: e.nombre, value: e.id}));
  const opcionesPlaga = catalogo.plagas.map((p: PlagaDto) => ({label: p.nombre, value: p.id}));

  const renderError = error ? (
    <ErrorState onRetry={() => id != null && cargarRequerimiento(id)} />
  ) : null;

  const renderAviso = avisoActa ? (
    <View accessibilityRole="alert" style={styles.notificacionError}>
      <Text style={styles.notificacionText}>{avisoActa}</Text>
    </View>
  ) : null;

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar el formulario"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title={modo === 'crear' ? 'Nueva solicitud' : readOnly ? 'Detalle solicitud' : 'Editar solicitud'}
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
            {loading || catalogo.loadingCatalogo ? (
              <LoadingState message="Cargando formulario…" />
            ) : renderError ? (
              renderError
            ) : (
              <>
                {renderAviso}
                <DateTimePickerField
                  label="Fecha"
                  value={fechaInput}
                  mode="date"
                  onChange={setFechaInput}
                  editable={camposBaseHabilitados}
                  accessibilityLabel="Fecha"
                />
                <SelectField
                  label="Fundo"
                  accessibilityLabel="Fundo"
                  optionAccessibilityPrefix="Opción Fundo"
                  value={
                    catalogo.fundos.find(f => f.id === fundoId)?.nombre ?? ''
                  }
                  options={opcionesFundo}
                  onSelect={cambiarFundo}
                  disabled={!camposBaseHabilitados || catalogo.fundos.length === 0}
                />
                <MultiSelectField
                  label="Lote"
                  accessibilityLabel="Lote"
                  optionAccessibilityPrefix="Opción Lote"
                  selectedValues={lotesIds}
                  options={opcionesLote}
                  onSelect={setLotesIds}
                  disabled={!camposBaseHabilitados || fundoId == null || catalogo.lotes.length === 0}
                />
                <SelectField
                  label="Especie"
                  accessibilityLabel="Especie"
                  optionAccessibilityPrefix="Opción Especie"
                  value={
                    catalogo.especies.find(e => e.id === especieId)?.nombre ?? ''
                  }
                  options={opcionesEspecie}
                  onSelect={v => setEspecieId(Number(v))}
                  disabled={!camposBaseHabilitados || catalogo.especies.length === 0}
                />
                <AppInput
                  label="Cantidad plaga (millares)"
                  value={cantidadTexto}
                  onChangeText={setCantidadTexto}
                  keyboardType="number-pad"
                  editable={camposBaseHabilitados}
                  maxLength={6}
                  accessibilityLabel="Cantidad plaga"
                />
                <MultiSelectField
                  label="Objetivo (plaga)"
                  accessibilityLabel="Objetivo"
                  optionAccessibilityPrefix="Opción Plaga"
                  selectedValues={plagasIds}
                  options={opcionesPlaga}
                  onSelect={setPlagasIds}
                  disabled={!camposBaseHabilitados || catalogo.plagas.length === 0}
                />
                <View style={styles.estadoRow}>
                  <View style={styles.estadoFlex}>
                    <SelectField
                      label="Estado"
                      accessibilityLabel="Estado"
                      optionAccessibilityPrefix="Opción Estado"
                      value={estadoInfo(estado).label}
                      options={opcionesEstado}
                      onSelect={v => setEstado(v as EstadoRequerimiento)}
                      disabled={!estadoEditable}
                    />
                  </View>
                </View>
                <DateTimePickerField
                  label="Fecha de liberación"
                  value={fechaLiberacionInput}
                  mode="date"
                  onChange={setFechaLiberacionInput}
                  onClear={() => setFechaLiberacionInput('')}
                  editable={camposBaseHabilitados}
                  accessibilityLabel="Fecha de liberación"
                />
                <DateTimePickerField
                  label="Hora de liberación"
                  value={horaLiberacion}
                  mode="time"
                  onChange={setHoraLiberacion}
                  onClear={() => setHoraLiberacion('')}
                  editable={camposBaseHabilitados}
                  accessibilityLabel="Hora de liberación"
                />
                <AppInput
                  label="Observaciones"
                  value={observaciones}
                  onChangeText={setObservaciones}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={camposBaseHabilitados}
                  accessibilityLabel="Observaciones"
                />

                <Text style={styles.subtitulo}>Presentaciones entregadas</Text>
                <AppInput
                  label="Papel con postura"
                  value={papelTexto}
                  onChangeText={setPapelTexto}
                  keyboardType="number-pad"
                  editable={papelSobreHabilitados}
                  maxLength={6}
                  accessibilityLabel="Papel con postura"
                />
                <AppInput
                  label="Sobre con cascarilla de arroz"
                  value={sobreTexto}
                  onChangeText={setSobreTexto}
                  keyboardType="number-pad"
                  editable={papelSobreHabilitados}
                  maxLength={6}
                  accessibilityLabel="Sobre con cascarilla"
                />
                {estado === 'ENTREGADO' ? (
                  <Text style={styles.ayuda}>
                    Si estado = Entregado, papel + sobre debe ser igual a la
                    cantidad para habilitar Guardar.
                  </Text>
                ) : null}

                {evidencioSeccionVisible ? (
                  <>
                    <Text style={styles.subtitulo}>
                      Evidencia del documento de entrega
                    </Text>
                    {fotosExistentes.length > 0 && (
                      <View style={styles.fotoPreviews}>
                        {fotosExistentes.map(({foto, url}, idx) => (
                          <View key={String(foto.id)} style={styles.fotoPreview}>
                            <Image source={{uri: url}} style={styles.fotoImagen} />
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
                          accessibilityLabel="Tomar foto del documento de entrega"
                        />
                      </View>
                      <View style={styles.fotoAccion}>
                        <AppButton
                          label="Galería"
                          icon="image-outline"
                          variant="secondary"
                          disabled={fotos.length + fotosExistentes.length >= MAX_PHOTOS}
                          onPress={seleccionarFoto}
                          accessibilityLabel="Seleccionar foto del documento de entrega de la galería"
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
                            accessibilityLabel={`Quitar foto del documento ${idx + 1}`}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {readOnly ? null : (
                  <AppButton
                    label="Guardar"
                    icon="content-save-outline"
                    loading={saving}
                    disabled={!puedeGuardar}
                    onPress={guardar}
                    accessibilityLabel="Guardar solicitud"
                  />
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
  estadoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[2],
  },
  estadoFlex: {
    flex: 1,
  },
  subtitulo: {
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
  ayuda: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.status.warning,
    marginBottom: theme.spacing[3],
  },
  notificacionError: {
    backgroundColor: theme.colors.status.errorBackground,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  notificacionText: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.text.primary,
  },
});
