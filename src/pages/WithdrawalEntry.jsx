import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getMemberDepositBalance } from '../utils/calculations';
import { formatCurrency, todayISO } from '../utils/formatters';
import SearchableSelect from '../components/ui/SearchableSelect';

export default function WithdrawalEntry() {
  const { state, actions } = useStore();
  const [form, setForm] = useState({ member_id: '', amount: '', date: todayISO(), note: '' });
  const [success, setSuccess] = useState(null);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const memberOptions = state.members
    .filter(m => m.status === 'active')
    .map(m => ({ value: m.id, label: m.name, sub: m.phone }));

  // Member's personal deposit balance = their total deposits − their past withdrawals
  const memberBalance = useMemo(() => {
    if (!form.member_id) return null;
    return getMemberDepositBalance(form.member_id, state.deposits, state.withdrawals);
  }, [form.member_id, state.deposits, state.withdrawals]);

  const enteredAmount  = Number(form.amount || 0);
  const balanceAfter   = memberBalance !== null ? memberBalance - enteredAmount : null;
  const exceedsBalance = memberBalance !== null && enteredAmount > memberBalance;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.member_id) { setError('Please select a member'); return; }
    if (!form.amount || enteredAmount <= 0) { setError('Enter a valid amount'); return; }
    if (exceedsBalance) {
      setError(`Insufficient balance. ${form.member_id ? `This member has only ${formatCurrency(memberBalance)} available.` : ''}`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await actions.addWithdrawal({
        member_id: form.member_id,
        amount:    enteredAmount,
        date:      form.date,
        note:      form.note,
      });
      const member = state.members.find(m => m.id === form.member_id);
      setSuccess({
        memberName:    member?.name,
        amount:        enteredAmount,
        balanceBefore: memberBalance,
        balanceAfter:  memberBalance - enteredAmount,
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
        <h1 className="text-2xl font-bold text-slate-900">Record Withdrawal</h1>
        <p className="text-sm text-slate-500 mt-0.5">Withdraw from a member's personal deposit balance</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-slide-up">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-900">Withdrawal recorded successfully!</p>
            <p className="text-sm mt-0.5 text-amber-800">
              {success.memberName} — {formatCurrency(success.amount)} withdrawn.
            </p>
            <p className="text-sm text-amber-800">
              Remaining deposit balance:{' '}
              <span className="font-semibold">{formatCurrency(success.balanceAfter)}</span>
            </p>
            <button className="text-sm underline mt-1 hover:opacity-80 text-amber-700" onClick={handleReset}>
              Record another withdrawal
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {!success && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">

          {/* Member selector */}
          <div>
            <label className="form-label" htmlFor="withdrawal-member">Member *</label>
            <SearchableSelect
              id="withdrawal-member"
              options={memberOptions}
              value={form.member_id}
              onChange={v => { setForm(f => ({ ...f, member_id: v, amount: '' })); setError(''); }}
              placeholder="Select member…"
            />
          </div>

          {/* Member balance card — shown once a member is selected */}
          {form.member_id && memberBalance !== null && (
            <div className={`flex items-center justify-between rounded-xl p-4 border ${
              memberBalance === 0
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${memberBalance === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                  Available Deposit Balance
                </p>
                <p className={`text-2xl font-bold ${memberBalance === 0 ? 'text-red-700' : 'text-amber-700'}`}>
                  {formatCurrency(memberBalance)}
                </p>
                {memberBalance === 0 && (
                  <p className="text-xs text-red-600 mt-0.5">No balance available for withdrawal</p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${memberBalance === 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                <svg className={`w-5 h-5 ${memberBalance === 0 ? 'text-red-500' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="withdrawal-amount">
                Amount (₹) *
                {memberBalance !== null && (
                  <span className="ml-1 font-normal text-slate-400">max {formatCurrency(memberBalance)}</span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  id="withdrawal-amount"
                  type="number" min="1" step="1"
                  max={memberBalance ?? undefined}
                  className={`form-input pl-7 ${exceedsBalance ? 'border-red-400 focus:ring-red-300' : ''}`}
                  placeholder="0"
                  value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); setError(''); }}
                  disabled={memberBalance === 0}
                />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="withdrawal-date">Date *</label>
              <input
                id="withdrawal-date" type="date" className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="withdrawal-note">Note (optional)</label>
            <input
              id="withdrawal-note" type="text" className="form-input"
              placeholder="e.g. Emergency withdrawal"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>

          {/* Balance preview */}
          {enteredAmount > 0 && memberBalance !== null && (
            <div className={`rounded-lg p-3 text-sm ${
              exceedsBalance
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-amber-50 border border-amber-100 text-amber-800'
            }`}>
              {exceedsBalance ? (
                <span className="font-semibold">
                  ⚠ Amount exceeds available balance of {formatCurrency(memberBalance)}.
                </span>
              ) : (
                <>
                  Balance after withdrawal:{' '}
                  <span className="font-bold">{formatCurrency(balanceAfter)}</span>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              id="withdrawal-submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving || memberBalance === 0 || exceedsBalance}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Record Withdrawal
                </>
              )}
            </button>
            <button
              type="button" className="btn-secondary"
              onClick={() => { setForm({ member_id: '', amount: '', date: todayISO(), note: '' }); setError(''); }}
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
