import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  changePassword,
  clearToken,
  extractErrorMessage,
  getToken,
  localLogin,
  parseToken,
  setToken,
  setUnauthorizedHandler,
  type AuthUser,
} from '../services/ApiClient';
import NotificationService from '../services/NotificationService';

interface AuthContextType {
  /** Usuario decodificado del JWT (null = sin sesión). */
  user: AuthUser | null;
  /** `true` mientras se restaura la sesión persistida al arrancar. */
  loading: boolean;
  error: string | null;
  login: (usuarioId: number, password: string) => Promise<void>;
  cambiarPassword: (
    newPassword: string,
    contrasenaActual?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Estado global de autenticación (HITO-002 / modelo reutilizable §8.1):
 * - Al arrancar restaura la sesión leyendo el token desde el SecureStore.
 * - `login(usuarioId, password)` → POST /auth/local-login → guarda el JWT en
 *   Keychain y decodifica `user` (no depende de una respuesta con datos).
 * - `cambiarPassword(...)` → POST /auth/change-password → guarda el NUEVO
 *   token (ya sin `passwordResetRequired`) y refresca `user`.
 * - Ante cualquier 401 global, `setUnauthorizedHandler` limpia la sesión.
 */
export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restauración de sesión al arrancar. El uso de la sesión persistida no
  // implica soporte offline: cualquier operación posterior requiere API.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (mounted && token) {
          const parsed = parseToken(token);
          if (parsed) {
            setUser(parsed);
            // Inicializar notificaciones push si hay sesión persistida
            NotificationService.initialize(Number(parsed.sub));
          } else {
            await clearToken();
          }
        }
      } catch {
        // Sin sesión persistida: flujo normal de login.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    setUnauthorizedHandler(() => {
      if (mounted) {
        setUser(null);
      }
    });
    return () => {
      mounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (usuarioId: number, password: string) => {
    setError(null);
    try {
      const data = await localLogin(usuarioId, password);
      await setToken(data.token);
      const parsed = parseToken(data.token);
      setUser(parsed);

      // Inicializar notificaciones push (ADR-A004)
      if (parsed?.sub) {
        NotificationService.initialize(Number(parsed.sub));
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, []);

  const cambiarPassword = useCallback(
    async (newPassword: string, contrasenaActual?: string) => {
      setError(null);
      if (!user) {
        return;
      }
      try {
        const data = await changePassword(newPassword, contrasenaActual);
        await setToken(data.token);
        setUser(parseToken(data.token));
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    },
    [user],
  );

  const logout = useCallback(() => {
    // Limpiar notificaciones push (ADR-A004)
    NotificationService.cleanup().catch(() => {});
    clearToken().catch(() => {});
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({user, loading, error, login, cambiarPassword, logout}),
    [user, loading, error, login, cambiarPassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}
