import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import ServerCheckScreen from '../screens/ServerCheckScreen';
import LoginScreen from '../screens/LoginScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CambiarPasswordScreen from '../screens/CambiarPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import PerfilScreen from '../screens/PerfilScreen';
import CatalogosScreen from '../screens/CatalogosScreen';
import ProgramacionScreen from '../screens/ProgramacionScreen';
import ProgramacionEdicionScreen from '../screens/ProgramacionEdicionScreen';
import RequerimientosPanelScreen from '../screens/RequerimientosPanelScreen';
import RequerimientosListScreen from '../screens/RequerimientosListScreen';
import RequerimientoFormScreen from '../screens/RequerimientoFormScreen';
import NuevoRequerimientoScreen from '../screens/NuevoRequerimientoScreen';
import HistorialRequerimientoScreen from '../screens/HistorialRequerimientoScreen';
import EditarRequerimientoScreen from '../screens/EditarRequerimientoScreen';
import DespachoListScreen from '../screens/DespachoListScreen';
import DespachoFormScreen from '../screens/DespachoFormScreen';
import RecepcionListScreen from '../screens/RecepcionListScreen';
import RecepcionFormScreen from '../screens/RecepcionFormScreen';
import LiberacionListScreen from '../screens/LiberacionListScreen';
import LiberacionFormScreen from '../screens/LiberacionFormScreen';
import DetalleRequerimientoScreen from '../screens/DetalleRequerimientoScreen';
import NotificacionesScreen from '../screens/NotificacionesScreen';
import {theme} from '../theme';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navegación condicional por estado de autenticación (modelo reutilizable
 * §8.3 + ADR-A003):
 * - Sin sesión               → ServerCheck → Login (+ Configurar servidor).
 * - Sesión con reset de pwd  → CambiarPassword (única pantalla, sin back).
 * - Sesión normal            → Home según perfil + placeholders + Settings.
 * La `key` del Navigator fuerza el remontaje del stack en cada transición de
 * estado para evitar restos de historial entre flujos.
 */
export default function RootNavigator() {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.colors.action.secondary} />
      </View>
    );
  }

  const navigationKey = !user
    ? 'anon'
    : user.passwordResetRequired
      ? `reset-${user.sub ?? 'user'}`
      : `home-${user.sub ?? 'user'}`;

  return (
    <NavigationContainer>
      <Stack.Navigator key={navigationKey}>
        {!user ? (
          <>
            <Stack.Screen
              name="ServerCheck"
              component={ServerCheckScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ConfigurarServidor"
              component={SettingsScreen}
              options={{title: 'Configurar servidor'}}
            />
          </>
        ) : user.passwordResetRequired ? (
          <Stack.Screen
            name="CambiarPassword"
            component={CambiarPasswordScreen}
            options={{headerShown: false, gestureEnabled: false}}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen name="Catalogos" component={CatalogosScreen} options={{headerShown: false}} />
            <Stack.Screen name="Perfil" component={PerfilScreen} options={{headerShown: false}} />
            <Stack.Screen
              name="NuevoRequerimiento"
              component={NuevoRequerimientoScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="HistorialRequerimiento"
              component={HistorialRequerimientoScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RequerimientosList"
              component={RequerimientosListScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RequerimientoForm"
              component={RequerimientoFormScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="EditarRequerimiento"
              component={EditarRequerimientoScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Programacion"
              component={ProgramacionScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ProgramacionEdicion"
              component={ProgramacionEdicionScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="SolicitudRequerimientos"
              component={RequerimientosPanelScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="DetalleRequerimiento"
              component={DetalleRequerimientoScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="DespachoList"
              component={DespachoListScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="DespachoForm"
              component={DespachoFormScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RecepcionList"
              component={RecepcionListScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="RecepcionForm"
              component={RecepcionFormScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="LiberacionList"
              component={LiberacionListScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="LiberacionForm"
              component={LiberacionFormScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="ConfigurarServidor"
              component={SettingsScreen}
              options={{title: 'Configurar servidor'}}
            />
            <Stack.Screen
              name="Notificaciones"
              component={NotificacionesScreen}
              options={{headerShown: false}}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.background.page,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
