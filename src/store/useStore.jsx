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
    members:    [],
    deposits:   [],
    loans:      [],
    repayments: [],
    loading:    true,
    error:      null,
  });

  // ── Load all tables ─────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [m, d, l, r] = await Promise.all([
        supabase.from('members').select('*').order('name', { ascending: true }),
        supabase.from('deposits').select('*').order('date', { ascending: false }),
        supabase.from('loans').select('*').order('date', { ascending: false }),
        supabase.from('repayments').select('*').order('date', { ascending: false }),
      ]);

      if (m.error) throw new Error(`Members: ${m.error.message}`);
      if (d.error) throw new Error(`Deposits: ${d.error.message}`);
      if (l.error) throw new Error(`Loans: ${l.error.message}`);
      if (r.error) throw new Error(`Repayments: ${r.error.message}`);

      setState({
        members:    m.data.map(normalise),
        deposits:   d.data.map(normalise),
        loans:      l.data.map(normalise),
        repayments: r.data.map(normalise),
        loading:    false,
        error:      null,
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const actions = {

    addMember: async ({ name, phone, joined_date }) => {
      const { error } = await supabase.from('members').insert([{
        id: generateId('M'),
        name, phone, joined_date, status: 'active',
      }]);
      if (error) throw new Error(error.message);
      await loadAll();
    },

    updateMember: async (id, data) => {
      const { error } = await supabase.from('members').update(data).eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    },

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

    addLoan: async ({ member_id, amount, date, reason }) => {
      // Generate sequential loan ID from current count in DB
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

    addRepayment: async ({ loan_id, member_id, amount, date, note }) => {
      const numAmount = Number(amount);

      // 1. Insert repayment
      const { error: rErr } = await supabase.from('repayments').insert([{
        id: generateId('R'),
        loan_id, member_id,
        amount: numAmount,
        date,
        note: note || null,
      }]);
      if (rErr) throw new Error(rErr.message);

      // 2. Re-fetch loan + all its repayments to compute new status
      const { data: loan, error: lErr } = await supabase
        .from('loans').select('amount').eq('id', loan_id).single();
      if (lErr) throw new Error(lErr.message);

      const { data: allRep, error: allErr } = await supabase
        .from('repayments').select('amount').eq('loan_id', loan_id);
      if (allErr) throw new Error(allErr.message);

      const totalRepaid = allRep.reduce((s, r) => s + Number(r.amount), 0);
      const loanAmt = Number(loan.amount);
      const newStatus = totalRepaid >= loanAmt
        ? 'cleared'
        : totalRepaid > 0 ? 'partially_repaid' : 'active';

      const { error: uErr } = await supabase
        .from('loans').update({ status: newStatus }).eq('id', loan_id);
      if (uErr) throw new Error(uErr.message);

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
