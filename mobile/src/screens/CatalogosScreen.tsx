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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppHeader from '../components/AppHeader';
import AppInput from '../components/AppInput';
import BottomNavigation from '../components/BottomNavigation';
import ConfirmDialog from '../components/ConfirmDialog';
import MessageDialog from '../components/MessageDialog';
import EmptyState from '../components/EmptyState';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import StatusChip from '../components/StatusChip';
import {useAuth} from '../context/AuthContext';
import {
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  extractErrorMessage,
  fetchRoles,
  listarUsuarios,
  type ActualizarUsuarioRequest,
  type CrearUsuarioRequest,
  type RolDto,
  type UsuarioDto,
} from '../services/ApiClient';
import {theme} from '../theme';
import {isAdminOrSuperAdmin} from '../utils/roles';

type CatalogosTab = 'Usuarios' | 'Perfiles';
type EstadoFiltro = 'TODOS' | 'ACTIVO' | 'INACTIVO';

/** Perfiles (solo informativo): descripciones de la spec §6 — NO editables. */
const PERFILES: Array<{nombre: string; icono: string; descripcion: string}> = [
  {
    nombre: 'Super Admin',
    icono: 'shield-account-outline',
    descripcion:
      'Control total: gestión de todos los usuarios, módulos y configuración.',
  },
  {
    nombre: 'Admin',
    icono: 'account-cog-outline',
    descripcion:
      'Gestión de usuarios de perfil admin y usuario; publicación de stock, proyecciones, despachos, reportes, dashboard, catálogos y monitoreo operativo.',
  },
  {
    nombre: 'Usuario',
    icono: 'account-outline',
    descripcion:
      'Acceso operativo para registro de requerimientos, validación de recepción, liberación en campo y captura de evidencias fotográficas.',
  },
];

function formatFecha(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FormFields {
  usuario: string;
  nombre: string;
  rolId: number | null;
  email: string;
}

interface UsuarioFormModalProps {
  visible: boolean;
  editando: UsuarioDto | null;
  roles: RolDto[];
  onCancel: () => void;
  onSave: (fields: FormFields) => void;
}

/**
 * UsuarioFormModal — Modal LOCAL de Catálogos para crear/editar usuarios.
 * Política SA inamovible: el selector de perfil NUNCA muestra "Super Admin"
 * (ni para Super Admin); solo se gestionan Admin y Usuario.
 * Crear: solo Usuario (login) + Perfil — el Nombre se inicializa con el
 * usuario y el DNI no se registra (se establece en el primer acceso).
 * Editar: Usuario + Nombre + Perfil + DNI SOLO LECTURA (el backend no
 * permite cambiarlo en PUT).
 */
function UsuarioFormModal({
  visible,
  editando,
  roles,
  onCancel,
  onSave,
}: UsuarioFormModalProps) {
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [rolId, setRolId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const opcionesRol = useMemo(
    () => roles.filter(r => r.nombre !== 'Super Admin'),
    [roles],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editando) {
      setUsuario(editando.usuario);
      setNombre(editando.nombre);
      setRolId(editando.rolId);
      setEmail(editando.email ?? '');
    } else {
      setUsuario('');
      setNombre('');
      setRolId(opcionesRol[0]?.id ?? null);
      setEmail('');
    }
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editando]);

  const guardar = () => {
    const u = usuario.trim();
    if (!u) {
      setFormError('El usuario (login) es obligatorio');
      return;
    }
    if (rolId == null) {
      setFormError('Seleccione un perfil');
      return;
    }
    const correo = email.trim();
    if (
      correo &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
    ) {
      setFormError('El correo electrónico no es válido');
      return;
    }
    // En creación no se pide Nombre: se inicializa con el usuario.
    const n = editando ? nombre.trim() : u;
    if (editando && !n) {
      setFormError('El nombre es obligatorio');
      return;
    }
    onSave({usuario: u, nombre: n, rolId, email: correo});
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
            {editando ? 'Editar usuario' : 'Nuevo usuario'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <AppInput
              label="Usuario (login)"
              value={usuario}
              onChangeText={setUsuario}
              autoCapitalize="none"
              accessibilityLabel="Campo usuario"
            />
            {editando ? (
              <AppInput
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                accessibilityLabel="Campo nombre"
              />
            ) : null}
            <AppInput
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Campo correo electrónico"
            />
            <Text style={styles.hint}>
              Correo para notificaciones del sistema (opcional).
            </Text>
            <Text style={styles.inputLabel}>Perfil</Text>
            <View style={styles.rolRow}>
              {opcionesRol.map(r => {
                const activo = rolId === r.id;
                return (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Perfil ${r.nombre}`}
                    accessibilityState={{selected: activo}}
                    onPress={() => setRolId(r.id)}
                    style={[
                      styles.rolPill,
                      activo && styles.rolPillActive,
                    ]}>
                    <Text
                      style={[
                        styles.rolPillText,
                        activo && styles.rolPillTextActive,
                      ]}>
                      {r.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {editando ? (
              <>
                <AppInput
                  label="DNI"
                  value={editando.dni ?? ''}
                  editable={false}
                  accessibilityLabel="Campo DNI"
                />
                <Text style={styles.hint}>
                  El DNI no se puede modificar (contraseña del primer acceso).
                </Text>
              </>
            ) : (
              <Text style={styles.hint}>
                La contraseña inicial es 00000000; el usuario deberá cambiarla
                en su primer acceso.
              </Text>
            )}
            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <View style={styles.modalAction}>
                <AppButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={onCancel}
                  accessibilityLabel="Cancelar formulario de usuario"
                />
              </View>
              <View style={styles.modalAction}>
                <AppButton
                  label="Guardar"
                  onPress={guardar}
                  accessibilityLabel="Guardar usuario"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CatalogosScreen() {
  const {user} = useAuth();
  const insets = useSafeAreaInsets();
  const puedeGestionar = isAdminOrSuperAdmin(user);

  const [tab, setTab] = useState<CatalogosTab>('Usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioDto[]>([]);
  const [roles, setRoles] = useState<RolDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<null | {
    editando: UsuarioDto | null;
  }>(null);
  const [confirm, setConfirm] = useState<null | {
    tipo: 'desactivar' | 'reactivar';
    usuario: UsuarioDto;
  }>(null);

  // Admin/SA inicia en Usuarios; el resto solo ve la pestaña informativa.
  useEffect(() => {
    setTab(puedeGestionar ? 'Usuarios' : 'Perfiles');
  }, [puedeGestionar]);

  const loadData = useCallback(async () => {
    if (!puedeGestionar) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([listarUsuarios(), fetchRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [puedeGestionar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // Política SA inamovible: el listado solo gestiona Admin y Usuario.
    return usuarios
      .filter(u => u.rol !== 'Super Admin')
      .filter(u => {
        const porEstado =
          estadoFiltro === 'TODOS' || u.estado === estadoFiltro;
        const porBusqueda =
          !q ||
          u.nombre.toLowerCase().includes(q) ||
          u.usuario.toLowerCase().includes(q) ||
          (u.dni ?? '').toLowerCase().includes(q);
        return porEstado && porBusqueda;
      });
  }, [usuarios, estadoFiltro, busqueda]);

  const ejecutarConfirm = async () => {
    if (!confirm) {
      return;
    }
    const {tipo, usuario: target} = confirm;
    setConfirm(null);
    try {
      if (tipo === 'desactivar') {
        await desactivarUsuario(target.id);
        setNotificacion({
          tipo: 'ok',
          texto: `Usuario "${target.usuario}" desactivado correctamente`,
        });
      } else {
        await actualizarUsuario(target.id, {
          usuario: target.usuario,
          nombre: target.nombre,
          rolId: target.rolId,
          estado: 'ACTIVO',
          // Reactivar no debe limpiar el correo (HITO-018).
          email: target.email ?? null,
        });
        setNotificacion({
          tipo: 'ok',
          texto: `Usuario "${target.usuario}" reactivado correctamente`,
        });
      }
      await loadData();
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    }
  };

  const guardarFormulario = async (fields: FormFields) => {
    try {
      if (form?.editando) {
        const payload: ActualizarUsuarioRequest = {
          usuario: fields.usuario,
          nombre: fields.nombre,
          rolId: fields.rolId as number,
          estado: form.editando.estado,
        };
        // Email: vacío limpia (backend); ausente/null preserva el actual.
        payload.email = fields.email;
        await actualizarUsuario(form.editando.id, payload);
        setNotificacion({
          tipo: 'ok',
          texto: 'Usuario actualizado correctamente',
        });
      } else {
        const payload: CrearUsuarioRequest = {
          usuario: fields.usuario,
          nombre: fields.nombre,
          rolId: fields.rolId as number,
        };
        if (fields.email) {
          payload.email = fields.email;
        }
        await crearUsuario(payload);
        setNotificacion({
          tipo: 'ok',
          texto:
            'Usuario creado correctamente. Deberá iniciar con la contraseña por defecto 00000000 y cambiarla en su primer acceso.',
        });
      }
      setForm(null);
      await loadData();
    } catch (e) {
      setNotificacion({tipo: 'error', texto: extractErrorMessage(e)});
    }
  };

  if (!user) {
    return null;
  }

  const renderFiltros = (
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
        accessibilityLabel="Buscar usuario"
      />
    </View>
  );

  const renderUsuariosTab = () => {
    if (loading) {
      return <LoadingState message="Cargando usuarios…" />;
    }
    if (error) {
      return <ErrorState onRetry={loadData} />;
    }
    const lista =
      filtrados.length > 0 ? (
        <View style={styles.list}>
          {filtrados.map(u => (
            <AppCard key={u.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userTitle}>
                  <Text style={styles.userName}>{u.nombre}</Text>
                  <Text style={styles.userLogin}>@{u.usuario}</Text>
                  {u.email ? (
                    <Text style={styles.userEmail}>{u.email}</Text>
                  ) : null}
                </View>
                <StatusChip
                  tone="info"
                  label={u.rol}
                />
              </View>
              <View style={styles.userMeta}>
                <StatusChip
                  tone={u.estado === 'ACTIVO' ? 'approved' : 'cancelled'}
                  label={u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                />
                <Text style={styles.userLastLogin}>
                  Última sesión: {formatFecha(u.lastLoginAt)}
                </Text>
              </View>
              <View style={styles.userActions}>
                <AppButton
                  label="Editar"
                  variant="text"
                  icon="pencil-outline"
                  onPress={() => setForm({editando: u})}
                  accessibilityLabel={`Editar ${u.usuario}`}
                />
                {u.estado === 'ACTIVO' ? (
                  <AppButton
                    label="Desactivar"
                    variant="text"
                    icon="account-off-outline"
                    onPress={() =>
                      setConfirm({tipo: 'desactivar', usuario: u})
                    }
                    accessibilityLabel={`Desactivar ${u.usuario}`}
                  />
                ) : (
                  <AppButton
                    label="Reactivar"
                    variant="text"
                    icon="account-check-outline"
                    onPress={() =>
                      setConfirm({tipo: 'reactivar', usuario: u})
                    }
                    accessibilityLabel={`Reactivar ${u.usuario}`}
                  />
                )}
              </View>
            </AppCard>
          ))}
        </View>
      ) : !usuarios.some(u => u.rol !== 'Super Admin') ? (
        <EmptyState
          title="No hay usuarios registrados"
          message="Registre el primer usuario con el botón Nuevo usuario."
          icon="account-group-outline"
        />
      ) : (
        <EmptyState
          title="Sin resultados"
          message="Ningún usuario coincide con el filtro o la búsqueda."
          icon="magnify-close"
        />
      );
    return (
      <View style={styles.tabContent}>
        <AppButton
          label="Nuevo usuario"
          icon="account-plus-outline"
          onPress={() => setForm({editando: null})}
          accessibilityLabel="Nuevo usuario"
        />
        {renderFiltros}
        {lista}
      </View>
    );
  };

  const renderPerfilesTab = () => (
    <View style={styles.tabContent}>
      {PERFILES.map(p => (
        <AppCard key={p.nombre} style={styles.perfilCard}>
          <View style={styles.perfilHeader}>
            <MaterialCommunityIcons
              name={p.icono}
              size={24}
              color={theme.colors.action.secondary}
            />
            <Text style={styles.perfilName}>{p.nombre}</Text>
          </View>
          <Text style={styles.perfilDesc}>{p.descripcion}</Text>
        </AppCard>
      ))}
    </View>
  );

  return (
    <ErrorBoundary
      fallbackTitle="No se pudo cargar catálogos"
      fallbackMessage="Reintente nuevamente o cierre su sesión.">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AppHeader title="Catálogos" />
        {puedeGestionar ? (
          <View style={styles.tabs}>
            {(['Usuarios', 'Perfiles'] as CatalogosTab[]).map(t => {
              const activo = tab === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityLabel={`Tab ${t}`}
                  accessibilityState={{selected: activo}}
                  onPress={() => setTab(t)}
                  style={[styles.tab, activo && styles.tabActive]}>
                  <Text
                    style={[styles.tabText, activo && styles.tabTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {paddingBottom: 32 + insets.bottom + 68},
          ]}>
          {tab === 'Usuarios' && puedeGestionar
            ? renderUsuariosTab()
            : renderPerfilesTab()}
        </ScrollView>
        <BottomNavigation active="Catalogos" />

        <UsuarioFormModal
          visible={form !== null}
          editando={form?.editando ?? null}
          roles={roles}
          onCancel={() => setForm(null)}
          onSave={guardarFormulario}
        />
        <ConfirmDialog
          visible={confirm !== null}
          title={
            confirm?.tipo === 'reactivar' ? 'Reactivar usuario' : 'Desactivar usuario'
          }
          message={
            confirm
              ? confirm.tipo === 'reactivar'
                ? `¿Deseas reactivar el usuario "${confirm.usuario.usuario}"?`
                : `¿Deseas desactivar el usuario "${confirm.usuario.usuario}"? Los usuarios desactivados no podrán acceder al sistema.`
              : ''
          }
          confirmLabel={confirm?.tipo === 'reactivar' ? 'Reactivar' : 'Desactivar'}
          tone={confirm?.tipo === 'reactivar' ? 'default' : 'danger'}
          confirmAccessibilityLabel={
            confirm?.tipo === 'reactivar'
              ? 'Confirmar reactivación'
              : 'Confirmar desactivación'
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[1],
    marginHorizontal: theme.spacing[4],
    marginTop: theme.spacing[2],
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.background.paper,
    ...theme.shadows.z1,
  },
  tabText: {
    fontFamily: theme.typography.button.fontFamily,
    fontSize: theme.typography.button.fontSize,
    color: theme.colors.text.secondary,
  },
  tabTextActive: {
    color: theme.colors.action.secondary,
  },
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
  userCard: {
    gap: theme.spacing[3],
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
  },
  userTitle: {
    flex: 1,
  },
  userName: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: theme.typography.subtitle2.fontSize,
    lineHeight: theme.typography.subtitle2.lineHeight,
    color: theme.colors.text.primary,
  },
  userLogin: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  userEmail: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.tertiary,
    marginTop: 1,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  userLastLogin: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.tertiary,
    flexShrink: 1,
  },
  userActions: {
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
  inputLabel: {
    fontFamily: theme.typography.subtitle2.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[1] + 2,
  },
  rolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  rolPill: {
    paddingHorizontal: theme.spacing[4],
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolPillActive: {
    backgroundColor: theme.colors.action.secondary,
    borderColor: theme.colors.action.secondary,
  },
  rolPillText: {
    fontFamily: theme.typography.button.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  rolPillTextActive: {
    color: theme.colors.text.inverse,
  },
  hint: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing[3],
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
  perfilCard: {
    gap: theme.spacing[2],
  },
  perfilHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  perfilName: {
    fontFamily: theme.typography.subtitle1.fontFamily,
    fontSize: theme.typography.subtitle1.fontSize,
    lineHeight: theme.typography.subtitle1.lineHeight,
    color: theme.colors.text.primary,
  },
  perfilDesc: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
  },
});