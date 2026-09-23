/**
 * CatalogoCrudTab — CRUD genérico de catálogos simples (Especies, Nematodos,
 * Plagas, Patrones) reutilizado por CatalogosScreen (v1.15.0, DRY).
 *
 * Parametrizado por endpoint (`/especies` | `/nematodos` | `/plagas` |
 * `/patrones`) y replica el UX del tab Usuarios: filtros de estado y búsqueda
 * locales, alta/edición en modal de un solo campo (Nombre), soft delete con
 * ConfirmDialog (DELETE → INACTIVO) y reactivación (PUT ACTIVO), resultados
 * en MessageDialog. Mensajes con verbos invariable (agregó/actualizó) para
 * no depender del género del singular.
 *
 * v1.16.0: botón "Eliminar" (trash-can-outline) solo se muestra cuando
 * `puedeEliminar !== false` (flag del backend: sin dependencias y ACTIVO);
 * si hay registros asociados el botón se OCULTA (Q3).
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  actualizarCatalogo,
  crearCatalogo,
  eliminarCatalogo,
  extractErrorMessage,
  listarCatalogo,
  type ActualizarCatalogoRequest,
  type CatalogoEndpoint,
  type CatalogoItemDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import AppButton from './AppButton';
import AppCard from './AppCard';
import AppInput from './AppInput';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import MessageDialog from './MessageDialog';
import StatusChip from './StatusChip';

type EstadoFiltro = 'TODOS' | 'ACTIVO' | 'INACTIVO';

interface Props {
  endpoint: CatalogoEndpoint;
  /** Nombre en plural de la pestaña (ej. 'Especies'). */
  plural: string;
  /** Nombre en singular para labels/mensajes (ej. 'especie'). */
  singular: string;
}

function esActivo(estado: boolean | string): boolean {
  return estado === true || estado === 'ACTIVO';
}

interface FormModalProps {
  visible: boolean;
  singular: string;
  editando: CatalogoItemDto | null;
  onCancel: () => void;
  onSave: (nombre: string) => void;
}

/** Modal local de creación/edición: un solo campo (Nombre). */
function FormModal({
  visible,
  singular,
  editando,
  onCancel,
  onSave,
}: FormModalProps) {
  const [nombre, setNombre] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setNombre(editando ? editando.nombre : '');
    setFormError(null);
  }, [visible, editando]);

  const guardar = () => {
    const n = nombre.trim();
    if (!n) {
      setFormError('El nombre es obligatorio');
      return;
    }
    onSave(n);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editando ? `Editar ${singular}` : `Agregar ${singular}`}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <AppInput
              label="Nombre"
              value={nombre}
              onChangeText={setNombre}
              accessibilityLabel="Campo nombre"
            />
            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <View style={styles.modalAction}>
                <AppButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={onCancel}
                  accessibilityLabel={`Cancelar formulario de ${singular}`}
                />
              </View>
              <View style={styles.modalAction}>
                <AppButton
                  label="Guardar"
                  onPress={guardar}
                  accessibilityLabel={`Guardar ${singular}`}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CatalogoCrudTab({endpoint, plural, singular}: Props) {
  const [items, setItems] = useState<CatalogoItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<null | {
    editando: CatalogoItemDto | null;
  }>(null);
  const [confirm, setConfirm] = useState<null | {
    tipo: 'eliminar' | 'reactivar';
    item: CatalogoItemDto;
  }>(null);
  const [notificacion, setNotificacion] = useState<null | {
    tipo: 'ok' | 'error';
    texto: string;
  }>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listarCatalogo(endpoint));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(item => {
      const activo = esActivo(item.estado);
      const porEstado =
        estadoFiltro === 'TODOS' ||
        (estadoFiltro === 'ACTIVO' ? activo : !activo);
      const porBusqueda = !q || item.nombre.toLowerCase().includes(q);
      return porEstado && porBusqueda;
    });
  }, [items, estadoFiltro, busqueda]);

  const guardarFormulario = async (nombre: string) => {
    try {
      if (form?.editando) {
        await actualizarCatalogo(endpoint, form.editando.id, {nombre});
        setNotificacion({
          tipo: 'ok',
          texto: `Se actualizó "${nombre}" correctamente`,
        });
      } else {
        await crearCatalogo(endpoint, {nombre});
        setNotificacion({
          tipo: 'ok',
          texto: `Se agregó "${nombre}" correctamente`,
        });
      }
      setForm(null);
      await loadData();
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    }
  };

  const ejecutarConfirm = async () => {
    if (!confirm) {
      return;
    }
    const {tipo, item} = confirm;
    setConfirm(null);
    try {
      if (tipo === 'eliminar') {
        await eliminarCatalogo(endpoint, item.id);
        setNotificacion({
          tipo: 'ok',
          texto: `"${item.nombre}" pasó a Inactivo`,
        });
      } else {
        const payload: ActualizarCatalogoRequest = {
          nombre: item.nombre,
          estado: 'ACTIVO',
        };
        await actualizarCatalogo(endpoint, item.id, payload);
        setNotificacion({
          tipo: 'ok',
          texto: `"${item.nombre}" pasó a Activo`,
        });
      }
      await loadData();
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    }
  };

  const filtros = (
    <View style={styles.filters}>
      <View style={styles.pills}>
        {(['TODOS', 'ACTIVO', 'INACTIVO'] as EstadoFiltro[]).map(f => {
          const label =
            f === 'TODOS' ? 'Todos' : f === 'ACTIVO' ? 'Activos' : 'Inactivos';
          const activo = estadoFiltro === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar ${label}`}
              accessibilityState={{selected: activo}}
              onPress={() => setEstadoFiltro(f)}
              style={[styles.pill, activo && styles.pillActive]}>
              <Text style={[styles.pillText, activo && styles.pillTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <AppInput
        label="Buscar"
        value={busqueda}
        onChangeText={setBusqueda}
        accessibilityLabel={`Buscar ${singular}`}
      />
    </View>
  );

  const lista =
    filtrados.length > 0 ? (
      <View style={styles.list}>
        {filtrados.map(item => (
          <AppCard key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemName}>{item.nombre}</Text>
              <StatusChip
                tone={esActivo(item.estado) ? 'approved' : 'cancelled'}
                label={esActivo(item.estado) ? 'Activo' : 'Inactivo'}
              />
            </View>
            <View style={styles.cardActions}>
              <AppButton
                label="Editar"
                variant="text"
                icon="pencil-outline"
                onPress={() => setForm({editando: item})}
                accessibilityLabel={`Editar ${item.nombre}`}
              />
              {esActivo(item.estado) ? (
                item.puedeEliminar !== false ? (
                  <AppButton
                    label="Eliminar"
                    variant="text"
                    icon="trash-can-outline"
                    onPress={() => setConfirm({tipo: 'eliminar', item})}
                    accessibilityLabel={`Eliminar ${item.nombre}`}
                  />
                ) : null
              ) : (
                <AppButton
                  label="Reactivar"
                  variant="text"
                  icon="account-check-outline"
                  onPress={() => setConfirm({tipo: 'reactivar', item})}
                  accessibilityLabel={`Reactivar ${item.nombre}`}
                />
              )}
            </View>
          </AppCard>
        ))}
      </View>
    ) : items.length === 0 ? (
      <EmptyState
        title={`No hay ${plural.toLowerCase()}`}
        message={`Agregue el primer registro con el botón "Agregar ${singular}".`}
        icon="format-list-bulleted"
      />
    ) : (
      <EmptyState
        title="Sin resultados"
        message="Ningún registro coincide con el filtro o la búsqueda."
        icon="magnify-close"
      />
    );

  return (
    <View style={styles.tabContent}>
      {loading ? (
        <LoadingState message={`Cargando ${plural.toLowerCase()}…`} />
      ) : error ? (
        <ErrorState onRetry={loadData} />
      ) : (
        <>
          <AppButton
            label={`Agregar ${singular}`}
            icon="plus"
            onPress={() => setForm({editando: null})}
            accessibilityLabel={`Agregar ${singular}`}
          />
          {filtros}
          {lista}
        </>
      )}

      <FormModal
        visible={form !== null}
        singular={singular}
        editando={form?.editando ?? null}
        onCancel={() => setForm(null)}
        onSave={guardarFormulario}
      />
      <ConfirmDialog
        visible={confirm !== null}
        title={
          confirm?.tipo === 'reactivar'
            ? `Reactivar ${singular}`
            : `Eliminar ${singular}`
        }
        message={
          confirm
            ? confirm.tipo === 'reactivar'
              ? `¿Deseas reactivar "${confirm.item.nombre}"?`
              : `¿Deseas eliminar "${confirm.item.nombre}"? El registro pasará a Inactivo y dejará de estar disponible para nuevos requerimientos.`
            : ''
        }
        confirmLabel={
          confirm?.tipo === 'reactivar' ? 'Reactivar' : 'Eliminar'
        }
        tone={confirm?.tipo === 'reactivar' ? 'default' : 'danger'}
        confirmAccessibilityLabel={
          confirm?.tipo === 'reactivar'
            ? 'Confirmar reactivación'
            : 'Confirmar eliminación'
        }
        onCancel={() => setConfirm(null)}
        onConfirm={ejecutarConfirm}
      />
      <MessageDialog
        visible={notificacion !== null}
        title={notificacion?.tipo === 'error' ? 'Error' : 'Listo'}
        message={notificacion?.texto ?? ''}
        tone={notificacion?.tipo === 'error' ? 'error' : 'success'}
        onClose={() => setNotificacion(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    gap: theme.spacing[4],
  },
  filters: {
    gap: theme.spacing[3],
  },
  pills: {
    flexDirection: 'row',
    gap: theme.spacing[2],
  },
  pill: {
    paddingHorizontal: theme.spacing[4],
    minHeight: 44,
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
  list: {
    gap: theme.spacing[3],
  },
  card: {
    gap: theme.spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  itemName: {
    flex: 1,
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
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
  modalTitle: {
    fontFamily: theme.typography.h4.fontFamily,
    fontSize: theme.typography.h4.fontSize,
    lineHeight: theme.typography.h4.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[4],
  },
  formError: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.status.error,
    marginBottom: theme.spacing[3],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
  },
  modalAction: {
    flex: 1,
  },
});
