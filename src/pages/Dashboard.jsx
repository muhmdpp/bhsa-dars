import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  getPoolBalance, getTotalDeposited, getTotalLoaned, getTotalRepaid,
  getActiveLoanCount, getRecentActivity, getOutstandingLoans,
} from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';

function PoolBalanceHero({ balance, totalDeposited }) {
  const pct = totalDeposited > 0 ? (balance / totalDeposited) * 100 : 100;
  const colorClass = balance < 0
    ? 'text-loan-600'
    : pct < 20
    ? 'text-amber-600'
    : 'text-credit-600';
  const bgClass = balance < 0
    ? 'from-red-50 to-loan-50 border-loan-200'
    : pct < 20
    ? 'from-amber-50 to-orange-50 border-amber-200'
    : 'from-credit-50 to-emerald-50 border-credit-200';

  return (
    <div className={`card bg-gradient-to-br ${bgClass} border p-8 text-center animate-fade-in`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
        Current Pool Balance
      </p>
      <p className={`text-5xl sm:text-6xl font-bold ${colorClass} mb-2`}>
        {formatCurrency(balance)}
      </p>
      {balance < 0 && (
        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-loan-100 text-loan-700 text-xs font-semibold rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Pool balance is negative
        </span>
      )}
      {balance >= 0 && pct < 20 && (
        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Low pool balance ({pct.toFixed(0)}% of deposits)
        </span>
      )}
      {balance >= 0 && pct >= 20 && (
        <p className="text-sm text-slate-500 mt-1">{pct.toFixed(0)}% of total deposits available</p>
      )}
    </div>
  );
}

function ActivityIcon({ type }) {
  if (type === 'deposit') return (
    <div className="w-8 h-8 rounded-full bg-credit-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-credit-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </div>
  );
  if (type === 'loan') return (
    <div className="w-8 h-8 rounded-full bg-loan-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-loan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-repay-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-repay-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();

  const poolBalance    = getPoolBalance(state);
  const totalDeposited = getTotalDeposited(state.deposits);
  const totalLoaned    = getTotalLoaned(state.loans);
  const totalRepaid    = getTotalRepaid(state.repayments);
  const activeLoans    = getActiveLoanCount(state.loans, state.repayments);
  const activity       = getRecentActivity(state, 10);
  const outstanding    = getOutstandingLoans(state);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">BHSA Finance System — Admin Overview</p>
      </div>

      {/* Pool balance hero */}
      <PoolBalanceHero balance={poolBalance} totalDeposited={totalDeposited} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Deposited"
          value={formatCurrency(totalDeposited)}
          color="credit"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        <StatCard
          title="Total Lent Out"
          value={formatCurrency(totalLoaned)}
          color="loan"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Total Repaid"
          value={formatCurrency(totalRepaid)}
          color="repay"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          }
        />
        <StatCard
          title="Active Loans"
          value={activeLoans}
          subtitle="loans outstanding"
          color="debit"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <span className="text-xs text-slate-400">Last 10 transactions</span>
          </div>
          <div className="divide-y divide-slate-50">
            {activity.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">No transactions yet</p>
            ) : (
              activity.map(item => (
                <div key={`${item.type}-${item.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <ActivityIcon type={item.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.memberName}</p>
                    <p className="text-xs text-slate-400 truncate">{item.note || (item.type === 'deposit' ? 'Deposit' : item.type === 'loan' ? 'Loan issued' : 'Repayment')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${
                      item.type === 'deposit' ? 'text-credit-600'
                      : item.type === 'loan' ? 'text-loan-600'
                      : 'text-repay-600'
                    }`}>
                      {item.type === 'loan' ? '−' : '+'}{formatCurrency(item.amount)}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outstanding Loans */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Outstanding Loans</h2>
            <span className="text-xs text-slate-400">{outstanding.length} active</span>
          </div>
          {outstanding.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No outstanding loans 🎉</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {outstanding.map(loan => {
                const pct = Math.min(100, (loan.repaid / loan.amount) * 100);
                return (
                  <div
                    key={loan.id}
                    className="px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/members/${loan.member_id}`)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{loan.memberName}</p>
                        <p className="text-xs text-slate-400">{loan.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-loan-600">{formatCurrency(loan.remaining)} left</p>
                        <Badge variant={loan.status} />
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill bg-repay-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-slate-400">Repaid: {formatCurrency(loan.repaid)}</p>
                      <p className="text-xs text-slate-400">of {formatCurrency(loan.amount)}</p>
                    </div>
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
