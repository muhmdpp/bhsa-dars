import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getPoolBalance } from '../utils/calculations';
import { formatCurrency, formatDate, todayISO } from '../utils/formatters';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function DepositEntry() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({ member_id: '', amount: '', date: todayISO(), note: '' });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const poolBalance = getPoolBalance(state);

  const memberOptions = state.members
    .filter(m => m.status === 'active')
    .map(m => ({ value: m.id, label: m.name, sub: m.phone }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.member_id) { setError('Please select a member'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount'); return; }

    setSaving(true);
    setError('');
    try {
      await actions.addDeposit({
        member_id: form.member_id,
        amount: Number(form.amount),
        date: form.date,
        note: form.note,
      });
      const member = state.members.find(m => m.id === form.member_id);
      setSuccess({
        memberName: member?.name,
        amount: Number(form.amount),
        newBalance: poolBalance + Number(form.amount),
      });
      setForm({ member_id: '', amount: '', date: todayISO(), note: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSuccess(null);
    setForm({ member_id: '', amount: '', date: todayISO(), note: '' });
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Deposit</h1>
        <p className="text-sm text-slate-500 mt-0.5">Add a member's deposit to the pool</p>
      </div>

      {/* Pool balance banner */}
      <div className="card p-4 bg-credit-50 border border-credit-200 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-credit-600 uppercase tracking-wide">Current Pool Balance</p>
          <p className="text-2xl font-bold text-credit-700">{formatCurrency(poolBalance)}</p>
        </div>
        <div className="w-10 h-10 bg-credit-100 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-credit-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="alert-success animate-slide-up">
          <svg className="w-5 h-5 text-credit-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Deposit recorded successfully!</p>
            <p className="text-sm mt-0.5">
              {success.memberName} — {formatCurrency(success.amount)} deposited.
            </p>
            <p className="text-sm">
              New pool balance: <span className="font-semibold">{formatCurrency(success.newBalance)}</span>
            </p>
            <button className="text-sm underline mt-1 hover:opacity-80" onClick={handleReset}>
              Record another deposit
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {!success && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="form-label" htmlFor="deposit-member">Member *</label>
            <SearchableSelect
              id="deposit-member"
              options={memberOptions}
              value={form.member_id}
              onChange={v => setForm(f => ({ ...f, member_id: v }))}
              placeholder="Select member…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="deposit-amount">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  id="deposit-amount" type="number" min="1" step="1"
                  className="form-input pl-7" placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="deposit-date">Date *</label>
              <input
                id="deposit-date" type="date" className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="deposit-note">Note (optional)</label>
            <input
              id="deposit-note" type="text" className="form-input"
              placeholder="e.g. Monthly deposit"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          {form.amount && Number(form.amount) > 0 && (
            <div className="bg-credit-50 border border-credit-100 rounded-lg p-3 text-sm text-credit-700">
              Pool balance after deposit:{' '}
              <span className="font-bold">{formatCurrency(poolBalance + Number(form.amount))}</span>
            </div>
          )}

          {error && <p className="text-sm text-loan-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-credit" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Record Deposit
                </>
              )}
            </button>
            <button
              type="button" className="btn-secondary"
              onClick={() => setForm({ member_id: '', amount: '', date: todayISO(), note: '' })}
              disabled={saving}
            >
              Clear
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
