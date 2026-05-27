import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getMemberSummary } from '../utils/calculations';
import { formatCurrency, formatDate, todayISO } from '../utils/formatters';
import Badge from '../components/ui/Badge';
import { BATCH_NUMBERS, getBatchColors } from '../utils/batchConfig';

export default function Members() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [form, setForm] = useState({ name: '', phone: '', joined_date: todayISO(), batch: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Edit member modal ────────────────────────────────────────────────────
  const [editMember, setEditMember]     = useState(null); // the member being edited
  const [editForm, setEditForm]         = useState({ name: '', phone: '', joined_date: '', batch: '' });
  const [editError, setEditError]       = useState('');
  const [editSaving, setEditSaving]     = useState(false);

  // ── Delete member modal ──────────────────────────────────────────────────
  const [deleteMember, setDeleteMember]   = useState(null);
  const [deleteStep, setDeleteStep]       = useState(1);   // 1 = warning, 2 = confirm
  const [deleteInput, setDeleteInput]     = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  function openEdit(e, member) {
    e.stopPropagation();
    setEditMember(member);
    setEditForm({ name: member.name, phone: member.phone, joined_date: member.joined_date, batch: member.batch || '' });
    setEditError('');
  }

  function closeEdit() {
    setEditMember(null);
    setEditError('');
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.name.trim())                          { setEditError('Name is required.'); return; }
    if (!/^\d{10}$/.test(editForm.phone.trim()))         { setEditError('Phone must be exactly 10 digits.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await actions.updateMember(editMember.id, {
        name:        editForm.name.trim(),
        phone:       editForm.phone.trim(),
        joined_date: editForm.joined_date,
        batch:       editForm.batch ? Number(editForm.batch) : null,
      });
      closeEdit();
    } catch (err) {
      setEditError(err.message || 'Failed to update member.');
    } finally {
      setEditSaving(false);
    }
  }

  const members = state.members
    .filter(m => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search);
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .map(m => ({ ...m, ...getMemberSummary(m.id, state) }))
    .sort((a, b) => {
      let aVal = a[sortBy] ?? '';
      let bVal = b[sortBy] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-slate-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())                        { setFormError('Name is required'); return; }
    if (!/^\d{10}$/.test(form.phone.trim()))       { setFormError('Phone must be exactly 10 digits'); return; }
    if (!form.batch)                               { setFormError('Batch number is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      await actions.addMember(form);
      setForm({ name: '', phone: '', joined_date: todayISO(), batch: '' });
      setShowForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(e, member) {
    e.stopPropagation();
    try {
      await actions.updateMember(member.id, {
        status: member.status === 'active' ? 'inactive' : 'active',
      });
    } catch (err) {
      console.error(err);
    }
  }

  function openDelete(e, member) {
    e.stopPropagation();
    setDeleteMember(member);
    setDeleteStep(1);
    setDeleteInput('');
    setDeleteError('');
  }

  function closeDelete() {
    setDeleteMember(null);
    setDeleteStep(1);
    setDeleteInput('');
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (deleteInput.trim() !== deleteMember.name.trim()) {
      setDeleteError('Name does not match. Type the exact name to confirm.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await actions.deleteMemberPermanently(deleteMember.id);
      closeDelete();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete member.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-0.5">{state.members.length} members registered</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </button>
      </div>

      {/* Add member form */}
      {showForm && (
        <div className="card p-5 border-slate-200 animate-slide-up">
          <h2 className="text-base font-semibold text-slate-900 mb-4">New Member</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input
                id="member-name" type="text" className="form-input"
                placeholder="e.g. Abdullah Karimi"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Phone *</label>
              <input
                id="member-phone" type="tel" className="form-input"
                placeholder="9876543210"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Joined Date</label>
              <input
                id="member-joined-date" type="date" className="form-input"
                value={form.joined_date}
                onChange={e => setForm(f => ({ ...f, joined_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Batch No. *</label>
              <select
                id="member-batch"
                className="form-input"
                value={form.batch}
                onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
              >
                <option value="">Select batch…</option>
                {BATCH_NUMBERS.map(n => (
                  <option key={n} value={n}>Batch {n}</option>
                ))}
              </select>
            </div>
            {formError && (
              <div className="sm:col-span-4">
                <p className="text-sm text-loan-600">{formError}</p>
              </div>
            )}
            <div className="sm:col-span-4 flex gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save Member'}
              </button>
              <button
                type="button" className="btn-secondary"
                onClick={() => { setShowForm(false); setFormError(''); }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="members-search" type="text" className="form-input pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          id="members-status-filter" className="form-input sm:w-40"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="cursor-pointer select-none">
                  Name <SortIcon col="name" />
                </th>
                <th>Phone</th>
                <th>Joined</th>
                <th onClick={() => toggleSort('totalDeposited')} className="cursor-pointer select-none">
                  Deposited <SortIcon col="totalDeposited" />
                </th>
                <th onClick={() => toggleSort('totalBorrowed')} className="cursor-pointer select-none">
                  Borrowed <SortIcon col="totalBorrowed" />
                </th>
                <th onClick={() => toggleSort('outstanding')} className="cursor-pointer select-none">
                  Outstanding <SortIcon col="outstanding" />
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    {state.members.length === 0 ? 'No members yet — add your first member above' : 'No members match your search'}
                  </td>
                </tr>
              ) : (
                members.map(m => (
                  <tr key={m.id} className="cursor-pointer" onClick={() => navigate(`/members/${m.id}`)}>
                    <td className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {m.batch && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBatchColors(m.batch).chip}`}>
                            B{m.batch}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-500">{m.phone}</td>
                    <td className="text-slate-500">{formatDate(m.joined_date)}</td>
                    <td className="font-medium text-credit-600">{formatCurrency(m.totalDeposited)}</td>
                    <td className="font-medium text-loan-600">{formatCurrency(m.totalBorrowed)}</td>
                    <td className="font-semibold">
                      {m.outstanding > 0
                        ? <span className="text-debit-600">{formatCurrency(m.outstanding)}</span>
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td><Badge variant={m.status} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/members/${m.id}`)}
                          className="text-xs text-repay-600 hover:text-repay-800 font-medium"
                        >
                          Ledger
                        </button>
                        <button
                          id={`edit-member-${m.id}`}
                          onClick={e => openEdit(e, m)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={e => handleToggleStatus(e, m)}
                          className={`text-xs font-medium ${
                            m.status === 'active'
                              ? 'text-slate-400 hover:text-red-600'
                              : 'text-credit-600 hover:text-credit-800'
                          }`}
                        >
                          {m.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          id={`delete-member-${m.id}`}
                          onClick={e => openDelete(e, m)}
                          className="text-xs font-medium text-red-400 hover:text-red-700 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Member Modal ─────────────────────────────────────────────── */}
      {editMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.45)' }}
          onClick={closeEdit}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Edit Member</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editMember.id}</p>
              </div>
              <button
                onClick={closeEdit}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="edit-member-name">Full Name *</label>
                <input
                  id="edit-member-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Abdullah Karimi"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="edit-member-phone">Phone *</label>
                <input
                  id="edit-member-phone"
                  type="tel"
                  className="form-input"
                  placeholder="9876543210"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="edit-member-joined">Joined Date</label>
                <input
                  id="edit-member-joined"
                  type="date"
                  className="form-input"
                  value={editForm.joined_date}
                  onChange={e => setEditForm(f => ({ ...f, joined_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="edit-member-batch">Batch No. *</label>
                <select
                  id="edit-member-batch"
                  className="form-input"
                  value={editForm.batch}
                  onChange={e => setEditForm(f => ({ ...f, batch: e.target.value }))}
                >
                  <option value="">Select batch…</option>
                  {BATCH_NUMBERS.map(n => (
                    <option key={n} value={n}>Batch {n}</option>
                  ))}
                </select>
              </div>

              {editError && (
                <p className="text-sm text-red-600">{editError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  id="save-edit-member-btn"
                  className="btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeEdit}
                  disabled={editSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Member Modal ────────────────────────────────────────────── */}
      {deleteMember && (() => {
        const delDeposits    = state.deposits.filter(d => d.member_id === deleteMember.id).length;
        const delLoans       = state.loans.filter(l => l.member_id === deleteMember.id).length;
        const delRepayments  = state.repayments.filter(r => r.member_id === deleteMember.id).length;
        const delWithdrawals = state.withdrawals.filter(w => w.member_id === deleteMember.id).length;
        const nameMatch      = deleteInput.trim() === deleteMember.name.trim();

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
            onClick={closeDelete}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Red danger header */}
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Permanently Delete Member</h2>
                  <p className="text-xs text-red-200 mt-0.5">This action cannot be undone</p>
                </div>
                <button
                  onClick={closeDelete}
                  className="ml-auto w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">

                {/* Step 1 — Warning */}
                {deleteStep === 1 && (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        You are about to permanently delete:
                      </p>
                      <p className="text-base font-bold text-slate-900 mt-1">{deleteMember.name}</p>
                    </div>

                    {/* What gets deleted */}
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3">Records that will be wiped</p>
                      {[
                        { label: 'Deposit entries',    count: delDeposits },
                        { label: 'Loan entries',       count: delLoans },
                        { label: 'Repayment entries',  count: delRepayments },
                        { label: 'Withdrawal entries', count: delWithdrawals },
                      ].map(({ label, count }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm text-red-700">{label}</span>
                          <span className="text-sm font-bold text-red-800">{count}</span>
                        </div>
                      ))}
                      <div className="border-t border-red-200 pt-2 mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-red-800">Total records</span>
                        <span className="text-sm font-bold text-red-900">
                          {delDeposits + delLoans + delRepayments + delWithdrawals + 1}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteStep(2)}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        I understand — continue →
                      </button>
                      <button
                        onClick={closeDelete}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2 — Name confirmation */}
                {deleteStep === 2 && (
                  <>
                    <div>
                      <p className="text-sm text-slate-700">
                        Type <span className="font-bold text-slate-900">{deleteMember.name}</span> exactly to confirm deletion:
                      </p>
                      <input
                        id="delete-confirm-input"
                        type="text"
                        className="form-input mt-3"
                        placeholder="Type member name here…"
                        value={deleteInput}
                        onChange={e => { setDeleteInput(e.target.value); setDeleteError(''); }}
                        autoFocus
                      />
                      {deleteError && (
                        <p className="text-xs text-red-600 mt-1.5">{deleteError}</p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        id="confirm-delete-member-btn"
                        onClick={handleDeleteConfirm}
                        disabled={!nameMatch || deleteLoading}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                          nameMatch && !deleteLoading
                            ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                            : 'bg-red-100 text-red-300 cursor-not-allowed'
                        }`}
                      >
                        {deleteLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                            Deleting…
                          </span>
                        ) : 'Permanently Delete'}
                      </button>
                      <button
                        onClick={() => setDeleteStep(1)}
                        className="btn-secondary"
                        disabled={deleteLoading}
                      >
                        ← Back
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
