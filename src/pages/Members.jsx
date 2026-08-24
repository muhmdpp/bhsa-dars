import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getMemberSummary } from '../utils/calculations';
import { formatCurrency, formatDate, todayISO } from '../utils/formatters';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import { BATCH_NUMBERS, getBatchColors } from '../utils/batchConfig';

export default function Members() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
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

  // ── Set PIN modal ─────────────────────────────────────────────────────────
  const [pinMember, setPinMember]   = useState(null);
  const [pinValue, setPinValue]     = useState('');
  const [pinError, setPinError]     = useState('');
  const [pinSaving, setPinSaving]   = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

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

  function openPin(e, member) {
    e.stopPropagation();
    setPinMember(member);
    setPinValue('');
    setPinError('');
    setPinSuccess(false);
  }

  function closePin() {
    setPinMember(null);
    setPinValue('');
    setPinError('');
    setPinSuccess(false);
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinValue)) { setPinError('PIN must be exactly 4 digits.'); return; }
    setPinSaving(true);
    setPinError('');
    try {
      await actions.setMemberPin(pinMember.id, pinValue);
      setPinSuccess(true);
    } catch (err) {
      setPinError(err.message || 'Failed to set PIN.');
    } finally {
      setPinSaving(false);
    }
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

  const members = useMemo(() => {
    return state.members
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
  }, [state, search, statusFilter, sortBy, sortDir]);

  const paginatedMembers = useMemo(() => {
    const from = (page - 1) * pageSize;
    return members.slice(from, from + pageSize);
  }, [members, page, pageSize]);

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
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          id="members-status-filter" className="form-input sm:w-40"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
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
                <th onClick={() => toggleSort('totalWithdrawn')} className="cursor-pointer select-none">
                  Withdrawn <SortIcon col="totalWithdrawn" />
                </th>
                <th onClick={() => toggleSort('availableToWithdraw')} className="cursor-pointer select-none">
                  Balance <SortIcon col="availableToWithdraw" />
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
                  <td colSpan={10} className="text-center text-slate-400 py-10">
                    {state.members.length === 0 ? 'No members yet — add your first member above' : 'No members match your search'}
                  </td>
                </tr>
              ) : (
                paginatedMembers.map(m => (
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
                    <td className="font-medium text-amber-600">{m.totalWithdrawn > 0 ? formatCurrency(m.totalWithdrawn) : <span className="text-slate-400">—</span>}</td>
                    <td className="font-semibold">
                      <span className={m.availableToWithdraw > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                        {formatCurrency(m.availableToWithdraw)}
                      </span>
                    </td>
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
                          id={`set-pin-${m.id}`}
                          onClick={e => openPin(e, m)}
                          className="text-xs text-indigo-500 hover:text-indigo-800 font-medium"
                        >
                          Set PIN
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalItems={members.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
        />
      </div>

      {/* ── Set PIN Modal ──────────────────────────────────────────────────── */}
      {pinMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.45)' }}
          onClick={closePin}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-5 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Set Member PIN</h2>
                <p className="text-xs text-slate-400 mt-0.5">{pinMember.name}</p>
              </div>
              <button
                onClick={closePin}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {pinSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">PIN set successfully!</p>
                <p className="text-xs text-slate-500">Share <span className="font-bold text-slate-700">{pinValue}</span> with {pinMember.name}.</p>
                <button className="btn-secondary w-full" onClick={closePin}>Done</button>
              </div>
            ) : (
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="form-label" htmlFor="pin-input">4-Digit PIN *</label>
                  <input
                    id="pin-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    className="form-input tracking-[0.5em] text-center text-xl font-bold"
                    placeholder="0000"
                    value={pinValue}
                    onChange={e => { setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1">Enter any 4-digit number to assign to this member.</p>
                </div>
                {pinError && <p className="text-sm text-red-600">{pinError}</p>}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    id="save-pin-btn"
                    className="btn-primary flex-1"
                    disabled={pinSaving || pinValue.length < 4}
                  >
                    {pinSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : 'Save PIN'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={closePin} disabled={pinSaving}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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

    </div>
  );
}
