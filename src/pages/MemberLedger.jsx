import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getMemberSummary, getMemberLoansWithStatus } from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import Badge from '../components/ui/Badge';

function TimelineEntry({ item }) {
  const isDeposit    = item.type === 'deposit';
  const isLoan       = item.type === 'loan';
  const isRepayment  = item.type === 'repayment';
  const isWithdrawal = item.type === 'withdrawal';

  const dotColor    = isDeposit    ? 'bg-credit-500'
                    : isLoan       ? 'bg-loan-500'
                    : isWithdrawal ? 'bg-amber-500'
                    : 'bg-repay-500';

  const amountColor = isDeposit    ? 'text-credit-600'
                    : isLoan       ? 'text-loan-600'
                    : isWithdrawal ? 'text-amber-600'
                    : 'text-repay-600';

  const sign  = (isLoan || isWithdrawal) ? '−' : '+';
  const label = isDeposit    ? 'Deposit'
              : isLoan       ? `Loan — ${item.id}`
              : isWithdrawal ? 'Withdrawal'
              : `Repayment → ${item.loan_id}`;

  return (
    <div className="flex gap-4 group">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${dotColor} ring-2 ring-white`} />
        <div className="w-px flex-1 bg-slate-200 mt-1 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{label}</p>
            {item.note   && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.note}</p>}
            {!item.note && item.reason && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.reason}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-semibold ${amountColor}`}>
              {sign}{formatCurrency(item.amount)}
            </p>
            <p className="text-xs text-slate-400">{formatDate(item.date)}</p>
          </div>
        </div>
        {/* Running deposit balance */}
        <p className="text-xs text-slate-500 mt-1">
          Deposit balance: <span className="font-medium text-slate-700">{formatCurrency(item.runningBalance)}</span>
        </p>
      </div>
    </div>
  );
}

export default function MemberLedger() {
  const { id } = useParams();
  const { state } = useStore();
  const navigate = useNavigate();

  const member = state.members.find(m => m.id === id);
  if (!member) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Member not found.</p>
        <button className="btn-secondary mt-4" onClick={() => navigate('/members')}>← Back</button>
      </div>
    );
  }

  const summary = getMemberSummary(id, state);
  const loans   = getMemberLoansWithStatus(id, state.loans, state.repayments);

  // Build unified timeline — deposits, withdrawals, loans, repayments
  const memberDeposits    = state.deposits.filter(d => d.member_id === id);
  const memberLoans       = state.loans.filter(l => l.member_id === id);
  const memberRepayments  = state.repayments.filter(r => r.member_id === id);
  const memberWithdrawals = (state.withdrawals || []).filter(w => w.member_id === id);

  const timeline = [
    ...memberDeposits.map(d    => ({ ...d, type: 'deposit' })),
    ...memberLoans.map(l       => ({ ...l, type: 'loan' })),
    ...memberRepayments.map(r  => ({ ...r, type: 'repayment' })),
    ...memberWithdrawals.map(w => ({ ...w, type: 'withdrawal' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.type === 'deposit' ? -1 : 1));

  // Running deposit balance: deposits add, withdrawals subtract
  // (loans/repayments are tracked separately but shown in timeline)
  let runningDepositBalance = 0;
  const timelineWithBalance = timeline.map(item => {
    if      (item.type === 'deposit')    runningDepositBalance += item.amount;
    else if (item.type === 'withdrawal') runningDepositBalance -= item.amount;
    return { ...item, runningBalance: runningDepositBalance };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button + header */}
      <div>
        <button
          onClick={() => navigate('/members')}
          className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Members
        </button>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{member.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-sm text-slate-500">{member.phone}</p>
              <span className="text-slate-300">·</span>
              <p className="text-sm text-slate-500">Joined {formatDate(member.joined_date)}</p>
              <Badge variant={member.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card p-4 bg-credit-50 border-credit-200">
          <p className="text-xs font-semibold text-credit-600 uppercase tracking-wide">Total Deposited</p>
          <p className="text-xl font-bold text-credit-700 mt-1">{formatCurrency(summary.totalDeposited)}</p>
        </div>
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total Withdrawn</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(summary.totalWithdrawn)}</p>
        </div>
        <div className="card p-4 bg-emerald-50 border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Deposit Balance</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(summary.availableToWithdraw)}</p>
        </div>
        <div className="card p-4 bg-loan-50 border-loan-200">
          <p className="text-xs font-semibold text-loan-600 uppercase tracking-wide">Total Borrowed</p>
          <p className="text-xl font-bold text-loan-700 mt-1">{formatCurrency(summary.totalBorrowed)}</p>
        </div>
        <div className="card p-4 bg-red-50 border-red-200">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Outstanding Loan</p>
          <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(summary.outstanding)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Transaction timeline */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Transaction Timeline</h2>
            <div className="flex items-center gap-3 text-[10px] font-semibold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-credit-500 inline-block"/>Deposit</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Withdrawal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-loan-500 inline-block"/>Loan</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-repay-500 inline-block"/>Repayment</span>
            </div>
          </div>
          {timelineWithBalance.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No transactions yet</p>
          ) : (
            <div className="pt-1">
              {timelineWithBalance.map((item, i) => (
                <TimelineEntry key={`${item.type}-${item.id}-${i}`} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Loans breakdown */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="section-title">Loans</h2>
          {loans.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No loans taken</p>
          ) : (
            <div className="space-y-4">
              {loans.map(loan => {
                const pct = Math.min(100, (loan.repaid / loan.amount) * 100);
                const loanRepayments = state.repayments.filter(r => r.loan_id === loan.id);
                return (
                  <div key={loan.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{loan.id}</p>
                        <p className="text-xs text-slate-400">{formatDate(loan.date)}</p>
                      </div>
                      <Badge variant={loan.status} />
                    </div>
                    {loan.reason && (
                      <p className="text-xs text-slate-500 mb-2 italic">"{loan.reason}"</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Issued</p>
                        <p className="text-sm font-semibold text-slate-700">{formatCurrency(loan.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Repaid</p>
                        <p className="text-sm font-semibold text-repay-600">{formatCurrency(loan.repaid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Remaining</p>
                        <p className="text-sm font-semibold text-loan-600">{formatCurrency(loan.remaining)}</p>
                      </div>
                    </div>
                    <div className="progress-bar mb-2">
                      <div className="progress-fill bg-repay-400" style={{ width: `${pct}%` }} />
                    </div>
                    {loanRepayments.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Repayments</p>
                        {loanRepayments.map(r => (
                          <div key={r.id} className="flex justify-between text-xs">
                            <span className="text-slate-500">{formatDate(r.date)}{r.note ? ` — ${r.note}` : ''}</span>
                            <span className="font-medium text-repay-600">+{formatCurrency(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
