import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function PinLockScreen() {
  const { unlockWithPin, lockScreen, logout } = useAuth();
  const [pin, setPin]       = useState('');
  const [shake, setShake]   = useState(false);
  const [error, setError]   = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleDigit = useCallback((digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');

    if (next.length === 4) {
      setTimeout(() => {
        const ok = unlockWithPin(next);
        if (!ok) {
          setShake(true);
          setError('Incorrect PIN');
          setAttempts(a => a + 1);
          setTimeout(() => {
            setPin('');
            setShake(false);
          }, 600);
        }
      }, 100);
    }
  }, [pin, unlockWithPin]);

  const handleBackspace = useCallback(() => {
    setPin(p => p.slice(0, -1));
    setError('');
  }, []);

  // Keyboard support
  useEffect(() => {
    function handleKey(e) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleBackspace();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDigit, handleBackspace]);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className="relative flex flex-col items-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 border border-slate-600 shadow-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-white mb-1">Screen Locked</h1>
        <p className="text-sm text-slate-400 mb-8">Enter your 4-digit PIN to continue</p>

        {/* PIN dots */}
        <div className={`flex gap-4 mb-4 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
          style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}>
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-white border-white scale-110'
                  : 'bg-transparent border-slate-500'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        <div className="h-5 mb-4">
          {error && <p className="text-sm text-red-400 text-center">{error}{attempts >= 3 ? ' · Too many attempts?' : ''}</p>}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-72">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />;
            if (d === '⌫') {
              return (
                <button
                  key={i}
                  id={`pin-backspace`}
                  onClick={handleBackspace}
                  className="h-16 rounded-2xl bg-white/5 border border-white/10 text-white text-xl font-semibold
                    flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all duration-100"
                >
                  ⌫
                </button>
              );
            }
            return (
              <button
                key={i}
                id={`pin-digit-${d}`}
                onClick={() => handleDigit(d)}
                className="h-16 rounded-2xl bg-white/8 border border-white/10 text-white text-2xl font-semibold
                  flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all duration-100 select-none"
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Sign out link */}
        <button
          onClick={logout}
          className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
        >
          Sign out with a different account
        </button>
      </div>

      {/* shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
