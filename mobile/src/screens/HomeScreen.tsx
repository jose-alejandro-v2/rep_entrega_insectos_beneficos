import React, {useEffect} from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import MenuButton from '../components/MenuButton';
import type {MenuScreen, RootStackParamList} from '../navigation/types';
import BottomNavigation from '../components/BottomNavigation';
import {theme} from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  label: string;
  screen: MenuScreen;
}

/**
 * Menú por perfil (ADR-A002 D-AUTH-2, literales ADR-A003 D-AUTH2-1):
 * - Usuario      → 2 botones: Nuevo Requerimiento / Historial de Requerimiento.
 * - Admin        → 2 botones: Programación / Solicitud de Requerimientos.
 * - Super Admin  → 2 divs: [Programación + Solicitud] y [Nuevo + Historial].
 * Los textos de los botones son EXACTOS al ADR.
 *
 * HITO-003 (delta): tokens Vanguard (0 hardcodes), V6: back físico
 * interceptado (raíz del stack autenticado → NO cierra la app). Sin bloques
 * de "Configurar servidor"/"Cerrar sesión" en el Home (decisión del usuario
 * 2026-08-20 — el logout vive en Perfil).
 */
const MENU_POR_PERFIL: Record<string, MenuItem[][]> = {
  Usuario: [
    [
      {label: 'Nuevo Requerimiento', screen: 'NuevoRequerimiento'},
      {label: 'Historial de Requerimiento', screen: 'HistorialRequerimiento'},
    ],
  ],
  Admin: [
    [
      {label: 'Programación', screen: 'Programacion'},
      {label: 'Solicitud de Requerimientos', screen: 'SolicitudRequerimientos'},
    ],
  ],
  'Super Admin': [
    [
      {label: 'Programación', screen: 'Programacion'},
      {label: 'Solicitud de Requerimientos', screen: 'SolicitudRequerimientos'},
    ],
    [
      {label: 'Nuevo Requerimiento', screen: 'NuevoRequerimiento'},
      {label: 'Historial de Requerimiento', screen: 'HistorialRequerimiento'},
    ],
  ],
};

export default function HomeScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<Navigation>();

  // V6: back físico en raíz del stack autenticado → interceptar (no cerrar).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!user) {
    return null;
  }

  const grupos = MENU_POR_PERFIL[user.rol] ?? MENU_POR_PERFIL.Usuario;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}>
        <Text style={styles.welcome}>Bienvenido(a),</Text>
        <Text style={styles.welcome_sub}>{user.nombre}</Text>
        <Text style={styles.perfil}>Perfil: {user.rol}</Text>

        {grupos.map((grupo, index) => (
          <View
            key={index}
            style={[
              styles.div,
              index % 2 === 0 ? styles.divVarianteUno : styles.divVarianteDos,
            ]}>
            {grupo.map(item => (
              <MenuButton
                key={item.screen}
                label={item.label}
                screen={item.screen}
                navigation={navigation}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <BottomNavigation active="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  content: {
    padding: theme.spacing[5],
    paddingBottom: 40,
  },
  welcome: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: theme.typography.h2.fontSize,
    lineHeight: theme.typography.h2.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
    welcome_sub: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: theme.typography.h3.fontSize,
    lineHeight: theme.typography.h3.lineHeight,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  perfil: {
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[5],
    textTransform: 'capitalize',
  },
  // "dvs" del SUPER_ADMIN: grupos visuales diferenciados por estilo de
  // contenedor (sin texto extra; los textos exactos del ADR son los botones).
  div: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
  },
  divVarianteUno: {
    backgroundColor: theme.colors.background.paper,
    borderColor: theme.colors.action.secondary,
  },
  divVarianteDos: {
    backgroundColor: theme.colors.background.paper,
    borderColor: theme.colors.action.secondary,
  },
});