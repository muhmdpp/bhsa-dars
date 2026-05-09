import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ADMIN_EMAIL    = import.meta.env.VITE_ADMIN_EMAIL    || '';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

const DEFAULT_PIN   = '2608';
const PIN_STORAGE   = 'bhsa_pin';
const LOGIN_STORAGE = 'bhsa_logged_in';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn]   = useState(() => sessionStorage.getItem(LOGIN_STORAGE) === 'true');
  const [pinLocked, setPinLocked] = useState(true); // always starts locked each session
  const [pinReady, setPinReady]   = useState(false);

  // Ensure default PIN is set
  useEffect(() => {
    if (!localStorage.getItem(PIN_STORAGE)) {
      localStorage.setItem(PIN_STORAGE, DEFAULT_PIN);
    }
    setPinReady(true);
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
    const storedPin = localStorage.getItem(PIN_STORAGE) || DEFAULT_PIN;
    if (enteredPin === storedPin) {
      setPinLocked(false);
      return true;
    }
    return false;
  }, []);

  const lockScreen = useCallback(() => {
    setPinLocked(true);
  }, []);

  const changePin = useCallback((currentPin, newPin) => {
    const storedPin = localStorage.getItem(PIN_STORAGE) || DEFAULT_PIN;
    if (currentPin !== storedPin) return false;
    localStorage.setItem(PIN_STORAGE, newPin);
    return true;
  }, []);

  const getCurrentPin = useCallback(() => {
    return localStorage.getItem(PIN_STORAGE) || DEFAULT_PIN;
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
