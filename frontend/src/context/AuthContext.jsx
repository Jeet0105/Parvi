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

  // Restore a previous session on first paint so a refresh does not log the
  // user out. The token is still verified by the backend on every request.
  useEffect(() => {
    const token = getToken();
    const stored = readStoredUser();
    if (token && stored) setUser(stored);
    setInitialising(false);
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
