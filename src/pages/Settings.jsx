import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { changePin, lockScreen, logout, getCurrentPin } = useAuth();

  // PIN change form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError]     = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinSaving, setPinSaving]   = useState(false);

  async function handlePinChange(e) {
    e.preventDefault();
    setPinError('');
    setPinSuccess(false);

    if (!/^\d{4}$/.test(newPin)) {
      setPinError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and confirmation do not match.');
      return;
    }

    setPinSaving(true);
    try {
      const ok = await changePin(currentPin, newPin);
      if (!ok) {
        setPinError('Current PIN is incorrect.');
        return;
      }
      setPinSuccess(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinError(err.message || 'Failed to update PIN. Try again.');
    } finally {
      setPinSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your security preferences</p>
      </div>

      {/* PIN Change */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Change Screen Lock PIN</p>
            <p className="text-xs text-slate-500">Update your 4-digit access PIN</p>
          </div>
        </div>

        {pinSuccess && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-emerald-700 font-medium">PIN updated successfully!</p>
          </div>
        )}

        <form onSubmit={handlePinChange} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="current-pin">Current PIN</label>
            <input
              id="current-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              className="form-input tracking-[0.5em] text-center font-bold text-lg"
              placeholder="••••"
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="new-pin">New PIN (4 digits)</label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              className="form-input tracking-[0.5em] text-center font-bold text-lg"
              placeholder="••••"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="confirm-pin">Confirm New PIN</label>
            <input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              className="form-input tracking-[0.5em] text-center font-bold text-lg"
              placeholder="••••"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          {pinError && <p className="text-sm text-red-600">{pinError}</p>}
          <button type="submit" id="save-pin-btn" className="btn-primary" disabled={pinSaving}>
            {pinSaving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Update PIN'}
          </button>
        </form>
      </div>

      {/* Session */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Session</p>
            <p className="text-xs text-slate-500">Lock screen or sign out</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            id="lock-screen-btn"
            onClick={lockScreen}
            className="btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Lock Screen
          </button>
          <button
            id="sign-out-btn"
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium
              hover:bg-red-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Footer Info */}
      <div className="md:hidden pt-8 pb-4">
        <p className="text-xs text-slate-400 text-center">BHSA Finance System v1.1.0</p>
        <a
          href="https://www.watermelonbranding.in"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[10px] text-slate-400 hover:text-slate-600 transition-colors mt-1"
        >
          Developed by <span className="font-semibold text-slate-500">Watermelon</span>
        </a>
      </div>
    </div>
  );
}
