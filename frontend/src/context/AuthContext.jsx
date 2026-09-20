import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import * as authApi from '../services/auth.service';
import { getToken, setToken } from '../services/apiClient';

export const USER_KEY = 'fip.user';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // Non-fatal: the session still works for this page load.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialising, setInitialising] = useState(true);

  // Restore a previous session on reload. The stored user is shown immediately
  // so the UI does not flash, then revalidated against /auth/me -- which also
  // picks up a role change or a revoked account made since the last visit.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = getToken();
      const stored = readStoredUser();

      if (!token) {
        setInitialising(false);
        return;
      }

      if (stored) setUser(stored);

      try {
        const response = await authApi.me();
        if (cancelled) return;
        writeStoredUser(response.data.user);
        setUser(response.data.user);
      } catch (error) {
        if (cancelled) return;
        // A rejected token means the session is over. Anything else (a network
        // blip) leaves the cached session in place rather than logging out.
        if (error.status === 401) {
          setToken(null);
          writeStoredUser(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitialising(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback(({ user: nextUser, token }) => {
    setToken(token);
    writeStoredUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await authApi.login(credentials);
      return applySession(response.data);
    },
    [applySession]
  );

  const register = useCallback(
    async (details) => {
      const response = await authApi.register(details);
      return applySession(response.data);
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setToken(null);
    writeStoredUser(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      initialising,
      login,
      register,
      logout,
    }),
    [user, initialising, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
