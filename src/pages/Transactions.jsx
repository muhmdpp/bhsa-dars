import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { formatCurrency, formatDate } from '../utils/formatters';

// ── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ txn, type, onClose, onSave }) {
  const [amount, setAmount]   = useState(String(txn.amount));
  const [date, setDate]       = useState(txn.date);
  const [note, setNote]       = useState(txn.note || txn.reason || '');
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) { setError('Please provide a reason for the edit.'); return; }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      const updates = { amount: Number(amount), date };
      if (type === 'loan')   updates.reason = note;
      else                   updates.note   = note;
      await onSave(txn.id, updates, reason.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Transaction</h2>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{type} · {txn.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  type="number" min="1" step="1"
                  className="form-input pl-7"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">{type === 'loan' ? 'Reason/Note' : 'Note'} (optional)</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Transaction note" />
          </div>

          <div>
            <label className="form-label">Reason for Edit *</label>
            <textarea
              className="form-input resize-none"
              rows={2}
              placeholder="Why is this being changed? (required)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ txn, type, onClose, onConfirm }) {
  const [reason, setReason]  = useState('');
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState('');

  async function handleConfirm() {
    if (!reason.trim()) { setError('Please provide a reason for deletion.'); return; }
    setSaving(true);
    try {
      await onConfirm(txn.id, reason.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Delete Transaction</h2>
              <p className="text-xs text-slate-500 capitalize">{type} · {txn.id} · {formatCurrency(txn.amount)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            This will <strong>permanently remove</strong> this transaction from all records and update the pool balance accordingly.
          </p>

          <div>
            <label className="form-label">Reason for Deletion *</label>
            <textarea
              className="form-input resize-none"
              rows={2}
              placeholder="Why is this record being deleted? (required)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transaction Row ──────────────────────────────────────────────────────────
function TxnRow({ txn, type, memberMap, onEdit, onDelete }) {
  const memberName = memberMap[txn.member_id] || 'Unknown';
  const noteText   = txn.note || txn.reason || '—';

  const typeColor = type === 'deposit' ? 'text-credit-600'
    : type === 'loan' ? 'text-loan-600'
    : 'text-repay-600';
  const sign = type === 'loan' ? '−' : '+';

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{txn.id}</td>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">{memberName}</td>
      <td className={`px-4 py-3 text-sm font-semibold ${typeColor} whitespace-nowrap`}>
        {sign}{formatCurrency(txn.amount)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(txn.date)}</td>
      <td className="px-4 py-3 text-sm text-slate-400 max-w-[160px] truncate">{noteText}</td>
      {txn.edit_reason && (
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edited
          </span>
        </td>
      )}
      {!txn.edit_reason && <td className="px-4 py-3" />}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <button
            title="Edit"
            onClick={() => onEdit(txn)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            title="Delete"
            onClick={() => onDelete(txn)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'deposits',   label: 'Deposits',   color: 'text-credit-600' },
  { key: 'loans',      label: 'Loans',      color: 'text-loan-600' },
  { key: 'repayments', label: 'Repayments', color: 'text-repay-600' },
];

export default function Transactions() {
  const { state, actions } = useStore();
  const [activeTab, setActiveTab] = useState('deposits');
  const [search, setSearch]       = useState('');
  const [editTarget, setEditTarget]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const memberMap = useMemo(
    () => Object.fromEntries(state.members.map(m => [m.id, m.name])),
    [state.members]
  );

  const currentData = useMemo(() => {
    const raw = state[activeTab] || [];
    if (!search.trim()) return raw;
    const q = search.toLowerCase();
    return raw.filter(txn => {
      const name = (memberMap[txn.member_id] || '').toLowerCase();
      const note = (txn.note || txn.reason || '').toLowerCase();
      return name.includes(q) || txn.id.toLowerCase().includes(q) || note.includes(q);
    });
  }, [state, activeTab, search, memberMap]);

  const totals = useMemo(() => {
    const raw = state[activeTab] || [];
    return raw.reduce((s, t) => s + t.amount, 0);
  }, [state, activeTab]);

  // Edit save handlers
  async function handleEditSave(id, updates, reason) {
    if (activeTab === 'deposits')   await actions.updateDeposit(id, updates, reason);
    if (activeTab === 'loans')      await actions.updateLoan(id, updates, reason);
    if (activeTab === 'repayments') await actions.updateRepayment(id, updates, reason);
  }

  // Delete handlers
  async function handleDeleteConfirm(id, reason) {
    if (activeTab === 'deposits')   await actions.deleteDeposit(id, reason);
    if (activeTab === 'loans')      await actions.deleteLoan(id, reason);
    if (activeTab === 'repayments') await actions.deleteRepayment(id, reason);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">View, edit and delete all financial records</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search member, ID or note…"
            className="form-input pl-9 w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-slate-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => { setActiveTab(tab.key); setSearch(''); }}
              className={`px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? `${tab.color} border-current`
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'
              }`}>
                {(state[tab.key] || []).length}
              </span>
            </button>
          ))}
        </div>

        {/* Summary bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-700">{currentData.length}</strong> of <strong className="text-slate-700">{(state[activeTab] || []).length}</strong> records
          </span>
          <span>
            Total: <strong className="text-slate-800">{formatCurrency(totals)}</strong>
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {currentData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              {search ? `No results for "${search}"` : 'No records found.'}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['ID', 'Member', 'Amount', 'Date', 'Note', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentData.map(txn => (
                  <TxnRow
                    key={txn.id}
                    txn={txn}
                    type={activeTab.slice(0, -1)} // deposits→deposit
                    memberMap={memberMap}
                    onEdit={t => setEditTarget(t)}
                    onDelete={t => setDeleteTarget(t)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {editTarget && (
        <EditModal
          txn={editTarget}
          type={activeTab.slice(0, -1)}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          txn={deleteTarget}
          type={activeTab.slice(0, -1)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
