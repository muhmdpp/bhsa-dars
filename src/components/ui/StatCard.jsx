export default function StatCard({ title, value, subtitle, icon, color = 'slate', trend }) {
  const colorMap = {
    slate:  { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',  text: 'text-slate-900' },
    credit: { bg: 'bg-credit-50',  icon: 'bg-credit-100 text-credit-700', text: 'text-credit-700' },
    loan:   { bg: 'bg-loan-50',    icon: 'bg-loan-100 text-loan-700',    text: 'text-loan-700' },
    repay:  { bg: 'bg-repay-50',   icon: 'bg-repay-100 text-repay-700',  text: 'text-repay-700' },
    debit:  { bg: 'bg-debit-50',   icon: 'bg-debit-100 text-debit-700',  text: 'text-debit-700' },
    amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-700',  text: 'text-amber-700' },
  };

  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={`card p-5 ${c.bg} animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className={`text-2xl font-bold ${c.text} truncate`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-credit-600' : 'text-loan-600'}`}>
              {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={`ml-4 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
