import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getMemberActiveLoans } from '../utils/calculations';
import { formatCurrency, formatDate, todayISO } from '../utils/formatters';
import SearchableSelect from '../components/ui/SearchableSelect';
import Badge from '../components/ui/Badge';

export default function RepaymentEntry() {
  const { state, actions } = useStore();
  const [memberId, setMemberId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [form, setForm] = useState({ amount: '', date: todayISO(), note: '' });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const memberOptions = state.members.map(m => ({
    value: m.id,
    label: m.name,
    sub: m.status === 'inactive' ? 'Inactive' : m.phone,
  }));

  const activeLoans  = memberId
    ? getMemberActiveLoans(memberId, state.loans, state.repayments)
    : [];

  const allMemberLoans = memberId
    ? state.loans.filter(l => l.member_id === memberId)
    : [];
  const allLoansCleared = allMemberLoans.length > 0 && activeLoans.length === 0;

  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);
  const amount = Number(form.amount) || 0;
  const willClear = selectedLoan && amount >= selectedLoan.remaining;

  function handleMemberChange(id) {
    setMemberId(id);
    setSelectedLoanId('');
    setForm({ amount: '', date: todayISO(), note: '' });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!memberId) { setError('Please select a member'); return; }
    if (!selectedLoanId) { setError('Please select a loan'); return; }
    if (!form.amount || amount <= 0) { setError('Enter a valid amount'); return; }
    if (amount > selectedLoan.remaining) {
      setError(`Amount cannot exceed remaining balance of ${formatCurrency(selectedLoan.remaining)}`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await actions.addRepayment({
        loan_id: selectedLoanId,
        member_id: memberId,
        amount,
        date: form.date,
        note: form.note,
      });

      const member = state.members.find(m => m.id === memberId);
      setSuccess({
        memberName: member?.name,
        amount,
        loanId: selectedLoanId,
        cleared: willClear,
        remaining: selectedLoan.remaining - amount,
      });
      setMemberId('');
      setSelectedLoanId('');
      setForm({ amount: '', date: todayISO(), note: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Repayment</h1>
        <p className="text-sm text-slate-500 mt-0.5">Log a loan repayment (partial or full)</p>
      </div>

      {/* Success */}
      {success && (
        <div className="alert-success animate-slide-up">
          <svg className="w-5 h-5 text-credit-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">{success.cleared ? '🎉 Loan fully cleared!' : 'Repayment recorded!'}</p>
            <p className="text-sm mt-0.5">
              {success.memberName} — {formatCurrency(success.amount)} received for{' '}
              <span className="font-mono font-bold">{success.loanId}</span>
            </p>
            {!success.cleared && (
              <p className="text-sm">Remaining: <span className="font-semibold">{formatCurrency(success.remaining)}</span></p>
            )}
            {success.cleared && (
              <p className="text-sm text-credit-700 font-medium">This loan is now fully repaid.</p>
            )}
            <button className="text-sm underline mt-1 hover:opacity-80" onClick={() => setSuccess(null)}>
              Record another repayment
            </button>
          </div>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1 */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold">1</span>
              Select Member
            </h2>
            <SearchableSelect
              id="repay-member"
              options={memberOptions}
              value={memberId}
              onChange={handleMemberChange}
              placeholder="Search member…"
            />
          </div>

          {/* Step 2 */}
          {memberId && (
            <div className="card p-5 animate-slide-up">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold">2</span>
                Select Loan
              </h2>

              {activeLoans.length === 0 ? (
                <div className="text-center py-6">
                  {allLoansCleared ? (
                    <>
                      <div className="w-10 h-10 bg-credit-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-credit-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-credit-700">All loans are fully repaid</p>
                      <p className="text-xs text-slate-400 mt-0.5">This member has no outstanding balance.</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No active loans for this member</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLoans.map(loan => {
                    const pct = Math.min(100, (loan.repaid / loan.amount) * 100);
                    const isSelected = selectedLoanId === loan.id;
                    return (
                      <button
                        key={loan.id} type="button"
                        onClick={() => { setSelectedLoanId(loan.id); setForm(f => ({ ...f, amount: '' })); }}
                        className={`w-full text-left border-2 rounded-xl p-4 transition-all ${
                          isSelected ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{loan.id}</p>
                            <p className="text-xs text-slate-400">{formatDate(loan.date)} · {loan.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={loan.status} />
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="progress-bar mb-2">
                          <div className="progress-fill bg-repay-400" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Repaid: {formatCurrency(loan.repaid)}</span>
                          <span className="font-semibold text-loan-600">Remaining: {formatCurrency(loan.remaining)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
          {selectedLoan && (
            <div className="card p-5 animate-slide-up">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold">3</span>
                Repayment Details
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="repay-amount">
                      Amount (₹) *
                      <span className="text-slate-400 font-normal ml-1">max {formatCurrency(selectedLoan.remaining)}</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                      <input
                        id="repay-amount" type="number" min="1" max={selectedLoan.remaining} step="1"
                        className="form-input pl-7" placeholder="0"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <button
                      type="button"
                      className="text-xs text-repay-600 hover:text-repay-800 mt-1 font-medium"
                      onClick={() => setForm(f => ({ ...f, amount: String(selectedLoan.remaining) }))}
                    >
                      Pay full remaining ({formatCurrency(selectedLoan.remaining)})
                    </button>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="repay-date">Date *</label>
                    <input
                      id="repay-date" type="date" className="form-input"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="repay-note">Note (optional)</label>
                  <input
                    id="repay-note" type="text" className="form-input"
                    placeholder="e.g. Second instalment"
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>

                {willClear && (
                  <div className="alert-success text-sm">
                    <svg className="w-4 h-4 text-credit-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This payment will fully clear the loan!
                  </div>
                )}

                {error && <p className="text-sm text-loan-600">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" className="btn-repay disabled:opacity-50" disabled={saving}>
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
                        Record Repayment
                      </>
                    )}
                  </button>
                  <button
                    type="button" className="btn-secondary"
                    disabled={saving}
                    onClick={() => { setMemberId(''); setSelectedLoanId(''); setForm({ amount: '', date: todayISO(), note: '' }); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
