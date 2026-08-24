import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, fetchAllRows } from '../lib/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────

function TimelineItem({ item }) {
  const isDeposit    = item.type === 'deposit';
  const isWithdrawal = item.type === 'withdrawal';
  const isLoan       = item.type === 'loan';

  const dotColor = isDeposit    ? 'bg-emerald-500'
                 : isWithdrawal ? 'bg-amber-500'
                 : isLoan       ? 'bg-red-500'
                 : 'bg-blue-500'; // repayment

  const amountColor = isDeposit    ? 'text-emerald-600'
                    : isWithdrawal ? 'text-amber-600'
                    : isLoan       ? 'text-red-600'
                    : 'text-blue-600';

  const sign  = (isLoan || isWithdrawal) ? '−' : '+';
  const label = isDeposit    ? 'Deposit'
              : isWithdrawal ? 'Withdrawal'
              : isLoan       ? 'Loan issued'
              : 'Loan repayment';

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${dotColor} ring-2 ring-white`} />
        <div className="w-px flex-1 bg-slate-200 mt-1 group-last:hidden" />
      </div>
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
        {item.runningBalance !== undefined && (
          <p className="text-xs text-slate-500 mt-1">
            Deposit balance: <span className="font-medium text-slate-700">{formatCurrency(item.runningBalance)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, colorClass, bgClass, borderClass }) {
  return (
    <div className={`rounded-2xl border p-5 ${bgClass} ${borderClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${colorClass}`}>{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MemberPortal() {
  const { memberSession, memberLogout } = useAuth();
  const { memberId, memberName } = memberSession || {};

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [d, w, l, r] = await Promise.all([
          fetchAllRows('deposits', q => q.eq('member_id', memberId).neq('deleted', true).order('date', { ascending: true })),
          fetchAllRows('withdrawals', q => q.eq('member_id', memberId).neq('deleted', true).order('date', { ascending: true })),
          fetchAllRows('loans', q => q.eq('member_id', memberId).neq('deleted', true).order('date', { ascending: true })),
          fetchAllRows('repayments', q => q.eq('member_id', memberId).neq('deleted', true).order('date', { ascending: true })),
        ]);

        const normalise = r => ({ ...r, amount: Number(r.amount) });
        setData({
          deposits:    d.map(normalise),
          withdrawals: w.map(normalise),
          loans:       l.map(normalise),
          repayments:  r.map(normalise),
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [memberId]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const summary = data ? (() => {
    const totalDeposited  = data.deposits.reduce((s, d) => s + d.amount, 0);
    const totalWithdrawn  = data.withdrawals.reduce((s, w) => s + w.amount, 0);
    const balance         = Math.max(0, totalDeposited - totalWithdrawn);
    const totalBorrowed   = data.loans.reduce((s, l) => s + l.amount, 0);
    const totalRepaid     = data.repayments.reduce((s, r) => s + r.amount, 0);
    const outstanding     = Math.max(0, totalBorrowed - totalRepaid);
    return { totalDeposited, totalWithdrawn, balance, outstanding };
  })() : null;

  const timeline = data ? (() => {
    const all = [
      ...data.deposits.map(d    => ({ ...d, type: 'deposit' })),
      ...data.withdrawals.map(w => ({ ...w, type: 'withdrawal' })),
      ...data.loans.map(l       => ({ ...l, type: 'loan' })),
      ...data.repayments.map(r  => ({ ...r, type: 'repayment' })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.type === 'deposit' ? -1 : 1));

    let running = 0;
    return all.map(item => {
      if      (item.type === 'deposit')    running += item.amount;
      else if (item.type === 'withdrawal') running -= item.amount;
      return { ...item, runningBalance: running };
    });
  })() : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background dot grid */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      {/* Top bar */}
      <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-lg flex items-center justify-center">
              <img src="/logo.png" alt="BHSA" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">BHSA Finance</p>
              <p className="text-sm font-semibold text-white leading-tight mt-0.5">{memberName}</p>
            </div>
          </div>
          <button
            onClick={memberLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Account</h1>
          <p className="text-sm text-slate-400 mt-0.5">Your personal balance &amp; transaction history</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Total Deposited"
              value={formatCurrency(summary.totalDeposited)}
              colorClass="text-emerald-400"
              bgClass="bg-emerald-500/10"
              borderClass="border-emerald-500/20"
            />
            <SummaryCard
              label="Total Withdrawn"
              value={formatCurrency(summary.totalWithdrawn)}
              colorClass="text-amber-400"
              bgClass="bg-amber-500/10"
              borderClass="border-amber-500/20"
            />
            <SummaryCard
              label="Balance"
              value={formatCurrency(summary.balance)}
              colorClass={summary.balance > 0 ? 'text-sky-400' : 'text-slate-400'}
              bgClass={summary.balance > 0 ? 'bg-sky-500/10' : 'bg-slate-500/10'}
              borderClass={summary.balance > 0 ? 'border-sky-500/20' : 'border-slate-500/20'}
            />
            <SummaryCard
              label="Loan Outstanding"
              value={formatCurrency(summary.outstanding)}
              colorClass={summary.outstanding > 0 ? 'text-red-400' : 'text-slate-400'}
              bgClass={summary.outstanding > 0 ? 'bg-red-500/10' : 'bg-slate-500/10'}
              borderClass={summary.outstanding > 0 ? 'border-red-500/20' : 'border-slate-500/20'}
            />
          </div>
        )}

        {/* Transaction timeline */}
        {data && (
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Transaction History</h2>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Deposit</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Withdrawal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Loan</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Repayment</span>
              </div>
            </div>

            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No transactions yet</p>
            ) : (
              <div className="pt-1">
                {[...timeline].reverse().map((item, i) => (
                  <TimelineItem key={`${item.type}-${item.id}-${i}`} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-600 pb-4">
          BHSA Finance System · Read-only member view · {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
