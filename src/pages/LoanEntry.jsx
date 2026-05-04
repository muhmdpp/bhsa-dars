import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getPoolBalance } from '../utils/calculations';
import { formatCurrency, todayISO } from '../utils/formatters';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function LoanEntry() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({ member_id: '', amount: '', date: todayISO(), reason: '' });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const poolBalance = getPoolBalance(state);
  const amount = Number(form.amount) || 0;
  const exceedsBalance = amount > poolBalance;

  const memberOptions = state.members
    .filter(m => m.status === 'active')
    .map(m => ({ value: m.id, label: m.name, sub: m.phone }));

  // Preview next loan ID from current state
  const nextLoanNum = state.loans.length + 1;
  const nextLoanId = `LOAN-${String(nextLoanNum).padStart(4, '0')}`;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.member_id) { setError('Please select a member'); return; }
    if (!form.amount || amount <= 0) { setError('Enter a valid amount'); return; }
    if (!form.reason.trim()) { setError('Reason is required'); return; }

    setSaving(true);
    setError('');
    try {
      const loanId = await actions.addLoan({
        member_id: form.member_id,
        amount,
        date: form.date,
        reason: form.reason,
      });
      const member = state.members.find(m => m.id === form.member_id);
      setSuccess({
        memberName: member?.name,
        amount,
        loanId,
        newBalance: poolBalance - amount,
      });
      setForm({ member_id: '', amount: '', date: todayISO(), reason: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSuccess(null);
    setForm({ member_id: '', amount: '', date: todayISO(), reason: '' });
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Issue Loan</h1>
        <p className="text-sm text-slate-500 mt-0.5">Record a new loan from the pool</p>
      </div>

      {/* Pool balance banner */}
      <div className={`card p-4 flex items-center justify-between border ${
        exceedsBalance && amount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Available Pool Balance</p>
          <p className={`text-2xl font-bold ${exceedsBalance && amount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
            {formatCurrency(poolBalance)}
          </p>
          {exceedsBalance && amount > 0 && (
            <p className="text-xs text-amber-700 mt-0.5 font-medium">
              ⚠ Exceeds balance by {formatCurrency(amount - poolBalance)}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          exceedsBalance && amount > 0 ? 'bg-amber-100' : 'bg-slate-100'
        }`}>
          <svg className={`w-5 h-5 ${exceedsBalance && amount > 0 ? 'text-amber-600' : 'text-slate-600'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {/* Warning */}
      {exceedsBalance && amount > 0 && (
        <div className="alert-warning animate-slide-up">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold">Insufficient pool balance</p>
            <p className="text-sm mt-0.5">
              Loan of {formatCurrency(amount)} exceeds pool balance of {formatCurrency(poolBalance)}.
              You can still proceed — pool will go negative.
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="alert-success animate-slide-up">
          <svg className="w-5 h-5 text-credit-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Loan issued successfully!</p>
            <p className="text-sm mt-0.5">
              Loan ID: <span className="font-mono font-bold">{success.loanId}</span>
            </p>
            <p className="text-sm">{success.memberName} — {formatCurrency(success.amount)} issued.</p>
            <p className="text-sm">New pool balance: <span className="font-semibold">{formatCurrency(success.newBalance)}</span></p>
            <button className="text-sm underline mt-1 hover:opacity-80" onClick={handleReset}>
              Issue another loan
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {!success && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {/* Loan ID preview */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            <span className="text-xs text-slate-500">Loan ID will be assigned:</span>
            <span className="text-sm font-mono font-bold text-slate-800">{nextLoanId}</span>
          </div>

          <div>
            <label className="form-label" htmlFor="loan-member">Member *</label>
            <SearchableSelect
              id="loan-member"
              options={memberOptions}
              value={form.member_id}
              onChange={v => setForm(f => ({ ...f, member_id: v }))}
              placeholder="Select member…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="loan-amount">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  id="loan-amount" type="number" min="1" step="1"
                  className={`form-input pl-7 ${exceedsBalance && amount > 0 ? 'border-amber-400 ring-1 ring-amber-400' : ''}`}
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="loan-date">Date *</label>
              <input
                id="loan-date" type="date" className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="loan-reason">Reason *</label>
            <input
              id="loan-reason" type="text" className="form-input"
              placeholder="e.g. Medical expenses"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>

          {amount > 0 && (
            <div className={`border rounded-lg p-3 text-sm ${
              exceedsBalance
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              Pool balance after loan:{' '}
              <span className="font-bold">{formatCurrency(poolBalance - amount)}</span>
            </div>
          )}

          {error && <p className="text-sm text-loan-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={exceedsBalance
                ? 'btn bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 disabled:opacity-50'
                : 'btn-loan disabled:opacity-50'}
            >
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
                  {exceedsBalance ? 'Issue Anyway' : 'Issue Loan'}
                </>
              )}
            </button>
            <button
              type="button" className="btn-secondary"
              onClick={() => setForm({ member_id: '', amount: '', date: todayISO(), reason: '' })}
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
