import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler, TOKEN_KEY } from '../services/api.js';
import * as authService from '../services/auth.service.js';
import { storage } from '../utils/storage.js';

const AuthContext = createContext(null);

// Sesión del usuario: token en localStorage y usuario validado contra /auth/me.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (storage.get(TOKEN_KEY) ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!storage.get(TOKEN_KEY)) return;
    let cancelled = false;
    authService
      .fetchMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => !cancelled && logout());
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await authService.login(email, password);
    storage.set(TOKEN_KEY, token);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, hasRole: (...roles) => Boolean(user && roles.includes(user.role)) }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
