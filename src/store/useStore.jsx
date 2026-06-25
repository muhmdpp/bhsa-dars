import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateId } from '../utils/formatters';

// ── Wipe old localStorage data on first load ────────────────────────────────
localStorage.removeItem('bhsa_finance_data');

// ── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(null);

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

  // ── Load all tables ─────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [m, d, l, r, w] = await Promise.all([
        supabase.from('members').select('*').order('name', { ascending: true }),
        supabase.from('deposits').select('*').neq('deleted', true).order('date', { ascending: false }),
        supabase.from('loans').select('*').neq('deleted', true).order('date', { ascending: false }),
        supabase.from('repayments').select('*').neq('deleted', true).order('date', { ascending: false }),
        supabase.from('withdrawals').select('*').neq('deleted', true).order('date', { ascending: false }),
      ]);

      if (m.error) throw new Error(`Members: ${m.error.message}`);
      if (d.error) throw new Error(`Deposits: ${d.error.message}`);
      if (l.error) throw new Error(`Loans: ${l.error.message}`);
      if (r.error) throw new Error(`Repayments: ${r.error.message}`);
      if (w.error) throw new Error(`Withdrawals: ${w.error.message}`);

      setState({
        members:     m.data.map(normalise),
        deposits:    d.data.map(normalise),
        loans:       l.data.map(normalise),
        repayments:  r.data.map(normalise),
        withdrawals: w.data.map(normalise),
        loading:     false,
        error:       null,
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions = {

    // ── Members ──────────────────────────────────────────────────────────
    addMember: async ({ name, phone, joined_date, batch }) => {
      const { error } = await supabase.from('members').insert([{
        id: generateId('M'),
        name, phone, joined_date, status: 'active',
        batch: batch ? Number(batch) : null,
      }]);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    updateMember: async (id, data) => {
      const { error } = await supabase.from('members').update(data).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    // Hard-delete a member and every record tied to them
    deleteMemberPermanently: async (id) => {
      const { error: e1 } = await supabase.from('withdrawals').delete().eq('member_id', id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from('repayments').delete().eq('member_id', id);
      if (e2) throw new Error(e2.message);
      const { error: e3 } = await supabase.from('deposits').delete().eq('member_id', id);
      if (e3) throw new Error(e3.message);
      const { error: e4 } = await supabase.from('loans').delete().eq('member_id', id);
      if (e4) throw new Error(e4.message);
      const { error: e5 } = await supabase.from('members').delete().eq('id', id);
      if (e5) throw new Error(e5.message);
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
      if (error) throw new Error(error.message);
      await loadAll();
    },

    updateDeposit: async (id, data, reason) => {
      const { error } = await supabase.from('deposits').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    deleteDeposit: async (id, reason) => {
      const { error } = await supabase.from('deposits').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
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
      if (error) throw new Error(error.message);
      await loadAll();
    },

    // ── Loans ─────────────────────────────────────────────────────────────
    addLoan: async ({ member_id, amount, date, reason }) => {
      const { count } = await supabase
        .from('loans')
        .select('*', { count: 'exact', head: true });
      const loanId = `LOAN-${String((count ?? 0) + 1).padStart(4, '0')}`;

      const { error } = await supabase.from('loans').insert([{
        id: loanId,
        member_id,
        amount: Number(amount),
        date,
        reason: reason || null,
        status: 'active',
      }]);
      if (error) throw new Error(error.message);
      await loadAll();
      return loanId;
    },

    updateLoan: async (id, data, reason) => {
      const { error } = await supabase.from('loans').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    deleteLoan: async (id, reason) => {
      const { error } = await supabase.from('loans').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    // ── Repayments ────────────────────────────────────────────────────────
    addRepayment: async ({ loan_id, member_id, amount, date, note }) => {
      const numAmount = Number(amount);

      // Fetch current loan + existing repayments to check remaining balance
      const { data: loan, error: lFetchErr } = await supabase
        .from('loans').select('amount').eq('id', loan_id).single();
      if (lFetchErr) throw new Error(lFetchErr.message);

      const { data: existingRep, error: rFetchErr } = await supabase
        .from('repayments').select('amount').eq('loan_id', loan_id).neq('deleted', true);
      if (rFetchErr) throw new Error(rFetchErr.message);

      const alreadyRepaid = existingRep.reduce((s, r) => s + Number(r.amount), 0);
      const remaining     = Number(loan.amount) - alreadyRepaid;

      if (remaining <= 0) {
        throw new Error('This loan is already fully repaid. No further payment is allowed.');
      }
      if (numAmount > remaining) {
        throw new Error(`Amount exceeds remaining balance of ₹${remaining.toLocaleString('en-IN')}. Enter ₹${remaining.toLocaleString('en-IN')} or less.`);
      }

      const { error: rErr } = await supabase.from('repayments').insert([{
        id: generateId('R'),
        loan_id, member_id,
        amount: numAmount,
        date,
        note: note || null,
      }]);
      if (rErr) throw new Error(rErr.message);

      const { data: allRep, error: allErr } = await supabase
        .from('repayments').select('amount').eq('loan_id', loan_id).neq('deleted', true);
      if (allErr) throw new Error(allErr.message);

      const totalRepaid = allRep.reduce((s, r) => s + Number(r.amount), 0);
      const loanAmt     = Number(loan.amount);
      const newStatus   = totalRepaid >= loanAmt
        ? 'cleared'
        : totalRepaid > 0 ? 'partially_repaid' : 'active';

      const { error: uErr } = await supabase
        .from('loans').update({ status: newStatus }).eq('id', loan_id);
      if (uErr) throw new Error(uErr.message);

      await loadAll();
    },

    updateRepayment: async (id, data, reason) => {
      const { error } = await supabase.from('repayments').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    deleteRepayment: async (id, reason) => {
      const { error } = await supabase.from('repayments').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    // ── Withdrawals ───────────────────────────────────────────────────────
    addWithdrawal: async ({ member_id, amount, date, note }) => {
      const { error } = await supabase.from('withdrawals').insert([{
        id: generateId('W'),
        member_id,
        amount: Number(amount),
        date,
        note: note || null,
      }]);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    updateWithdrawal: async (id, data, reason) => {
      const { error } = await supabase.from('withdrawals').update({
        ...data,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    deleteWithdrawal: async (id, reason) => {
      const { error } = await supabase.from('withdrawals').update({
        deleted:     true,
        edit_reason: reason,
        edited_at:   new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    // ── Member PIN ────────────────────────────────────────────────────────
    setMemberPin: async (memberId, pin) => {
      const { error } = await supabase
        .from('members')
        .update({ pin })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
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
