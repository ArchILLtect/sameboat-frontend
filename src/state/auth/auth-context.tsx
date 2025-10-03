/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthStore, AuthUser } from './types';
import { api } from '../../lib/api';
import { isBackendAuthErrorPayload, mapAuthError } from './errors';
import { emit } from '../../lib/events';

// Endpoint paths (centralized so migrations are single-touch)
// NOTE: User self endpoint on backend is dual-mapped as /me and /api/me (NOT /auth/me)
// Previous value '/api/auth/me' caused 401s because that route does not return the session user.
const LOGIN_PATH = '/api/auth/login';
const REGISTER_PATH = '/api/auth/register';
const ME_PATH = '/api/me';
const LOGOUT_PATH = '/api/auth/logout';

interface RawUser { id: string; email: string; roles?: string[]; displayName?: string | null }
function isRawUser(v: unknown): v is RawUser {
  return !!v && typeof v === 'object' && 'id' in v && 'email' in v;
}
function extractRawUser(v: unknown): RawUser | undefined {
  if (isRawUser(v)) return normalizeUser(v);
  if (v && typeof v === 'object' && 'user' in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>).user;
    if (isRawUser(inner)) return normalizeUser(inner);
  }
  return undefined;
}
function normalizeUser(u: { id: string; email: string; roles?: unknown; role?: unknown; displayName?: unknown; name?: unknown }): RawUser {
  const roles = !u.roles && typeof u.role === 'string'
    ? [u.role]
    : Array.isArray(u.roles)
      ? u.roles.filter(r => typeof r === 'string') as string[]
      : typeof u.roles === 'string' ? [u.roles] : undefined;
  return { id: u.id, email: u.email, roles, displayName: (typeof u.displayName === 'string' ? u.displayName : (typeof u.name === 'string' ? u.name : null)) };
}

const AuthContext = createContext<AuthStore | null>(null);

// React 18/19 StrictMode intentionally mounts, unmounts, then remounts components
// to surface unsafe side effects. Our bootstrap effect would call `refresh()` twice
// leading to duplicate unauthenticated 401s in the console (plus the debug panel probe = 3).
// Track a module-level flag so we only perform the initial refresh exactly once per page load.
let didInitialBootstrapAttempt = false;
// Vitest exposes VITEST env var; we detect it without using `any` casts
const isVitest = typeof process !== 'undefined' && Boolean((process as unknown as { env?: Record<string, unknown> }).env?.VITEST);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStore['status']>('idle');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lastFetched, setLastFetched] = useState<number | undefined>();
  const [bootstrapped, setBootstrapped] = useState(false);

  const bootstrappedRef = useRef(false);
  const mountedRef = useRef(false);
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] mounted', { mountedRef: mountedRef.current });
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] mounted', { mountedRef: mountedRef.current });

  // Removed previous heartbeat interval that logged every second until bootstrap; fail-safe timeout below remains sufficient.

  // Normalize & record error state
  const recordError = useCallback((code: string | undefined, fallback?: string) => {
    const mapped = mapAuthError(code, fallback);
    if (!mountedRef.current) return;
    setErrorCode(mapped.code);
    setErrorMessage(mapped.message);
    setStatus('error');
  }, []);

  const clearError = useCallback(() => {
    if (!mountedRef.current) return;
    setErrorCode(undefined);
    setErrorMessage(undefined);
    if (status === 'error') setStatus(user ? 'authenticated' : 'idle');
  }, [status, user]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    let data: unknown | undefined;
    let hadError = false;
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() begin', { ME_PATH });
    setStatus(prev => (prev === 'idle' ? 'loading' : prev));
    try {
      data = await api<unknown>(ME_PATH, { method: 'GET', credentials: 'include', signal: controller.signal });
    } catch (e) {
      hadError = true;
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        // treat as unauthenticated on first run, error thereafter
        if (!bootstrappedRef.current) {
          if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() unauthenticated (expected first run)');
          if (mountedRef.current) {
            setUser(null);
            setStatus('idle');
            clearError();
          }
        } else {
          if (mountedRef.current) {
            setUser(null);
            recordError('UNAUTHORIZED');
          }
          if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() error after bootstrap', e);
        }
      } else {
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() aborted');
      }
    }
    if (!hadError && mountedRef.current) {
      const u = extractRawUser(data);
      if (u) {
        setUser(u);
        setStatus('authenticated');
        setLastFetched(Date.now());
        clearError();
        emit('auth:refresh', { user: u });
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() success (user)');
      } else {
        setUser(null);
        setStatus('idle');
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() success (no user)');
      }
    }
    bootstrappedRef.current = true;
    if (mountedRef.current) setBootstrapped(true);
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() end: bootstrapped = true');
  }, [clearError, recordError]);

  const login = useCallback<AuthStore['login']>(async (email, password) => {
    const controller = new AbortController();
    setStatus('loading');
  if (import.meta.env.DEV && !isVitest) console.debug("[auth] Attempting login...");
    clearError();
    let success = false;
    try {
      const res = await api<unknown>(LOGIN_PATH, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        signal: controller.signal
      });
      console.log(mountedRef.current);
      const u = extractRawUser(res);
      console.log(u);
      if (u) {
        if (mountedRef.current) {
          setUser(u);
          setStatus('authenticated');
          setLastFetched(Date.now());
        }
        emit('auth:login', { user: u });
        success = true;
      } else {
        await refresh(); // cookie set, no body scenario
        success = true;
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        let code: string | undefined; let fallback: string | undefined;
        if (e && typeof e === 'object' && 'message' in e) fallback = String((e as { message: unknown }).message);
        // structured backend payload attached as cause
        if (e && typeof e === 'object' && 'cause' in e && isBackendAuthErrorPayload((e as { cause?: unknown }).cause)) {
          code = (e as { cause?: { error?: string } }).cause?.error;
        }
        if (mountedRef.current) recordError(code || 'BAD_CREDENTIALS', fallback);
      }
      success = false;
    }
    return success;
  }, [clearError, recordError, refresh]);

  const register = useCallback<AuthStore['register']>(async (email, password) => {
    const controller = new AbortController();
    setStatus('loading');
    clearError();
    let success = false;
    try {
      const res = await api<unknown>(REGISTER_PATH, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        signal: controller.signal,
      });
      const u = extractRawUser(res);
      if (u) {
        if (mountedRef.current) {
          setUser(u);
          setStatus('authenticated');
          setLastFetched(Date.now());
        }
        success = true;
      } else {
        await refresh();
        success = true;
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        let code: string | undefined; let fallback: string | undefined;
        if (e && typeof e === 'object') {
          if ('message' in e) fallback = String((e as { message: unknown }).message);
          if ('cause' in e && isBackendAuthErrorPayload((e as { cause?: unknown }).cause)) {
            code = (e as { cause?: { error?: string } }).cause?.error;
          }
        }
        if (mountedRef.current) recordError(code || 'UNKNOWN_ERROR', fallback);
      }
      success = false;
    }
    return success;
   }, [clearError, recordError, refresh]);

  const logout = useCallback<AuthStore['logout']>(async () => {
    const controller = new AbortController();
    setStatus('loading');
    clearError();
    try {
      await api(LOGOUT_PATH, { method: 'POST', credentials: 'include', signal: controller.signal });
    } catch {
      // Ignore errors
    } finally {
      if (mountedRef.current) {
        setUser(null);
        setStatus('idle');
        setLastFetched(undefined);
      }
      emit('auth:logout');
    }
  }, [clearError]);

  // Bootstrap exactly once on mount
  useEffect(() => {
    if (!didInitialBootstrapAttempt) {
      didInitialBootstrapAttempt = true;
  if (import.meta.env.DEV && import.meta.env.VITE_API_DEBUG_BOOTSTRAP && !isVitest) console.debug('[auth] initial bootstrap refresh()');
      refresh();
  } else if (import.meta.env.DEV && !isVitest) {
      console.debug('[auth] skipped duplicate bootstrap refresh (StrictMode remount)');
    }
    // Safety fallback: ensure bootstrapped flips after 5s even if refresh hangs
    const failSafe = setTimeout(() => {
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() timeout fail-safe triggered');
      if (!bootstrappedRef.current && mountedRef.current) {
        bootstrappedRef.current = true;
        setBootstrapped(true);
        setStatus(prev => (prev === 'loading' ? 'idle' : prev));
  if (import.meta.env.DEV && !isVitest) console.debug('[auth] refresh() timeout fail-safe triggered');
      }
    }, 5000);
    return () => clearTimeout(failSafe);
  }, [refresh]);

  const value: AuthStore = useMemo(() => ({
    user,
    status,
    errorCode,
    errorMessage,
    lastFetched,
    bootstrapped,
    login,
    register,
    refresh,
    logout,
    clearError,
  }), [user, status, errorCode, errorMessage, lastFetched, bootstrapped, login, register, refresh, logout, clearError]);

  // Expose for deep debugging (dev only). Allows manual inspection: window.__AUTH__
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as { __AUTH__?: AuthStore }).__AUTH__ = value;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within <AuthProvider>');
  return ctx;
}
