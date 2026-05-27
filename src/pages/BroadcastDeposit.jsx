import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { formatCurrency, todayISO } from '../utils/formatters';
import { getBatchColors } from '../utils/batchConfig';

const STEPS = ['Amount & Date', 'Select Members', 'Review & Confirm'];

export default function BroadcastDeposit() {
  const { state, actions } = useStore();

  const [step, setStep]         = useState(0);
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(todayISO());
  const [note, setNote]         = useState('');
  const [selected, setSelected] = useState(null); // null = not yet initialised
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const activeMembers = useMemo(
    () => state.members.filter(m => m.status === 'active'),
    [state.members]
  );

  // Initialise selection with all members checked when entering step 2
  function goToStep2() {
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setError('');
    const ids = new Set(activeMembers.map(m => m.id));
    setSelected(ids);
    setStep(1);
  }

  function toggleMember(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === activeMembers.length) setSelected(new Set());
    else setSelected(new Set(activeMembers.map(m => m.id)));
  }

  function toggleBatch(batchNum) {
    const batchMembers = activeMembers.filter(m => m.batch === batchNum);
    const allSelected  = batchMembers.every(m => selected?.has(m.id));
    setSelected(prev => {
      const next = new Set(prev);
      batchMembers.forEach(m => {
        if (allSelected) next.delete(m.id);
        else next.add(m.id);
      });
      return next;
    });
  }

  // Group active members by batch, sorted batch ascending
  const membersByBatch = useMemo(() => {
    const groups = {};
    activeMembers.forEach(m => {
      const b = m.batch ?? 0;
      if (!groups[b]) groups[b] = [];
      groups[b].push(m);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([batch, members]) => ({ batch: Number(batch), members }));
  }, [activeMembers]);

  const selectedMembers = useMemo(
    () => activeMembers.filter(m => selected?.has(m.id)),
    [activeMembers, selected]
  );

  const totalAmount = selectedMembers.length * Number(amount || 0);

  async function handleConfirm() {
    if (selectedMembers.length === 0) { setError('Select at least one member.'); return; }
    setSaving(true);
    setError('');
    try {
      await actions.broadcastDeposit({
        member_ids: selectedMembers.map(m => m.id),
        amount: Number(amount),
        date,
        note,
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStep(0); setAmount(''); setDate(todayISO()); setNote('');
    setSelected(null); setDone(false); setError('');
  }

  // ── Done screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="space-y-6 animate-fade-in max-w-xl">
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-credit-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-credit-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">FinWave Sent!</h2>
            <p className="text-sm text-slate-500 mt-1">
              {formatCurrency(Number(amount))} deposited to <strong>{selectedMembers.length}</strong> members.
              Total: <strong className="text-credit-700">{formatCurrency(totalAmount)}</strong>
            </p>
          </div>
          <button onClick={handleReset} className="btn-credit mx-auto">
            New FinWave Deposit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-credit-500 to-emerald-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">FinWave Deposit</h1>
        </div>
        <p className="text-sm text-slate-500">Broadcast a deposit amount to all or selected members at once</p>
      </div>

      {/* Step bar */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
              i < step ? 'bg-credit-600 text-white'
              : i === step ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium flex-1 ${i === step ? 'text-slate-800' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Amount & Date ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-800">Step 1 — Set Amount & Date</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount per Member (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  id="fw-amount"
                  type="number" min="1" step="1"
                  className="form-input pl-7"
                  placeholder="0"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input
                id="fw-date"
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Note (optional)</label>
            <input
              id="fw-note"
              type="text"
              className="form-input"
              placeholder="e.g. Monthly savings deposit"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          {amount && Number(amount) > 0 && (
            <div className="bg-credit-50 border border-credit-100 rounded-lg p-3 text-sm text-credit-700">
              If all <strong>{activeMembers.length}</strong> members are selected, total will be:{' '}
              <strong>{formatCurrency(activeMembers.length * Number(amount))}</strong>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button id="fw-next-1" onClick={goToStep2} className="btn-credit">
            Next — Select Members →
          </button>
        </div>
      )}

      {/* ── Step 2: Select Members ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card space-y-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Step 2 — Select Members</h2>
            <button onClick={toggleAll} className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
              {selected?.size === activeMembers.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {membersByBatch.map(({ batch, members: batchMembers }) => {
              const colors       = getBatchColors(batch);
              const selCount     = batchMembers.filter(m => selected?.has(m.id)).length;
              const batchAllSel  = selCount === batchMembers.length;
              return (
                <div key={batch}>
                  {/* Batch group header */}
                  <div className={`px-5 py-2 flex items-center justify-between border-b ${colors.header}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${colors.chip}`}>
                        Batch {batch}
                      </span>
                      <span className="text-xs text-slate-400">
                        {selCount}/{batchMembers.length} selected
                      </span>
                    </div>
                    <button
                      onClick={() => toggleBatch(batch)}
                      className={`text-xs font-semibold transition-colors ${colors.toggle}`}
                    >
                      {batchAllSel ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  {/* Members in this batch */}
                  {batchMembers.map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-credit-600 rounded"
                        checked={selected?.has(m.id) ?? false}
                        onChange={() => toggleMember(m.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.phone || m.id}</p>
                      </div>
                      {selected?.has(m.id) && (
                        <span className="text-xs font-semibold text-credit-600">
                          {formatCurrency(Number(amount))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{selected?.size ?? 0}</strong> members selected
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="btn-secondary text-sm">← Back</button>
              <button
                id="fw-next-2"
                onClick={() => {
                  if (!selected || selected.size === 0) { setError('Select at least one member.'); return; }
                  setError('');
                  setStep(2);
                }}
                className="btn-credit text-sm"
              >
                Review →
              </button>
            </div>
          </div>
          {error && <p className="px-5 pb-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* ── Step 3: Review ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card space-y-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Step 3 — Review & Confirm</h2>
          </div>

          {/* Summary */}
          <div className="px-5 py-4 bg-credit-50 border-b border-credit-100 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-credit-600 font-semibold uppercase tracking-wide">Amount Each</p>
              <p className="text-xl font-bold text-credit-700">{formatCurrency(Number(amount))}</p>
            </div>
            <div>
              <p className="text-xs text-credit-600 font-semibold uppercase tracking-wide">Members</p>
              <p className="text-xl font-bold text-credit-700">{selectedMembers.length}</p>
            </div>
            <div>
              <p className="text-xs text-credit-600 font-semibold uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-credit-700">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Member list */}
          <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
            {selectedMembers.map(m => (
              <div key={m.id} className="px-5 py-2.5 flex items-center justify-between">
                <p className="text-sm text-slate-700">{m.name}</p>
                <p className="text-sm font-semibold text-credit-600">{formatCurrency(Number(amount))}</p>
              </div>
            ))}
          </div>

          {note && (
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
              Note: <span className="font-medium text-slate-700">{note}</span>
            </div>
          )}

          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 ml-auto">
              <button onClick={() => setStep(1)} className="btn-secondary" disabled={saving}>← Back</button>
              <button
                id="fw-confirm"
                onClick={handleConfirm}
                className="btn-credit"
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Depositing…
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm FinWave Deposit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
