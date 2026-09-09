/**
 * ProgramacionEdicionScreen — Screen 5: Edición de Programación (MOD-17).
 *
 * Descripción (01_especificacion.md RF-141..146 / transcripcion.md):
 *  1. Filtro de mes: selectores mes + año (chevrons) para elegir el periodo.
 *  2. Filtro de especie: píldoras con el catálogo de especies.
 *  3. Tabla de proyección final editable: por semana — Papel con postura y
 *     Sobre con cascarilla editables (millares); Total = suma automática
 *     (RF-134); Stock inicial y Stock final mostrados (los computa el
 *     backend, incluyendo remanente RN-037/RF-188).
 *  4. Botón "Enviar stock": guarda (PUT) y publica (POST /publicar)
 *     notificando por correo a Sanidad (RF-145/146).
 *
 * Restricciones:
 *  - CREAR una programación: disponible cualquier día (HITO-016); la tabla del
 *    mes se muestra al entrar a "Nuevo" sin esperar a seleccionar especie.
 *  - Edición de una programación existente SOLO lunes y jueves 00:00-23:59
 *    (RF-147/148): fuera de esos días los inputs y "Enviar stock" quedan
 *    deshabilitados.
 *  - Una programación PUBLICADA (RN-038) no vuelve a editarse.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import AppIconButton from '../components/AppIconButton';
import EmptyState from '../components/EmptyState';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import StatusChip from '../components/StatusChip';
import type {RootStackParamList} from '../navigation/types';
import {
  actualizarProgramacion,
  crearProgramacion,
  extractErrorMessage,
  guardarCumplimiento,
  listarCumplimiento,
  listarEspecies,
  listarProgramaciones,
  obtenerProgramacion,
  publicarProgramacion,
  type CumplimientoProgramacionDto,
  type EspecieDto,
  type ProgramacionDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {
  anioActual,
  esDiaEditable,
  etiquetaPeriodo,
  formatFechaCorta,
  mesActual,
  semanaActual,
  semanaCalendario,
} from '../utils/programacion';

type Route = RouteProp<RootStackParamList, 'ProgramacionEdicion'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** Fila editable de la tabla semanal (strings para los inputs numéricos). */
interface FilaEditable {
  detalleId: number;
  semana: number;
  fecha: string;
  stockInicial: number;
  papel: string;
  sobre: string;
}

const soloNumeros = (texto: string) => texto.replace(/[^0-9]/g, '');

/** Valor numérico seguro (vacío → 0). */
function aNumero(texto: string): number {
  const n = parseInt(texto, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Genera filas vacías para modo crear (replica la lógica del backend). */
function generarFilasVacias(anio: number, mes: number): FilaEditable[] {
  const result: FilaEditable[] = [];
  let stockActual = 5000;
  const lengthOfMonth = new Date(anio, mes, 0).getDate();
  for (let day = 1; day <= lengthOfMonth; day++) {
    const fecha = new Date(anio, mes - 1, day);
    const dow = fecha.getDay(); // 0=Dom, 1=Lun, 4=Jue
    if (dow === 1 || dow === 4) {
      const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      result.push({
        detalleId: -day, // IDs negativos para filas no persistidas
        semana: ((day - 1) / 7) + 1,
        fecha: iso,
        stockInicial: stockActual,
        papel: '',
        sobre: '',
      });
      // stockActual no cambia porque papel/sobre están vacíos
    }
  }
  return result;
}

export default function ProgramacionEdicionScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  // Extraer params: modo puede ser 'crear' o 'editar' (por defecto 'editar')
  const params = route.params;
  const modo: 'crear' | 'editar' = params.modo ?? 'editar';
  const idInicial = 'id' in params ? params.id : undefined;
  const anioInicial = params.anio;
  const mesInicial = params.mes;

  const [anio, setAnio] = useState(anioInicial ?? anioActual());
  const [mes, setMes] = useState(mesInicial ?? mesActual());
  const [especies, setEspecies] = useState<EspecieDto[]>([]);
  const [especieId, setEspecieId] = useState<number | null>(null);
  const [programacion, setProgramacion] = useState<ProgramacionDto | null>(null);
  // En modo crear la tabla se genera al montar (HITO-016): visible e habilitada
  // de inmediato, sin esperar a seleccionar especie.
  const [filas, setFilas] = useState<FilaEditable[]>(() =>
    modo === 'crear'
      ? generarFilasVacias(anioInicial ?? anioActual(), mesInicial ?? mesActual())
      : [],
  );
  const [loading, setLoading] = useState(modo === 'editar'); // En modo 'crear' no hay carga inicial
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificacion, setNotificacion] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  // Cumplimiento de producción
  const [cumplimientos, setCumplimientos] = useState<Map<number, CumplimientoProgramacionDto>>(new Map());
  const [cumplimientoModalVisible, setCumplimientoModalVisible] = useState(false);
  const [cumplimientoModalMode, setCumplimientoModalMode] = useState<'edit' | 'view'>('edit');
  const [cumplimientoSeleccionado, setCumplimientoSeleccionado] = useState<FilaEditable | null>(null);
  const [cumplimientoPapel, setCumplimientoPapel] = useState('');
  const [cumplimientoSobre, setCumplimientoSobre] = useState('');
  const [cumplimientoSaving, setCumplimientoSaving] = useState(false);
  const [cumplimientoError, setCumplimientoError] = useState<string | null>(null);

  const semanaActualNum = semanaActual();

  const puedeEditar =
    modo === 'crear'
      ? true
      : esDiaEditable() && programacion?.estado === 'EN_PROCESO';

  /** Carga el catálogo de especies una única vez (montaje). */
  useEffect(() => {
    let activo = true;
    listarEspecies()
      .then(es => {
        if (activo) {
          setEspecies(es);
        }
      })
      .catch(() => {
        // El error de catálogo se refleja en el flujo principal de carga.
      });
    return () => {
      activo = false;
    };
  }, []);

  /**
   * Carga la programación en edición: primero el detalle completo del id
   * inicial (para no esperar el listado) y sincroniza mes/especie. Luego, al
   * cambiar los filtros, se busca la programación del periodo + especie.
   */
  const cargarDetalle = useCallback(async (targetId: number) => {
    setLoading(true);
    setError(null);
    try {
      const detalle = await obtenerProgramacion(targetId);
      setProgramacion(detalle);
      setAnio(detalle.anio);
      setMes(detalle.mes);
      setEspecieId(detalle.especieId);
      setFilas(
        (detalle.detalles ?? []).map(d => ({
          detalleId: d.id,
          semana: d.semana,
          fecha: d.fecha,
          stockInicial: d.stockInicial,
          // Valor 0 → input vacío (no muestra "0"); el backend calcula el resto.
          papel: d.papelConPostura === 0 ? '' : String(d.papelConPostura),
          sobre: d.sobreConCascarilla === 0 ? '' : String(d.sobreConCascarilla),
        })),
      );
      // Cargar cumplimientos de producción
      await cargarCumplimientos(detalle.id);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Carga los cumplimientos de producción de una programación. */
  const cargarCumplimientos = useCallback(async (programacionId: number) => {
    try {
      const data = await listarCumplimiento(programacionId);
      const map = new Map<number, CumplimientoProgramacionDto>();
      for (const c of data) {
        map.set(c.programacionDetalleId, c);
      }
      setCumplimientos(map);
    } catch {
      // Silenciar: el cumplimiento es opcional
    }
  }, []);

  useEffect(() => {
    // Solo cargar detalle en modo 'editar' con id válido
    if (modo === 'editar' && idInicial) {
      cargarDetalle(idInicial);
    }
  }, [idInicial, cargarDetalle, modo]);

  /** Al cambiar mes/anio/especie: busca la programación de ese periodo. */
  const seleccionarProgramacionDelPeriodo = useCallback(
    async (mesSel: number, anioSel: number, especieSel: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const lista = await listarProgramaciones(anioSel, mesSel);
        const coincidencia = lista.find(p => p.especieId === especieSel);
        if (coincidencia) {
          await cargarDetalle(coincidencia.id);
        } else {
          setProgramacion(null);
          setFilas([]);
          setLoading(false);
        }
      } catch (e) {
        setError(extractErrorMessage(e));
        setLoading(false);
      }
    },
    [cargarDetalle],
  );

  const cambiarPeriodo = (mesSel: number, anioSel: number) => {
    setMes(mesSel);
    setAnio(anioSel);
    if (modo === 'crear') {
      // El mes cambia → se regeneran las filas vacías (la tabla siempre visible).
      setFilas(generarFilasVacias(anioSel, mesSel));
    } else {
      seleccionarProgramacionDelPeriodo(mesSel, anioSel, especieId);
    }
  };

  const cambiarEspecie = (id: number) => {
    setEspecieId(id);
    if (modo === 'crear') {
      // La tabla ya se muestra al montar; seleccionar especie solo habilita
      // "Enviar stock" sin regenerar (no borrar lo digitado).
    } else {
      seleccionarProgramacionDelPeriodo(mes, anio, id);
    }
  };

  const moverMes = (delta: number) => {
    const total = mes - 1 + delta;
    const nuevoAnio = anio + Math.floor(total / 12);
    const nuevoMes = ((total % 12) + 12) % 12 + 1;
    cambiarPeriodo(nuevoMes, nuevoAnio);
  };

  /** Filas con total y stock final computados (remanente visual RN-037). */
  const filasComputadas = useMemo(() => {
    let runningStock = filas.length > 0 ? filas[0].stockInicial : 5000;
    return filas.map((f, idx) => {
      const papelNum = aNumero(f.papel);
      const sobreNum = aNumero(f.sobre);
      const total = papelNum + sobreNum;
      const stockInicial = idx === 0 ? f.stockInicial : runningStock;
      const stockFinal = stockInicial - total;
      runningStock = stockFinal;
      return {...f, papelNum, sobreNum, total, stockInicial, stockFinal};
    });
  }, [filas]);

  const totalMes = useMemo(
    () => filasComputadas.reduce((acc, f) => acc + f.total, 0),
    [filasComputadas],
  );

  const actualizarFila = (
    detalleId: number,
    campo: 'papel' | 'sobre',
    valor: string,
  ) => {
    const limpio = soloNumeros(valor);
    setFilas(prev =>
      prev.map(f =>
        f.detalleId === detalleId ? {...f, [campo]: limpio} : f,
      ),
    );
  };

  // ─── CUMPLIMIENTO DE PRODUCCIÓN ────────────────────────────────────────

  /** Abre el modal de cumplimiento en modo edición (lápiz) o vista (lupa). */
  const abrirCumplimiento = (fila: FilaEditable, mode: 'edit' | 'view') => {
    setCumplimientoSeleccionado(fila);
    setCumplimientoModalMode(mode);
    setCumplimientoError(null);
    if (mode === 'edit') {
      // Precargar valores existentes si los hay
      const existente = cumplimientos.get(fila.detalleId);
      setCumplimientoPapel(existente ? String(existente.papelReal) : '');
      setCumplimientoSobre(existente ? String(existente.sobreReal) : '');
    }
    setCumplimientoModalVisible(true);
  };

  /** Guarda el cumplimiento de producción. */
  const guardarCumplimientoHandler = async () => {
    if (!cumplimientoSeleccionado || !programacion) {
      return;
    }
    const papelNum = aNumero(cumplimientoPapel);
    const sobreNum = aNumero(cumplimientoSobre);
    if (papelNum <= 0 && sobreNum <= 0) {
      setCumplimientoError('Ingresa al menos un valor (papel o sobre).');
      return;
    }
    setCumplimientoSaving(true);
    setCumplimientoError(null);
    try {
      const resultado = await guardarCumplimiento(programacion.id, {
        programacionDetalleId: cumplimientoSeleccionado.detalleId,
        semana: cumplimientoSeleccionado.semana,
        fecha: cumplimientoSeleccionado.fecha,
        papelReal: papelNum,
        sobreReal: sobreNum,
      });
      // Actualizar el mapa local
      setCumplimientos(prev => {
        const next = new Map(prev);
        next.set(cumplimientoSeleccionado.detalleId, resultado);
        return next;
      });
      setCumplimientoModalVisible(false);
    } catch (e) {
      setCumplimientoError(extractErrorMessage(e));
    } finally {
      setCumplimientoSaving(false);
    }
  };

  const enviarStock = async () => {
    if (!programacion) {
      return;
    }
    setSaving(true);
    setNotificacion(null);
    try {
      await actualizarProgramacion(programacion.id, {
        stockInicialBase: programacion.stockInicialBase,
        detalles: filas.map(f => ({
          id: f.detalleId,
          semana: f.semana,
          fecha: f.fecha,
          papelConPostura: aNumero(f.papel),
          sobreConCascarilla: aNumero(f.sobre),
        })),
      });
      const res = await publicarProgramacion(programacion.id);
      setNotificacion({
        tipo: 'ok',
        texto:
          res.mensaje ||
          'Programación publicada. Se notificó a Sanidad por correo.',
      });
      await cargarDetalle(programacion.id);
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    } finally {
      setSaving(false);
    }
  };

  /** Crea la programación, guarda los detalles y publica en un solo paso (modo crear). */
  const enviarStockCrear = async () => {
    if (!especieId) {
      setNotificacion({tipo: 'error', texto: 'Selecciona una especie'});
      return;
    }
    setSaving(true);
    setNotificacion(null);
    try {
      // 1. Crear programación (POST) — genera las filas vacías en backend
      const nueva = await crearProgramacion({anio, mes, especieId});
      // 2. Actualizar con los valores editados (PUT) — esCreacionInicial:true
      //    omite la restricción de edición L/J para el volcado inicial (HITO-016).
      await actualizarProgramacion(nueva.id, {
        stockInicialBase: 5000,
        esCreacionInicial: true,
        detalles: filas.map(f => ({
          id: f.detalleId > 0 ? f.detalleId : undefined,
          semana: f.semana,
          fecha: f.fecha,
          papelConPostura: aNumero(f.papel),
          sobreConCascarilla: aNumero(f.sobre),
        })),
      });
      // 3. Publicar (POST)
      const res = await publicarProgramacion(nueva.id);
      setNotificacion({
        tipo: 'ok',
        texto: res.mensaje || 'Programación publicada. Se notificó a Sanidad por correo.',
      });
      // 4. Navegar al listado después de 1.5s
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    } finally {
      setSaving(false);
    }
  };

  const renderPeriodo = (
    <View style={styles.periodRow}>
      <AppIconButton
        name="chevron-left"
        accessibilityLabel="Mes anterior"
        onPress={() => moverMes(-1)}
      />
      <Text style={styles.periodLabel}>{etiquetaPeriodo(mes, anio)}</Text>
      <AppIconButton
        name="chevron-right"
        accessibilityLabel="Mes siguiente"
        onPress={() => moverMes(1)}
      />
    </View>
  );

  const renderEspecies = (
    <View>
      <Text style={styles.sectionTitle}>Especie</Text>
      <View style={styles.pills}>
        {especies.map(es => {
          const activo = especieId === es.id;
          return (
            <Pressable
              key={es.id}
              accessibilityRole="button"
              accessibilityLabel={`Especie ${es.nombre}`}
              accessibilityState={{selected: activo}}
              onPress={() => cambiarEspecie(es.id)}
              style={[styles.pill, activo && styles.pillActive]}>
              <Text style={[styles.pillText, activo && styles.pillTextActive]}>
                {es.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderNotificacion = notificacion ? (
    <View
      accessibilityRole="alert"
      style={[
        styles.notification,
        notificacion.tipo === 'error' && styles.notificationError,
      ]}>
      <Text style={styles.notificationText}>{notificacion.texto}</Text>
    </View>
  ) : null;

  const renderTabla = () => {
    const chipEstado = (estado: ProgramacionDto['estado']) =>
      estado === 'PUBLICADO' ? (
        <StatusChip tone="approved" label="Publicado" />
      ) : (
        <StatusChip tone="pending" label="En proceso" />
      );

    return (
      <View>
        <View style={styles.tablaHeader}>
          <Text style={[styles.colSemana, styles.tablaHeaderText]}>Sem</Text>
          <Text style={[styles.colFecha, styles.tablaHeaderText]}>Fecha</Text>
          <Text style={[styles.colInput, styles.tablaHeaderText]}>Papel</Text>
          <Text style={[styles.colInput, styles.tablaHeaderText]}>Sobre</Text>
          <Text style={[styles.colNum, styles.tablaHeaderText]}>Total</Text>
          <Text style={[styles.colNum, styles.tablaHeaderText]}>Restante</Text>
          {modo === 'editar' && programacion?.estado === 'PUBLICADO' && (
            <Text style={[styles.colAccion, styles.tablaHeaderText]}>Producción</Text>
          )}
        </View>
        {filasComputadas.map((f) => {
          const esSemanaActual = semanaCalendario(f.fecha) === semanaActualNum;
          const tieneCumplimiento = cumplimientos.has(f.detalleId);
          const mostrarAccion = modo === 'editar' && programacion?.estado === 'PUBLICADO' && esSemanaActual;
          return (
          <View
            key={f.detalleId}
            style={[
              styles.tablaFila,
              semanaCalendario(f.fecha) % 2 === 1 && styles.tablaFilaBand,
            ]}>
            <Text style={[styles.colSemana, styles.tablaCell]}>{semanaCalendario(f.fecha)}</Text>
            <Text style={[styles.colFecha, styles.tablaCell]}>
              {formatFechaCorta(f.fecha)}
            </Text>
            <TextInput
              style={[styles.colInput, styles.inputCelda]}
              value={f.papel}
              keyboardType="number-pad"
              editable={puedeEditar}
              maxLength={6}
              onChangeText={v => actualizarFila(f.detalleId, 'papel', v)}
              accessibilityLabel={`Papel ${formatFechaCorta(f.fecha)}`}
            />
            <TextInput
              style={[styles.colInput, styles.inputCelda]}
              value={f.sobre}
              keyboardType="number-pad"
              editable={puedeEditar}
              maxLength={6}
              onChangeText={v => actualizarFila(f.detalleId, 'sobre', v)}
              accessibilityLabel={`Sobre ${formatFechaCorta(f.fecha)}`}
            />
            <Text style={[styles.colNum, styles.tablaCell]}>{f.total}</Text>
            <View style={styles.colNum}>
              <Text
                style={[
                  styles.tablaCell,
                  f.stockFinal < 0 && styles.restanteExcedido,
                ]}>
                {String(f.stockFinal)}
              </Text>
              {f.stockFinal < 0 ? (
                <Text style={styles.restanteExcedidoLabel}>excedido</Text>
              ) : null}
            </View>
            {mostrarAccion && (
              <Pressable
                style={styles.colAccion}
                onPress={() => abrirCumplimiento(f, tieneCumplimiento ? 'view' : 'edit')}
                accessibilityLabel={tieneCumplimiento ? `Ver producción ${formatFechaCorta(f.fecha)}` : `Registrar producción ${formatFechaCorta(f.fecha)}`}>
                <Text style={styles.accionIcono}>{tieneCumplimiento ? '🔍' : '✏️'}</Text>
              </Pressable>
            )}
          </View>
          );
        })}
        <View style={styles.tablaPie}>
          <Text style={styles.totalMes}>
            Total del mes: <Text style={styles.totalMesBold}>{totalMes} millares</Text>
          </Text>
          {programacion ? chipEstado(programacion.estado) : null}
        </View>
        {modo === 'editar' && !esDiaEditable() ? (
          <Text style={styles.avisoEdicion}>
            La edición solo está permitida los lunes y jueves de 00:00 a 23:59.
          </Text>
        ) : null}
        {programacion?.estado === 'PUBLICADO' ? (
          <Text style={styles.avisoEdicion}>
            Esta programación ya fue publicada y no puede volver a editarse.
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo editar la programación"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader
          title={modo === 'crear' ? 'Nueva programación' : 'Editar programación'}
          showBack
          onBack={navigation.goBack}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom},
          ]}>
          {renderPeriodo}
          {renderNotificacion}
          {modo === 'crear' ? (
            // MODO CREAR: selector de especie + tabla (visible desde el montaje) + "Enviar stock"
            <>
              {renderEspecies}
              {filas.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Proyección del Mes</Text>
                  {renderTabla()}
                </>
              )}
              <AppButton
                label="Enviar stock"
                icon="send-outline"
                loading={saving}
                disabled={!especieId}
                onPress={enviarStockCrear}
                accessibilityLabel="Enviar stock"
              />
            </>
          ) : error ? (
            <ErrorState onRetry={() => idInicial && cargarDetalle(idInicial)} />
          ) : loading ? (
            <LoadingState message="Cargando programación…" />
          ) : programacion ? (
            <>
              {renderEspecies}
              <Text style={styles.sectionTitle}>Proyección del Mes</Text>
              {renderTabla()}
              <AppButton
                label="Enviar stock"
                icon="send-outline"
                loading={saving}
                disabled={!puedeEditar}
                onPress={enviarStock}
                accessibilityLabel="Enviar stock"
              />
            </>
          ) : (
            <EmptyState
              title="Sin programación para este periodo y especie"
              message="Selecciona otro mes o especie para continuar la edición."
              icon="calendar-blank-outline"
            />
          )}
        </ScrollView>
        {/* Modal de cumplimiento de producción */}
        <Modal
          visible={cumplimientoModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCumplimientoModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {cumplimientoModalMode === 'edit'
                  ? 'Registro de Producción'
                  : 'Producción Registrada'}
                {' — '}Semana {cumplimientoSeleccionado ? semanaCalendario(cumplimientoSeleccionado.fecha) : ''}
              </Text>
              {cumplimientoSeleccionado && (
                <Text style={styles.modalSub}>
                  {formatFechaCorta(cumplimientoSeleccionado.fecha)}
                </Text>
              )}

              {cumplimientoModalMode === 'edit' ? (
                <>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Papel producido (millares)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={cumplimientoPapel}
                      onChangeText={setCumplimientoPapel}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="0"
                      accessibilityLabel="Papel producido"
                    />
                  </View>
                  <View style={styles.modalField}>
                    <Text style={styles.modalLabel}>Sobre producido (millares)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={cumplimientoSobre}
                      onChangeText={setCumplimientoSobre}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="0"
                      accessibilityLabel="Sobre producido"
                    />
                  </View>
                  <View style={styles.modalTotal}>
                    <Text style={styles.modalTotalLabel}>Total:</Text>
                    <Text style={styles.modalTotalValue}>
                      {aNumero(cumplimientoPapel) + aNumero(cumplimientoSobre)} millares
                    </Text>
                  </View>
                  {cumplimientoError && (
                    <Text style={styles.modalError}>{cumplimientoError}</Text>
                  )}
                  <View style={styles.modalActions}>
                    <AppButton
                      label="Cancelar"
                      variant="secondary"
                      onPress={() => setCumplimientoModalVisible(false)}
                    />
                    <AppButton
                      label="Guardar"
                      icon="content-save-outline"
                      loading={cumplimientoSaving}
                      onPress={guardarCumplimientoHandler}
                    />
                  </View>
                </>
              ) : (
                <>
                  {cumplimientoSeleccionado && (() => {
                    const c = cumplimientos.get(cumplimientoSeleccionado.detalleId);
                    if (!c) { return null; }
                    const programadoPapel = aNumero(cumplimientoSeleccionado.papel);
                    const programadoSobre = aNumero(cumplimientoSeleccionado.sobre);
                    const programadoTotal = programadoPapel + programadoSobre;
                    const cumplimientoPct = programadoTotal > 0
                      ? Math.round((c.totalReal / programadoTotal) * 100)
                      : 0;
                    return (
                      <>
                        <View style={styles.modalField}>
                          <Text style={styles.modalLabel}>Papel producido</Text>
                          <Text style={styles.modalValue}>{c.papelReal.toLocaleString()} millares</Text>
                        </View>
                        <View style={styles.modalField}>
                          <Text style={styles.modalLabel}>Sobre producido</Text>
                          <Text style={styles.modalValue}>{c.sobreReal.toLocaleString()} millares</Text>
                        </View>
                        <View style={styles.modalField}>
                          <Text style={styles.modalLabel}>Total producido</Text>
                          <Text style={styles.modalValueBold}>{c.totalReal.toLocaleString()} millares</Text>
                        </View>
                        <View style={styles.modalDivider} />
                        <View style={styles.modalField}>
                          <Text style={styles.modalLabel}>Programado</Text>
                          <Text style={styles.modalValue}>
                            {programadoPapel.toLocaleString()} / {programadoSobre.toLocaleString()} = {programadoTotal.toLocaleString()} millares
                          </Text>
                        </View>
                        <View style={styles.modalField}>
                          <Text style={styles.modalLabel}>Cumplimiento</Text>
                          <Text style={[styles.modalValueBold, cumplimientoPct >= 80 ? {color: theme.colors.status.success} : {color: theme.colors.status.warning}]}>
                            {cumplimientoPct}%
                          </Text>
                        </View>
                        <View style={styles.modalActions}>
                          <AppButton
                            label="Cerrar"
                            variant="secondary"
                            onPress={() => setCumplimientoModalVisible(false)}
                          />
                        </View>
                      </>
                    );
                  })()}
                </>
              )}
            </View>
          </View>
        </Modal>
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
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  periodLabel: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
  },
  sectionTitle: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  pill: {
    paddingHorizontal: theme.spacing[4],
    minHeight: 40,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.action.secondary,
    borderColor: theme.colors.action.secondary,
  },
  pillText: {
    fontFamily: theme.typography.button.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  pillTextActive: {
    color: theme.colors.text.inverse,
  },
  notification: {
    backgroundColor: theme.colors.status.successBackground,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
  },
  notificationError: {
    backgroundColor: theme.colors.status.errorBackground,
  },
  notificationText: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    color: theme.colors.text.primary,
  },
  avisoEdicion: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    color: theme.colors.status.warning,
    marginTop: theme.spacing[2],
  },
  tablaHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  tablaHeaderText: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
  },
  tablaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
    gap: theme.spacing[1],
  },
  tablaFilaBand: {
    // Fondo suave y alternado por semana (agrupa el Lunes+Jueves de una misma semana).
    backgroundColor: theme.colors.background.neutral,
    borderBottomColor: theme.colors.background.paper,
  },
  tablaCell: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.primary,
  },
  restanteExcedido: {
    color: theme.colors.status.error,
  },
  restanteExcedidoLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.status.error,
  },
  colSemana: {
    width: 30,
  },
  colFecha: {
    flex: 1,
  },
  colInput: {
    width: 52,
  },
  colNum: {
    width: 42,
    textAlign: 'right',
  },
  inputCelda: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.xs,
    paddingHorizontal: theme.spacing[1],
    paddingVertical: theme.spacing[1],
    minHeight: 36,
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.paper,
    textAlign: 'right',
  },
  tablaPie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing[2],
  },
  totalMes: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  totalMesBold: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    color: theme.colors.text.primary,
  },
  colAccion: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accionIcono: {
    fontSize: 18,
  },
  // Modal de cumplimiento
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
  modalTitle: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
  },
  modalSub: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[4],
  },
  modalField: {
    marginBottom: theme.spacing[3],
  },
  modalLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1],
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.paper,
  },
  modalValue: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.colors.text.primary,
  },
  modalValueBold: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    fontSize: theme.typography.subtitle1.fontSize,
    color: theme.colors.text.primary,
  },
  modalTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.sm,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  modalTotalLabel: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    color: theme.colors.text.secondary,
  },
  modalTotalValue: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    color: theme.colors.text.primary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: theme.colors.border.subtle,
    marginVertical: theme.spacing[3],
  },
  modalError: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.status.error,
    marginBottom: theme.spacing[3],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
});