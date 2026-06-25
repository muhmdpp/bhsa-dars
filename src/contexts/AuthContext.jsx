import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL    = import.meta.env.VITE_ADMIN_EMAIL    || '';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

const DEFAULT_PIN        = '2608';
const LOGIN_STORAGE      = 'bhsa_logged_in';
const MEMBER_SESSION_KEY = 'bhsa_member_session';

// Remove any legacy localStorage PIN so old devices don't diverge
localStorage.removeItem('bhsa_pin');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn]   = useState(() => sessionStorage.getItem(LOGIN_STORAGE) === 'true');
  const [pinLocked, setPinLocked] = useState(true); // always starts locked each session
  const [pinReady, setPinReady]   = useState(false);
  const [pin, setPin]             = useState(DEFAULT_PIN); // in-memory cache

  // ── Member session ───────────────────────────────────────────────────────
  const [memberSession, setMemberSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem(MEMBER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // ── Fetch PIN from Supabase on mount ────────────────────────────────────
  useEffect(() => {
    async function fetchPin() {
      const { data, error } = await supabase
        .from('settings')
        .select('pin')
        .eq('id', 'global')
        .single();

      if (!error && data?.pin) {
        setPin(data.pin);
      }
      // If fetch fails, fall back to DEFAULT_PIN already set in state
      setPinReady(true);
    }
    fetchPin();
  }, []);

  // ── Email login ─────────────────────────────────────────────────────────
  const login = useCallback((email, password) => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(LOGIN_STORAGE, 'true');
      setLoggedIn(true);
      setPinLocked(true); // still needs PIN after login
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(LOGIN_STORAGE);
    setLoggedIn(false);
    setPinLocked(true);
  }, []);

  // ── PIN lock ─────────────────────────────────────────────────────────────
  const unlockWithPin = useCallback((enteredPin) => {
    if (enteredPin === pin) {
      setPinLocked(false);
      return true;
    }
    return false;
  }, [pin]);

  const lockScreen = useCallback(() => {
    setPinLocked(true);
  }, []);

  // async — updates Supabase then refreshes in-memory cache
  const changePin = useCallback(async (currentPin, newPin) => {
    if (currentPin !== pin) return false;

    const { error } = await supabase
      .from('settings')
      .update({ pin: newPin })
      .eq('id', 'global');

    if (error) throw new Error(error.message);

    setPin(newPin); // keep in-memory cache in sync
    return true;
  }, [pin]);

  const getCurrentPin = useCallback(() => pin, [pin]);

  // ── Member portal login ──────────────────────────────────────────────────
  // Returns null on success, or an error string on failure.
  const memberLogin = useCallback(async (memberId, enteredPin) => {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, pin')
      .eq('id', memberId)
      .single();

    if (error || !data) return 'Member not found.';
    if (!data.pin)      return 'No PIN set for this member. Please contact the admin.';
    if (data.pin !== enteredPin) return 'Incorrect PIN. Please try again.';

    const session = { memberId: data.id, memberName: data.name };
    sessionStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
    setMemberSession(session);
    return null; // success
  }, []);

  const memberLogout = useCallback(() => {
    sessionStorage.removeItem(MEMBER_SESSION_KEY);
    setMemberSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      loggedIn,
      pinLocked,
      pinReady,
      login,
      logout,
      unlockWithPin,
      lockScreen,
      changePin,
      getCurrentPin,
      memberSession,
      memberLogin,
      memberLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
