import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store/useStore';
import {
  getMemberSummary, getOutstandingLoans, getPoolBalanceTrend,
  getPoolBalance, getTotalDeposited,
} from '../utils/calculations';
import { formatCurrency, formatDate } from '../utils/formatters';
import Badge from '../components/ui/Badge';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-slate-500 text-xs mb-0.5">{formatDate(label)}</p>
      <p className="font-bold text-slate-900">{formatCurrency(payload[0]?.value || 0)}</p>
    </div>
  );
}

export default function Reports() {
  const { state } = useStore();
  const [memberSort, setMemberSort] = useState('name');
  const [memberSortDir, setMemberSortDir] = useState('asc');

  const poolBalance    = getPoolBalance(state);
  const totalDeposited = getTotalDeposited(state.deposits);
  const trend          = getPoolBalanceTrend(state);
  const outstanding    = getOutstandingLoans(state);

  // Member summary table
  const memberRows = state.members
    .map(m => ({ ...m, ...getMemberSummary(m.id, state) }))
    .sort((a, b) => {
      let av = a[memberSort] ?? '';
      let bv = b[memberSort] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return memberSortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  function toggleSort(col) {
    if (memberSort === col) setMemberSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setMemberSort(col); setMemberSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (memberSort !== col) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="ml-1">{memberSortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // Format trend chart X-axis
  const trendData = trend.map(t => ({
    date: t.date,
    balance: t.balance,
    label: formatDate(t.date),
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Fund summary and analytics</p>
      </div>

      {/* Pool balance trend chart */}
      <div className="card p-5">
        <h2 className="section-title">Pool Balance Over Time</h2>
        {trendData.length < 2 ? (
          <p className="text-sm text-slate-400 text-center py-10">Need at least 2 transactions to show trend</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={d => {
                  const dt = new Date(d);
                  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#balanceGrad)"
                dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Member summary table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Member-wise Summary</h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="cursor-pointer select-none">
                  Member <SortIcon col="name" />
                </th>
                <th>Status</th>
                <th onClick={() => toggleSort('totalDeposited')} className="cursor-pointer select-none">
                  Deposited <SortIcon col="totalDeposited" />
                </th>
                <th onClick={() => toggleSort('totalBorrowed')} className="cursor-pointer select-none">
                  Borrowed <SortIcon col="totalBorrowed" />
                </th>
                <th onClick={() => toggleSort('totalRepaid')} className="cursor-pointer select-none">
                  Repaid <SortIcon col="totalRepaid" />
                </th>
                <th onClick={() => toggleSort('outstanding')} className="cursor-pointer select-none">
                  Outstanding <SortIcon col="outstanding" />
                </th>
                <th>Active Loans</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map(m => (
                <tr key={m.id}>
                  <td>
                    <div>
                      <p className="font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.phone}</p>
                    </div>
                  </td>
                  <td><Badge variant={m.status} /></td>
                  <td className="font-medium text-credit-600">{formatCurrency(m.totalDeposited)}</td>
                  <td className="font-medium text-loan-600">{formatCurrency(m.totalBorrowed)}</td>
                  <td className="font-medium text-repay-600">{formatCurrency(m.totalRepaid)}</td>
                  <td>
                    {m.outstanding > 0
                      ? <span className="font-semibold text-debit-600">{formatCurrency(m.outstanding)}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td>
                    {m.activeLoansCount > 0
                      ? <span className="badge bg-debit-100 text-debit-700">{m.activeLoansCount}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outstanding loans sorted by amount */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Outstanding Loans</h2>
          <span className="text-xs text-slate-400 font-medium">Sorted by remaining (highest first)</span>
        </div>
        {outstanding.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No outstanding loans 🎉</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Member</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Issued</th>
                  <th>Repaid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map(loan => (
                  <tr key={loan.id}>
                    <td className="font-mono text-xs font-semibold text-slate-700">{loan.id}</td>
                    <td className="font-medium text-slate-900">{loan.memberName}</td>
                    <td className="text-slate-500">{formatDate(loan.date)}</td>
                    <td className="text-slate-500 max-w-xs truncate">{loan.reason}</td>
                    <td className="text-slate-700">{formatCurrency(loan.amount)}</td>
                    <td className="text-repay-600 font-medium">{formatCurrency(loan.repaid)}</td>
                    <td className="font-bold text-loan-600">{formatCurrency(loan.remaining)}</td>
                    <td><Badge variant={loan.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
