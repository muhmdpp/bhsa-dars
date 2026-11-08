// Format number as Indian Rupees: ₹1,23,456
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  const num = Number(amount);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Format date string to DD MMM YYYY
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Today's date as YYYY-MM-DD for date inputs
// Uses the device's local date (not UTC), so entries made after midnight IST
// don't default to the previous day.
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Generate unique IDs
// Timestamp counter + random suffix so two devices writing in the same
// millisecond can't produce the same ID.
let _counter = Date.now();
export function generateId(prefix = 'ID') {
  _counter++;
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${_counter}${rand}`;
}

// Next loan ID in LOAN-0001 format: highest existing number + 1
// (row count breaks once any loan row is hard-deleted).
export function generateLoanId(existingLoans) {
  const max = (existingLoans || []).reduce((m, l) => {
    const n = /^LOAN-(\d+)$/.exec(l.id)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `LOAN-${String(max + 1).padStart(4, '0')}`;
}

// Truncate text
export function truncate(str, n = 40) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
