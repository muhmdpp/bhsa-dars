import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isMissingFunction } from '../lib/supabase';

// Admin sign-in uses Supabase Auth, so no password is shipped inside the app.
// PIN checks happen in the database (20261109_security_and_audit.sql). Until that
// migration has been run, the PIN checks fall back to the old client-side way.

const MEMBER_SESSION_KEY = 'bhsa_member_session';

// Remove legacy keys from older versions
localStorage.removeItem('bhsa_pin');
sessionStorage.removeItem('bhsa_logged_in');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(null);
  const [pinLocked, setPinLocked] = useState(true); // always starts locked each session
  const [pinReady, setPinReady]   = useState(false); // auth state restored

  // ── Member session ───────────────────────────────────────────────────────
  const [memberSession, setMemberSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem(MEMBER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // ── Restore + follow the Supabase admin session ─────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setPinReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (!s) setPinLocked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Admin sign-in ───────────────────────────────────────────────────────
  // Returns null on success, or an error message.
  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : error.message;
    }
    setPinLocked(true); // still needs PIN after login
    return null;
  }, []);

  const logout = useCallback(async () => {
    setPinLocked(true);
    await supabase.auth.signOut();
  }, []);

  // ── Admin PIN lock ───────────────────────────────────────────────────────
  // Returns null on success, or an error message.
  const unlockWithPin = useCallback(async (enteredPin) => {
    const { data, error } = await supabase.rpc('dhsa_verify_admin_pin', { p_pin: enteredPin });
    if (error && isMissingFunction(error)) {
      // Fallback before the security migration is installed
      const { data: s, error: sErr } = await supabase
        .from('settings').select('pin').eq('id', 'global').single();
      if (sErr) return sErr.message;
      if (s?.pin !== enteredPin) return 'Incorrect PIN';
      setPinLocked(false);
      return null;
    }
    if (error) return error.message;
    if (data?.error) return data.error;
    setPinLocked(false);
    return null;
  }, []);

  const lockScreen = useCallback(() => {
    setPinLocked(true);
  }, []);

  // Returns true on success, false if the current PIN is wrong; throws otherwise
  const changePin = useCallback(async (currentPin, newPin) => {
    const { data, error } = await supabase.rpc('dhsa_change_admin_pin', {
      p_current: currentPin, p_new: newPin,
    });
    if (error && isMissingFunction(error)) {
      const { data: s, error: sErr } = await supabase
        .from('settings').select('pin').eq('id', 'global').single();
      if (sErr) throw new Error(sErr.message);
      if (s?.pin !== currentPin) return false;
      const { error: uErr } = await supabase.from('settings').update({ pin: newPin }).eq('id', 'global');
      if (uErr) throw new Error(uErr.message);
      return true;
    }
    if (error) throw new Error(error.message);
    if (data?.error === 'Incorrect PIN') return false;
    if (data?.error) throw new Error(data.error);
    return true;
  }, []);

  // ── Member portal login ──────────────────────────────────────────────────
  // Returns null on success, or an error string on failure.
  const memberLogin = useCallback(async (memberId, enteredPin) => {
    let next;
    const { data, error } = await supabase.rpc('dhsa_member_login', {
      p_member_id: memberId, p_pin: enteredPin,
    });

    if (error && isMissingFunction(error)) {
      // Fallback before the security migration is installed
      const { data: m, error: mErr } = await supabase
        .from('members').select('id, name, pin').eq('id', memberId).single();
      if (mErr || !m) return 'Member not found.';
      if (!m.pin)     return 'No PIN set for this member. Please contact the admin.';
      if (m.pin !== enteredPin) return 'Incorrect PIN. Please try again.';
      next = { memberId: m.id, memberName: m.name, token: null };
    } else {
      if (error)       return error.message;
      if (data?.error) return data.error;
      next = { memberId: data.member_id, memberName: data.name, token: data.token };
    }

    sessionStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(next));
    setMemberSession(next);
    return null;
  }, []);

  const memberLogout = useCallback(() => {
    const token = memberSession?.token;
    if (token) supabase.rpc('dhsa_member_logout', { p_token: token }).then(() => {});
    sessionStorage.removeItem(MEMBER_SESSION_KEY);
    setMemberSession(null);
  }, [memberSession]);

  return (
    <AuthContext.Provider value={{
      loggedIn: !!session,
      adminEmail: session?.user?.email ?? null,
      pinLocked,
      pinReady,
      login,
      logout,
      unlockWithPin,
      lockScreen,
      changePin,
      memberSession,
      memberLogin,
      memberLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
