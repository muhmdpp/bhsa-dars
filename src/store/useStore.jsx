import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, fetchAllRows, notDeleted } from '../lib/supabase';
import { generateId, generateLoanId } from '../utils/formatters';
import { getPoolBalance } from '../utils/calculations';

// ── Wipe old localStorage data on first load ────────────────────────────────
localStorage.removeItem('bhsa_finance_data');

// ── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(null);

// ── Small helpers (all reads go to the DB so checks use fresh data) ──────────
const inr = n => `₹${Number(n).toLocaleString('en-IN')}`;
const sum = rows => (rows || []).reduce((s, r) => s + Number(r.amount), 0);

function check(error) {
  if (error) throw new Error(error.message);
}

// ── Database functions (supabase/migrations/20261108_data_integrity.sql) ─────
// When the migration has been run, money operations go through these functions:
// each one checks and saves inside a single locked transaction. Until then the
// app falls back to the checks below, so it keeps working either way.
let rpcAvailable = true;
async function tryRpc(fn, args) {
  if (!rpcAvailable) return { used: false };
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return { used: true, data };
  if (error.code === 'PGRST202' || error.code === '42883') { // function not installed
    rpcAvailable = false;
    return { used: false };
  }
  throw new Error(error.message);
}

async function fetchLoan(loanId) {
  const { data, error } = await supabase
    .from('loans').select('id, member_id, amount, deleted').eq('id', loanId).single();
  check(error);
  if (data.deleted) throw new Error(`Loan ${loanId} has been deleted.`);
  return data;
}

// Live repayments for a loan, optionally ignoring one repayment (the one being edited)
async function fetchLoanRepaid(loanId, excludeRepaymentId = null) {
  let q = notDeleted(supabase.from('repayments').select('id, amount').eq('loan_id', loanId));
  if (excludeRepaymentId) q = q.neq('id', excludeRepaymentId);
  const { data, error } = await q;
  check(error);
  return sum(data);
}

// Member's deposit balance (deposits − withdrawals), optionally ignoring one row of each
async function fetchMemberBalance(memberId, { excludeDepositId, excludeWithdrawalId } = {}) {
  let dq = notDeleted(supabase.from('deposits').select('id, amount').eq('member_id', memberId));
  let wq = notDeleted(supabase.from('withdrawals').select('id, amount').eq('member_id', memberId));
  if (excludeDepositId)    dq = dq.neq('id', excludeDepositId);
  if (excludeWithdrawalId) wq = wq.neq('id', excludeWithdrawalId);
  const [{ data: d, error: de }, { data: w, error: we }] = await Promise.all([dq, wq]);
  check(de); check(we);
  return sum(d) - sum(w);
}

// Blocks a change only if it leaves the balance negative AND makes it worse than
// it is now — so existing records that are already off never lock anyone out.
function assertBalanceOk(before, after, what) {
  if (after < 0 && after < before) {
    throw new Error(
      `${what} would leave this member's deposit balance at ${inr(after)}. ` +
      `Their withdrawals would exceed their deposits.`
    );
  }
}

// Recompute and store a loan's status from its live repayments
async function syncLoanStatus(loanId) {
  const { data: loan, error } = await supabase
    .from('loans').select('amount').eq('id', loanId).single();
  check(error);
  const repaid = await fetchLoanRepaid(loanId);
  const status = repaid >= Number(loan.amount) ? 'cleared'
    : repaid > 0 ? 'partially_repaid' : 'active';
  const { error: uErr } = await supabase.from('loans').update({ status }).eq('id', loanId);
  check(uErr);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function StoreProvider({ children }) {
  const [state, setState] = useState({
    members:     [],
    deposits:    [],
    loans:       [],
    repayments:  [],
    withdrawals: [],
    loading:     true,
    error:       null,
  });

  // Only the latest loadAll call may write state (older ones finishing late are dropped)
  const loadSeq = useRef(0);

  // ── Load all tables ─────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [m, d, l, r, w] = await Promise.all([
        fetchAllRows('members', q => q.order('name', { ascending: true })),
        fetchAllRows('deposits', q => notDeleted(q).order('date', { ascending: false })),
        fetchAllRows('loans', q => notDeleted(q).order('date', { ascending: false })),
        fetchAllRows('repayments', q => notDeleted(q).order('date', { ascending: false })),
        fetchAllRows('withdrawals', q => notDeleted(q).order('date', { ascending: false })),
      ]);
      if (seq !== loadSeq.current) return;

      // Repayments whose loan was deleted no longer count (they'd inflate the pool).
      // They stay untouched in the database.
      const liveLoanIds = new Set(l.map(x => x.id));

      setState({
        members:     m.map(normalise),
        deposits:    d.map(normalise),
        loans:       l.map(normalise),
        repayments:  r.filter(x => liveLoanIds.has(x.loan_id)).map(normalise),
        withdrawals: w.map(normalise),
        loading:     false,
        error:       null,
      });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions = {

    // ── Members ──────────────────────────────────────────────────────────
    addMember: async ({ name, phone, joined_date, batch }) => {
      const { data: dup, error: dErr } = await supabase
        .from('members').select('id, name').eq('phone', phone).limit(1);
      check(dErr);
      if (dup?.length) throw new Error(`Phone ${phone} is already used by ${dup[0].name}.`);

      const { error } = await supabase.from('members').insert([{
        id: generateId('M'),
        name, phone, joined_date, status: 'active',
        batch: batch ? Number(batch) : null,
      }]);
      check(error);
      await loadAll();
    },

    updateMember: async (id, data) => {
      // Only check when the phone actually changes, so members who already share a
      // number can still be edited
      const current = state.members.find(m => m.id === id);
      if (data.phone && data.phone !== current?.phone) {
        const { data: dup, error: dErr } = await supabase
          .from('members').select('id, name').eq('phone', data.phone).neq('id', id).limit(1);
        check(dErr);
        if (dup?.length) throw new Error(`Phone ${data.phone} is already used by ${dup[0].name}.`);
      }
      const { error } = await supabase.from('members').update(data).eq('id', id);
      check(error);
      await loadAll();
    },

    // Hard-delete a member and every record tied to them
    deleteMemberPermanently: async (id) => {
      if ((await tryRpc('dhsa_delete_member', { p_id: id })).used) { await loadAll(); return; }
      const { error: e1 } = await supabase.from('withdrawals').delete().eq('member_id', id);
      check(e1);
      const { error: e2 } = await supabase.from('repayments').delete().eq('member_id', id);
      check(e2);
      const { error: e3 } = await supabase.from('deposits').delete().eq('member_id', id);
      check(e3);
      const { error: e4 } = await supabase.from('loans').delete().eq('member_id', id);
      check(e4);
      const { error: e5 } = await supabase.from('members').delete().eq('id', id);
      check(e5);
      await loadAll();
    },

    // ── Deposits ─────────────────────────────────────────────────────────
    addDeposit: async ({ member_id, amount, date, note }) => {
      const { error } = await supabase.from('deposits').insert([{
        id: generateId('D'),
        member_id,
        amount: Number(amount),
        date,
        note: note || null,
      }]);
      check(error);
      await loadAll();
    },

    updateDeposit: async (id, data, reason) => {
      const cur = { ...state.deposits.find(x => x.id === id), ...data };
      if ((await tryRpc('dhsa_update_deposit', {
        p_id: id, p_member_id: cur.member_id, p_amount: Number(cur.amount),
        p_date: cur.date, p_note: cur.note || null, p_reason: reason,
      })).used) { await loadAll(); return; }
      const { data: old, error: oErr } = await supabase
        .from('deposits').select('member_id, amount').eq('id', id).single();
      check(oErr);

      const newAmount = Number(data.amount ?? old.amount);
      const newMember = data.member_id ?? old.member_id;

      // The original member loses this deposit (fully, or partly if only the amount drops)
      const oldBefore = await fetchMemberBalance(old.member_id);
      const oldAfter  = oldBefore - Number(old.amount) + (newMember === old.member_id ? newAmount : 0);
      assertBalanceOk(oldBefore, oldAfter, 'This edit');

      const { error } = await supabase.from('deposits').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);
      await loadAll();
    },

    deleteDeposit: async (id, reason) => {
      if ((await tryRpc('dhsa_delete_deposit', { p_id: id, p_reason: reason })).used) { await loadAll(); return; }
      const { data: old, error: oErr } = await supabase
        .from('deposits').select('member_id, amount').eq('id', id).single();
      check(oErr);
      const before = await fetchMemberBalance(old.member_id);
      assertBalanceOk(before, before - Number(old.amount), 'Deleting this deposit');

      const { error } = await supabase.from('deposits').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);
      await loadAll();
    },

    // ── Broadcast Deposit (FinWave) ───────────────────────────────────────
    broadcastDeposit: async ({ member_ids, amount, date, note }) => {
      const rows = member_ids.map(member_id => ({
        id: generateId('D'),
        member_id,
        amount: Number(amount),
        date,
        note: note || null,
      }));
      const { error } = await supabase.from('deposits').insert(rows);
      check(error);
      await loadAll();
    },

    // ── Loans ─────────────────────────────────────────────────────────────
    addLoan: async ({ member_id, amount, date, reason }) => {
      const numAmount = Number(amount);
      const viaDb = await tryRpc('dhsa_add_loan', {
        p_member_id: member_id, p_amount: numAmount, p_date: date, p_reason: reason || null,
      });
      if (viaDb.used) { await loadAll(); return viaDb.data; }

      const pool = getPoolBalance(state);
      if (numAmount > pool) {
        throw new Error(`Loan amount exceeds the available pool balance of ${inr(pool)}.`);
      }

      // IDs come from the highest existing number (deleted rows included), and we
      // retry if another admin grabbed the same number at the same moment.
      for (let attempt = 0; attempt < 5; attempt++) {
        const allIds = await fetchAllRows('loans', q => q, 1000, 'id');
        const loanId = generateLoanId(allIds);

        const { error } = await supabase.from('loans').insert([{
          id: loanId,
          member_id,
          amount: numAmount,
          date,
          reason: reason || null,
          status: 'active',
        }]);
        if (!error) {
          await loadAll();
          return loanId;
        }
        if (error.code !== '23505') throw new Error(error.message); // not a duplicate-key clash
      }
      throw new Error('Could not allocate a loan ID. Please try again.');
    },

    updateLoan: async (id, data, reason) => {
      const cur = { ...state.loans.find(x => x.id === id), ...data };
      if ((await tryRpc('dhsa_update_loan', {
        p_id: id, p_member_id: cur.member_id, p_amount: Number(cur.amount),
        p_date: cur.date, p_loan_reason: cur.reason || null, p_edit_reason: reason,
      })).used) { await loadAll(); return; }
      const loan   = await fetchLoan(id);
      const repaid = await fetchLoanRepaid(id);

      if (data.amount !== undefined && Number(data.amount) < repaid) {
        throw new Error(`Loan amount can't be less than the ${inr(repaid)} already repaid.`);
      }

      const { error } = await supabase.from('loans').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);

      // Moving a loan to another member moves its repayments with it
      if (data.member_id && data.member_id !== loan.member_id) {
        const { error: rErr } = await supabase
          .from('repayments').update({ member_id: data.member_id }).eq('loan_id', id);
        check(rErr);
      }

      await syncLoanStatus(id);
      await loadAll();
    },

    deleteLoan: async (id, reason) => {
      if ((await tryRpc('dhsa_delete_loan', { p_id: id, p_reason: reason })).used) { await loadAll(); return; }
      const repaid = await fetchLoanRepaid(id);
      if (repaid > 0) {
        throw new Error(
          `This loan has ${inr(repaid)} in repayments. Delete those repayments first, ` +
          `otherwise they would still be counted in the pool balance.`
        );
      }
      const { error } = await supabase.from('loans').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);
      await loadAll();
    },

    // ── Repayments ────────────────────────────────────────────────────────
    addRepayment: async ({ loan_id, amount, date, note }) => {
      const numAmount = Number(amount);
      const repaymentId = generateId('R');
      if ((await tryRpc('dhsa_add_repayment', {
        p_id: repaymentId, p_loan_id: loan_id, p_amount: numAmount, p_date: date, p_note: note || null,
      })).used) { await loadAll(); return; }

      const loan      = await fetchLoan(loan_id);
      const remaining = Number(loan.amount) - await fetchLoanRepaid(loan_id);

      if (remaining <= 0) {
        throw new Error('This loan is already fully repaid. No further payment is allowed.');
      }
      if (numAmount > remaining) {
        throw new Error(`Amount exceeds remaining balance of ${inr(remaining)}. Enter ${inr(remaining)} or less.`);
      }

      const { error: rErr } = await supabase.from('repayments').insert([{
        id: repaymentId,
        loan_id,
        member_id: loan.member_id, // always the loan's borrower
        amount: numAmount,
        date,
        note: note || null,
      }]);
      check(rErr);

      await syncLoanStatus(loan_id);
      await loadAll();
    },

    updateRepayment: async (id, data, reason) => {
      const cur = { ...state.repayments.find(x => x.id === id), ...data };
      if ((await tryRpc('dhsa_update_repayment', {
        p_id: id, p_amount: Number(cur.amount), p_date: cur.date,
        p_note: cur.note || null, p_reason: reason,
      })).used) { await loadAll(); return; }
      const { data: old, error: oErr } = await supabase
        .from('repayments').select('loan_id, amount').eq('id', id).single();
      check(oErr);
      const loan = await fetchLoan(old.loan_id);

      if (data.amount !== undefined) {
        const others    = await fetchLoanRepaid(old.loan_id, id);
        const remaining = Number(loan.amount) - others;
        if (Number(data.amount) > remaining) {
          throw new Error(`Amount exceeds what is left on loan ${loan.id} (${inr(remaining)}).`);
        }
      }

      // A repayment always belongs to its loan's borrower; loan_id can't be changed here
      const rest = { ...data };
      delete rest.loan_id;
      const { error } = await supabase.from('repayments').update({
        ...rest,
        member_id:   loan.member_id,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);

      await syncLoanStatus(old.loan_id);
      await loadAll();
    },

    deleteRepayment: async (id, reason) => {
      if ((await tryRpc('dhsa_delete_repayment', { p_id: id, p_reason: reason })).used) { await loadAll(); return; }
      const { data: old, error: oErr } = await supabase
        .from('repayments').select('loan_id').eq('id', id).single();
      check(oErr);

      const { error } = await supabase.from('repayments').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);

      await syncLoanStatus(old.loan_id);
      await loadAll();
    },

    // ── Withdrawals ───────────────────────────────────────────────────────
    addWithdrawal: async ({ member_id, amount, date, note }) => {
      const numAmount = Number(amount);
      const withdrawalId = generateId('W');
      if ((await tryRpc('dhsa_add_withdrawal', {
        p_id: withdrawalId, p_member_id: member_id, p_amount: numAmount, p_date: date, p_note: note || null,
      })).used) { await loadAll(); return; }

      const balance   = await fetchMemberBalance(member_id);
      if (numAmount > balance) {
        throw new Error(`Insufficient balance. This member has only ${inr(Math.max(0, balance))} available.`);
      }

      const { error } = await supabase.from('withdrawals').insert([{
        id: withdrawalId,
        member_id,
        amount: numAmount,
        date,
        note: note || null,
      }]);
      check(error);
      await loadAll();
    },

    updateWithdrawal: async (id, data, reason) => {
      const cur = { ...state.withdrawals.find(x => x.id === id), ...data };
      if ((await tryRpc('dhsa_update_withdrawal', {
        p_id: id, p_member_id: cur.member_id, p_amount: Number(cur.amount),
        p_date: cur.date, p_note: cur.note || null, p_reason: reason,
      })).used) { await loadAll(); return; }
      const { data: old, error: oErr } = await supabase
        .from('withdrawals').select('member_id, amount').eq('id', id).single();
      check(oErr);

      const newAmount = Number(data.amount ?? old.amount);
      const newMember = data.member_id ?? old.member_id;

      // Balance of whoever ends up owning this withdrawal
      const before = await fetchMemberBalance(newMember);
      const after  = await fetchMemberBalance(newMember, { excludeWithdrawalId: id }) - newAmount;
      assertBalanceOk(before, after, 'This edit');

      const { error } = await supabase.from('withdrawals').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);
      await loadAll();
    },

    deleteWithdrawal: async (id, reason) => {
      const { error } = await supabase.from('withdrawals').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      check(error);
      await loadAll();
    },

    // ── Member PIN ────────────────────────────────────────────────────────
    setMemberPin: async (memberId, pin) => {
      const { error } = await supabase
        .from('members')
        .update({ pin })
        .eq('id', memberId);
      check(error);
      await loadAll();
    },
  };

  return (
    <StoreContext.Provider value={{ state, actions }}>
      {children}
    </StoreContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ── Helper: normalise numeric fields from Supabase ────────────────────────────
function normalise(row) {
  const out = { ...row };
  if ('amount' in out) out.amount = Number(out.amount);
  return out;
}
