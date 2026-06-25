import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// ── Member Login Tab ───────────────────────────────────────────────────────

function MemberLoginTab() {
  const { memberLogin } = useAuth();

  const [members, setMembers]     = useState([]);
  const [memberId, setMemberId]   = useState('');
  const [pin, setPin]             = useState(['', '', '', '']);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(true);
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    supabase
      .from('members')
      .select('id, name')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setMembers(data || []);
        setFetching(false);
      });
  }, []);

  function handlePinChange(idx, val) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    setError('');
    // Auto-advance
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus();
    // Auto-backspace
    if (!digit && idx > 0) pinRefs[idx - 1].current?.focus();
  }

  function handlePinKeyDown(idx, e) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const enteredPin = pin.join('');
    if (!memberId)           { setError('Please select your name.'); return; }
    if (enteredPin.length < 4) { setError('Enter your 4-digit PIN.'); return; }

    setLoading(true);
    setError('');
    const err = await memberLogin(memberId, enteredPin);
    if (err) {
      setError(err);
      setPin(['', '', '', '']);
      pinRefs[0].current?.focus();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Member selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Your Name
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <select
            id="member-select"
            value={memberId}
            onChange={e => { setMemberId(e.target.value); setError(''); }}
            disabled={fetching}
            className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/15 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all
              disabled:opacity-50 appearance-none"
            style={{ color: memberId ? '#ffffff' : '#64748b', caretColor: '#ffffff' }}
          >
            <option value="" style={{ color: '#1e293b' }}>
              {fetching ? 'Loading members…' : 'Select your name…'}
            </option>
            {members.map(m => (
              <option key={m.id} value={m.id} style={{ color: '#1e293b' }}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* 4-digit PIN boxes */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          4-Digit PIN
        </label>
        <div className="flex justify-center gap-3">
          {pin.map((digit, idx) => (
            <input
              key={idx}
              ref={pinRefs[idx]}
              id={`pin-digit-${idx}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handlePinChange(idx, e.target.value)}
              onKeyDown={e => handlePinKeyDown(idx, e)}
              className="w-14 h-14 text-center text-2xl font-bold bg-white/10 border border-white/20 rounded-xl
                text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent
                transition-all tracking-widest"
              style={{ caretColor: 'transparent' }}
            />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/15 border border-red-500/30 rounded-lg">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        id="member-login-submit"
        disabled={loading || fetching}
        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400
          text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2
          disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-emerald-700/30"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Access My Account
          </>
        )}
      </button>
    </form>
  );
}

// ── Admin Login Tab ────────────────────────────────────────────────────────

function AdminLoginTab() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const ok = login(email, password);
    if (!ok) setError('Invalid email or password. Please try again.');
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
            style={{ color: '#ffffff', caretColor: '#ffffff' }}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Password
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            id="login-password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-9 pr-10 py-3 bg-white/10 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all"
            style={{ color: '#ffffff', caretColor: '#ffffff' }}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            tabIndex={-1}
          >
            {showPass ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/15 border border-red-500/30 rounded-lg">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        id="login-submit"
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400
          text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2
          disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-slate-700/50"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [tab, setTab] = useState('member'); // 'admin' | 'member'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-2xl mb-4 p-2">
            <img src="/logo.png" alt="BHSA Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">BHSA Finance</h1>
          <p className="text-sm text-slate-400 mt-1">
            {tab === 'admin' ? 'Admin Portal — Sign in to continue' : 'Member Portal — View your account'}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setTab('member')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
              tab === 'member'
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <svg className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Member Login
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
              tab === 'admin'
                ? 'bg-slate-600 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <svg className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Admin Login
          </button>
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          {tab === 'member' ? <MemberLoginTab /> : <AdminLoginTab />}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">BHSA Finance System · Secure Access</p>
      </div>
    </div>
  );
}
