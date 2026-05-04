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
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// Generate unique IDs
let _counter = Date.now();
export function generateId(prefix = 'ID') {
  _counter++;
  return `${prefix}-${_counter}`;
}

// Generate loan ID in LOAN-0001 format
export function generateLoanId(existingLoans) {
  const next = (existingLoans?.length || 0) + 1;
  return `LOAN-${String(next).padStart(4, '0')}`;
}

// Truncate text
export function truncate(str, n = 40) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
