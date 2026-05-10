/**
 * All computation/derived-state functions.
 * These are pure functions — they take raw data arrays and return computed values.
 * No side effects, easy to test and replace with API calls later.
 */

// ── Pool Balance ────────────────────────────────────────────────────────────

export function getPoolBalance({ deposits, loans, repayments, withdrawals = [] }) {
  const totalDeposited  = deposits.reduce((s, d) => s + d.amount, 0);
  const totalLoaned     = loans.reduce((s, l) => s + l.amount, 0);
  const totalRepaid     = repayments.reduce((s, r) => s + r.amount, 0);
  const totalWithdrawn  = withdrawals.reduce((s, w) => s + w.amount, 0);
  return totalDeposited - totalLoaned + totalRepaid - totalWithdrawn;
}

export function getTotalDeposited(deposits) {
  return deposits.reduce((s, d) => s + d.amount, 0);
}

export function getTotalLoaned(loans) {
  return loans.reduce((s, l) => s + l.amount, 0);
}

export function getTotalRepaid(repayments) {
  return repayments.reduce((s, r) => s + r.amount, 0);
}

export function getTotalWithdrawn(withdrawals = []) {
  return withdrawals.reduce((s, w) => s + w.amount, 0);
}

// ── Loan helpers ────────────────────────────────────────────────────────────

// Sum of repayments for a specific loan
export function getLoanRepaidAmount(loanId, repayments) {
  return repayments
    .filter(r => r.loan_id === loanId)
    .reduce((s, r) => s + r.amount, 0);
}

// Remaining balance for a specific loan
export function getLoanRemaining(loan, repayments) {
  return Math.max(0, loan.amount - getLoanRepaidAmount(loan.id, repayments));
}

// Status: active | partially_repaid | cleared
export function computeLoanStatus(loan, repayments) {
  const repaid = getLoanRepaidAmount(loan.id, repayments);
  if (repaid <= 0) return 'active';
  if (repaid >= loan.amount) return 'cleared';
  return 'partially_repaid';
}

// Get all loans for a member with computed fields
export function getMemberLoansWithStatus(memberId, loans, repayments) {
  return loans
    .filter(l => l.member_id === memberId)
    .map(l => ({
      ...l,
      repaid: getLoanRepaidAmount(l.id, repayments),
      remaining: getLoanRemaining(l, repayments),
      status: computeLoanStatus(l, repayments),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Active loans (not cleared AND remaining > 0) for a member
export function getMemberActiveLoans(memberId, loans, repayments) {
  return getMemberLoansWithStatus(memberId, loans, repayments)
    .filter(l => l.status !== 'cleared' && l.remaining > 0);
}

// ── Member summary ──────────────────────────────────────────────────────────

export function getMemberSummary(memberId, { deposits, loans, repayments, withdrawals = [] }) {
  const memberDeposits    = deposits.filter(d => d.member_id === memberId);
  const memberLoans       = loans.filter(l => l.member_id === memberId);
  const memberRepayments  = repayments.filter(r => r.member_id === memberId);
  const memberWithdrawals = withdrawals.filter(w => w.member_id === memberId);

  const totalDeposited  = memberDeposits.reduce((s, d) => s + d.amount, 0);
  const totalWithdrawn  = memberWithdrawals.reduce((s, w) => s + w.amount, 0);
  const totalBorrowed   = memberLoans.reduce((s, l) => s + l.amount, 0);
  const totalRepaid     = memberRepayments.reduce((s, r) => s + r.amount, 0);
  const outstanding     = Math.max(0, totalBorrowed - totalRepaid);
  const activeLoans     = memberLoans.filter(l => computeLoanStatus(l, repayments) !== 'cleared');
  const availableToWithdraw = Math.max(0, totalDeposited - totalWithdrawn);

  return { totalDeposited, totalWithdrawn, totalBorrowed, totalRepaid, outstanding, activeLoansCount: activeLoans.length, availableToWithdraw };
}

// Member's personal deposit balance (deposits minus withdrawals) — withdrawal limit
export function getMemberDepositBalance(memberId, deposits, withdrawals = []) {
  const deposited  = deposits.filter(d => d.member_id === memberId).reduce((s, d) => s + d.amount, 0);
  const withdrawn  = withdrawals.filter(w => w.member_id === memberId).reduce((s, w) => s + w.amount, 0);
  return Math.max(0, deposited - withdrawn);
}

// ── Recent activity ─────────────────────────────────────────────────────────

// Returns a unified activity list from all tables, sorted by date desc
export function getRecentActivity({ deposits, loans, repayments, withdrawals = [], members }, limit = 10) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));

  const all = [
    ...deposits.map(d => ({
      id: d.id,
      type: 'deposit',
      member_id: d.member_id,
      memberName: memberMap[d.member_id] || 'Unknown',
      amount: d.amount,
      date: d.date,
      note: d.note,
    })),
    ...loans.map(l => ({
      id: l.id,
      type: 'loan',
      member_id: l.member_id,
      memberName: memberMap[l.member_id] || 'Unknown',
      amount: l.amount,
      date: l.date,
      note: l.reason,
    })),
    ...repayments.map(r => ({
      id: r.id,
      type: 'repayment',
      member_id: r.member_id,
      memberName: memberMap[r.member_id] || 'Unknown',
      amount: r.amount,
      date: r.date,
      note: r.note,
      loan_id: r.loan_id,
    })),
    ...withdrawals.map(w => ({
      id: w.id,
      type: 'withdrawal',
      member_id: w.member_id,
      memberName: memberMap[w.member_id] || 'Unknown',
      amount: w.amount,
      date: w.date,
      note: w.note,
    })),
  ];

  return all
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

// ── Pool balance trend ──────────────────────────────────────────────────────

// Returns [{date, balance}] sorted ascending — one point per unique date
export function getPoolBalanceTrend({ deposits, loans, repayments, withdrawals = [] }) {
  const events = [
    ...deposits.map(d => ({ date: d.date, delta: +d.amount })),
    ...loans.map(l => ({ date: l.date, delta: -l.amount })),
    ...repayments.map(r => ({ date: r.date, delta: +r.amount })),
    ...withdrawals.map(w => ({ date: w.date, delta: -w.amount })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  const trend = [];
  for (const e of events) {
    running += e.delta;
    const last = trend[trend.length - 1];
    if (last && last.date === e.date) {
      last.balance = running;
    } else {
      trend.push({ date: e.date, balance: running });
    }
  }
  return trend;
}

// ── Outstanding loans list ──────────────────────────────────────────────────

export function getOutstandingLoans({ loans, repayments, members }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));
  return loans
    .map(l => {
      const repaid    = getLoanRepaidAmount(l.id, repayments);
      const remaining = Math.max(0, l.amount - repaid);
      const status    = computeLoanStatus(l, repayments);
      return { ...l, repaid, remaining, status, memberName: memberMap[l.member_id] || 'Unknown' };
    })
    .filter(l => l.status !== 'cleared')
    .sort((a, b) => b.remaining - a.remaining);
}

// ── Active loan count ───────────────────────────────────────────────────────

export function getActiveLoanCount(loans, repayments) {
  return loans.filter(l => computeLoanStatus(l, repayments) !== 'cleared').length;
}

// ── Daily stats (for dashboard today summary) ───────────────────────────────

export function getDailyStats({ deposits, loans, repayments, withdrawals = [] }, isoDate) {
  const d = deposits.filter(x => x.date === isoDate);
  const l = loans.filter(x => x.date === isoDate);
  const r = repayments.filter(x => x.date === isoDate);
  const w = withdrawals.filter(x => x.date === isoDate);

  const deposited   = d.reduce((s, x) => s + x.amount, 0);
  const loaned      = l.reduce((s, x) => s + x.amount, 0);
  const repaid      = r.reduce((s, x) => s + x.amount, 0);
  const withdrawn   = w.reduce((s, x) => s + x.amount, 0);
  const net         = deposited - loaned + repaid - withdrawn;
  const txnCount    = d.length + l.length + r.length + w.length;

  return { deposited, loaned, repaid, withdrawn, net, txnCount };
}
