import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const LS_ACCESS = 'aegis_access_token';
const LS_REFRESH = 'aegis_refresh_token';
const LS_USER = 'aegis_user';

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACCESS);
      const r = localStorage.getItem(LS_REFRESH);
      const u = localStorage.getItem(LS_USER);
      if (a) setAccessToken(a);
      if (r) setRefreshToken(r);
      if (u) setUser(JSON.parse(u));
    } catch {
      // ignore
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const persist = (next) => {
    const { access_token, refresh_token, user: nextUser } = next;
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
    setUser(nextUser);
    localStorage.setItem(LS_ACCESS, access_token);
    localStorage.setItem(LS_REFRESH, refresh_token);
    localStorage.setItem(LS_USER, JSON.stringify(nextUser));
  };

  const clear = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_USER);
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'Login failed');
    persist({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
    return data.user;
  };

  const register = async (email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'Registration failed');
    persist({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
    return data.user;
  };

  const refresh = async () => {
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || 'Session refresh failed');
    persist({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
    return data;
  };

  const apiFetch = async (url, options = {}) => {
    const doFetch = async (token) => {
      const headers = { ...(options.headers || {}) };
      if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        // Only set JSON content-type when it's not FormData
        if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
      }
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(url, { ...options, headers });
    };

    let res = await doFetch(accessToken);
    if (res.status !== 401) return res;

    // Retry once with refresh rotation
    try {
      await refresh();
      res = await doFetch(localStorage.getItem(LS_ACCESS));
      return res;
    } catch (e) {
      clear();
      throw e;
    }
  };

  const value = useMemo(() => ({
    bootstrapped,
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!accessToken,
    login,
    register,
    logout: clear,
    apiFetch,
  }), [bootstrapped, user, accessToken, refreshToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

