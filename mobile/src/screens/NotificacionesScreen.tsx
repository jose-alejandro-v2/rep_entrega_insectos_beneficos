import React, {useEffect, useState, useCallback} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import BottomNavigation from '../components/BottomNavigation';
import {api} from '../services/ApiClient';
import {theme} from '../theme';
import type {RootStackParamList} from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leido: boolean;
  fechaCreacion: string;
}

/**
 * NotificacionesScreen — Centro de notificaciones in-app (ADR-A004).
 * Lista todas las notificaciones del usuario con indicador de leído/no leído.
 * Se accede desde el Home o desde el icono de campana.
 */
export default function NotificacionesScreen() {
  const navigation = useNavigation<Navigation>();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarNotificaciones = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/notificaciones');
      setNotificaciones(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.mensaje ||
        err?.response?.data?.error ||
        err?.message ||
        'Error al cargar notificaciones';
      setError(msg);
      console.error('[NotificacionesScreen] Error al cargar notificaciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  const marcarLeida = async (id: number) => {
    try {
      await api.patch(`/notificaciones/${id}/leer`);
      setNotificaciones(prev =>
        prev.map(n => (n.id === id ? {...n, leido: true} : n)),
      );
    } catch (err) {
      console.error('[NotificacionesScreen] Error al marcar como leída:', err);
    }
  };

  const renderItem = ({item}: {item: Notificacion}) => (
    <View
      style={[styles.item, !item.leido && styles.itemNoLeido]}
      onTouchEnd={() => marcarLeida(item.id)}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitulo, !item.leido && styles.itemTituloNoLeido]}>
          {item.titulo}
        </Text>
        {!item.leido && <View style={styles.badge} />}
      </View>
      <Text style={styles.itemMensaje}>{item.mensaje}</Text>
      <Text style={styles.itemFecha}>{item.fechaCreacion}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppHeader title="Notificaciones" showBack onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Cargando notificaciones...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText} onPress={cargarNotificaciones}>
              Reintentar
            </Text>
          </View>
        ) : notificaciones.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No hay notificaciones</Text>
          </View>
        ) : (
          <FlatList
            data={notificaciones}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <BottomNavigation active="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.page,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.status.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryText: {
    fontSize: 15,
    color: theme.colors.action.primary,
    textDecorationLine: 'underline',
  },
  list: {
    padding: 16,
  },
  item: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.border.subtle,
  },
  itemNoLeido: {
    borderLeftColor: theme.colors.action.primary,
    backgroundColor: '#F0F7FF',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  itemTituloNoLeido: {
    fontWeight: '700',
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.action.primary,
    marginLeft: 8,
  },
  itemMensaje: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  itemFecha: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
});
