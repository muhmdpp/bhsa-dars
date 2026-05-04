const variants = {
  active:           'bg-credit-100 text-credit-700',
  partially_repaid: 'bg-amber-100 text-amber-700',
  cleared:          'bg-slate-100 text-slate-500',
  inactive:         'bg-red-100 text-red-600',
  deposit:          'bg-credit-100 text-credit-700',
  loan:             'bg-loan-100 text-loan-700',
  repayment:        'bg-repay-100 text-repay-700',
  success:          'bg-credit-100 text-credit-700',
  warning:          'bg-amber-100 text-amber-700',
  danger:           'bg-loan-100 text-loan-700',
  neutral:          'bg-slate-100 text-slate-600',
};

const labels = {
  active:           'Active',
  partially_repaid: 'Partial',
  cleared:          'Cleared',
  inactive:         'Inactive',
  deposit:          'Deposit',
  loan:             'Loan',
  repayment:        'Repayment',
};

export default function Badge({ variant = 'neutral', children, className = '' }) {
  const cls = variants[variant] || variants.neutral;
  const text = children || labels[variant] || variant;

  return (
    <span className={`badge ${cls} ${className}`}>
      {text}
    </span>
  );
}
