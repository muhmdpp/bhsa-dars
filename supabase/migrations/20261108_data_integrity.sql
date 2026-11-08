-- ============================================================================
-- DHSA data-integrity migration  (2026-11-08)
--
-- SAFE FOR EXISTING DATA: this script does not UPDATE or DELETE any row.
-- It only adds defaults, constraints that apply to new/changed rows, a loan-ID
-- sequence, and database functions the app calls to save money records.
--
-- Every money function runs in one transaction and takes a single lock, so two
-- admins saving at the same moment are handled one after the other and a
-- half-finished save is rolled back automatically.
--
-- How to run: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- It can be run again safely.
-- ============================================================================

begin;

-- ── 1. New rows default to "not deleted" ────────────────────────────────────
alter table deposits    alter column deleted set default false;
alter table loans       alter column deleted set default false;
alter table repayments  alter column deleted set default false;
alter table withdrawals alter column deleted set default false;

-- ── 2. Amounts must be positive (checked for new/changed rows only) ─────────
do $$
declare t text;
begin
  foreach t in array array['deposits','loans','repayments','withdrawals'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_amount_positive') then
      execute format('alter table %I add constraint %I check (amount > 0) not valid',
                     t, t || '_amount_positive');
    end if;
  end loop;
end $$;

-- ── 3. Loan numbers come from a sequence (never reused, safe under concurrency)
create sequence if not exists dhsa_loan_number_seq;
select setval(
  'dhsa_loan_number_seq',
  greatest(
    coalesce((select max(substring(id from '^LOAN-(\d+)$')::int) from loans), 0) + 1,
    (select last_value from dhsa_loan_number_seq) + case
      when (select is_called from dhsa_loan_number_seq) then 1 else 0 end
  ),
  false
);

-- ── 4. Internal helpers ─────────────────────────────────────────────────────

-- One lock for every money operation (the app is low-traffic; this keeps it simple
-- and makes every check-then-write race-free)
create or replace function dhsa_lock() returns void
language sql as $$ select pg_advisory_xact_lock(hashtext('dhsa_money')) $$;

create or replace function dhsa_inr(n numeric) returns text
language sql immutable as $$
  select '₹' || trim(trailing '.' from to_char(n, 'FM999,999,999,990.99'))
$$;

-- Member deposit balance (deposits − withdrawals), optionally ignoring one row of each
create or replace function dhsa_member_balance(
  p_member_id text, p_excl_deposit text default null, p_excl_withdrawal text default null
) returns numeric language sql stable as $$
  select
    coalesce((select sum(amount) from deposits
              where member_id = p_member_id and deleted is not true
                and id is distinct from p_excl_deposit), 0)
  - coalesce((select sum(amount) from withdrawals
              where member_id = p_member_id and deleted is not true
                and id is distinct from p_excl_withdrawal), 0)
$$;

-- Live repayments on a loan, optionally ignoring one repayment
create or replace function dhsa_loan_repaid(p_loan_id text, p_excl_repayment text default null)
returns numeric language sql stable as $$
  select coalesce(sum(amount), 0) from repayments
  where loan_id = p_loan_id and deleted is not true
    and id is distinct from p_excl_repayment
$$;

-- Pool = deposits − loans + repayments (on live loans only) − withdrawals
create or replace function dhsa_pool_balance() returns numeric language sql stable as $$
  select
    coalesce((select sum(amount) from deposits    where deleted is not true), 0)
  - coalesce((select sum(amount) from loans       where deleted is not true), 0)
  + coalesce((select sum(r.amount) from repayments r
              join loans l on l.id = r.loan_id and l.deleted is not true
              where r.deleted is not true), 0)
  - coalesce((select sum(amount) from withdrawals where deleted is not true), 0)
$$;

create or replace function dhsa_sync_loan_status(p_loan_id text) returns void
language plpgsql as $$
declare v_amount numeric; v_repaid numeric;
begin
  select amount into v_amount from loans where id = p_loan_id;
  v_repaid := dhsa_loan_repaid(p_loan_id);
  update loans set status = case
      when v_repaid >= v_amount then 'cleared'
      when v_repaid > 0         then 'partially_repaid'
      else 'active' end
  where id = p_loan_id;
end $$;

-- Blocks a change only if it leaves a member's balance negative AND worse than
-- now, so records that are already off never lock anyone out
create or replace function dhsa_check_balance(p_before numeric, p_after numeric, p_what text)
returns void language plpgsql as $$
begin
  if p_after < 0 and p_after < p_before then
    raise exception '% would leave this member''s deposit balance at %. Their withdrawals would exceed their deposits.',
      p_what, dhsa_inr(p_after);
  end if;
end $$;

create or replace function dhsa_check_amount(p_amount numeric) returns void
language plpgsql as $$
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;
end $$;

-- ── 5. Deposits ─────────────────────────────────────────────────────────────

create or replace function dhsa_update_deposit(
  p_id text, p_member_id text, p_amount numeric, p_date date, p_note text, p_reason text
) returns void language plpgsql as $$
declare o deposits%rowtype; v_before numeric; v_after numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into o from deposits where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Deposit % not found.', p_id; end if;

  -- The original member loses this deposit (fully, or partly if only the amount drops)
  v_before := dhsa_member_balance(o.member_id);
  v_after  := v_before - o.amount + case when p_member_id = o.member_id then p_amount else 0 end;
  perform dhsa_check_balance(v_before, v_after, 'This edit');

  update deposits set member_id = p_member_id, amount = p_amount, date = p_date,
    note = p_note, edit_reason = p_reason, edited_at = now()
  where id = p_id;
end $$;

create or replace function dhsa_delete_deposit(p_id text, p_reason text)
returns void language plpgsql as $$
declare o deposits%rowtype; v_before numeric;
begin
  perform dhsa_lock();
  select * into o from deposits where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Deposit % not found.', p_id; end if;
  v_before := dhsa_member_balance(o.member_id);
  perform dhsa_check_balance(v_before, v_before - o.amount, 'Deleting this deposit');
  update deposits set deleted = true, edit_reason = p_reason, edited_at = now() where id = p_id;
end $$;

-- ── 6. Withdrawals ──────────────────────────────────────────────────────────

create or replace function dhsa_add_withdrawal(
  p_id text, p_member_id text, p_amount numeric, p_date date, p_note text
) returns void language plpgsql as $$
declare v_balance numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  v_balance := dhsa_member_balance(p_member_id);
  if p_amount > v_balance then
    raise exception 'Insufficient balance. This member has only % available.', dhsa_inr(greatest(v_balance, 0));
  end if;
  insert into withdrawals (id, member_id, amount, date, note)
  values (p_id, p_member_id, p_amount, p_date, p_note);
end $$;

create or replace function dhsa_update_withdrawal(
  p_id text, p_member_id text, p_amount numeric, p_date date, p_note text, p_reason text
) returns void language plpgsql as $$
declare o withdrawals%rowtype; v_before numeric; v_after numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into o from withdrawals where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Withdrawal % not found.', p_id; end if;

  -- Balance of whoever ends up owning this withdrawal
  v_before := dhsa_member_balance(p_member_id);
  v_after  := dhsa_member_balance(p_member_id, null, p_id) - p_amount;
  perform dhsa_check_balance(v_before, v_after, 'This edit');

  update withdrawals set member_id = p_member_id, amount = p_amount, date = p_date,
    note = p_note, edit_reason = p_reason, edited_at = now()
  where id = p_id;
end $$;

-- ── 7. Loans ────────────────────────────────────────────────────────────────

create or replace function dhsa_add_loan(
  p_member_id text, p_amount numeric, p_date date, p_reason text
) returns text language plpgsql as $$
declare v_pool numeric; v_id text;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  v_pool := dhsa_pool_balance();
  if p_amount > v_pool then
    raise exception 'Loan amount exceeds the available pool balance of %.', dhsa_inr(v_pool);
  end if;
  loop
    v_id := 'LOAN-' || lpad(nextval('dhsa_loan_number_seq')::text, 4, '0');
    exit when not exists (select 1 from loans where id = v_id);
  end loop;
  insert into loans (id, member_id, amount, date, reason, status)
  values (v_id, p_member_id, p_amount, p_date, p_reason, 'active');
  return v_id;
end $$;

create or replace function dhsa_update_loan(
  p_id text, p_member_id text, p_amount numeric, p_date date, p_loan_reason text, p_edit_reason text
) returns void language plpgsql as $$
declare o loans%rowtype; v_repaid numeric; v_pool numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into o from loans where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Loan % not found.', p_id; end if;

  v_repaid := dhsa_loan_repaid(p_id);
  if p_amount < v_repaid then
    raise exception 'Loan amount can''t be less than the % already repaid.', dhsa_inr(v_repaid);
  end if;
  if p_amount > o.amount then
    v_pool := dhsa_pool_balance();
    if p_amount - o.amount > v_pool then
      raise exception 'Increasing this loan exceeds the available pool balance of %.', dhsa_inr(v_pool);
    end if;
  end if;

  update loans set member_id = p_member_id, amount = p_amount, date = p_date,
    reason = p_loan_reason, edit_reason = p_edit_reason, edited_at = now()
  where id = p_id;

  -- Moving a loan to another member moves its repayments with it
  if p_member_id is distinct from o.member_id then
    update repayments set member_id = p_member_id where loan_id = p_id;
  end if;

  perform dhsa_sync_loan_status(p_id);
end $$;

create or replace function dhsa_delete_loan(p_id text, p_reason text)
returns void language plpgsql as $$
declare v_repaid numeric;
begin
  perform dhsa_lock();
  if not exists (select 1 from loans where id = p_id and deleted is not true) then
    raise exception 'Loan % not found.', p_id;
  end if;
  v_repaid := dhsa_loan_repaid(p_id);
  if v_repaid > 0 then
    raise exception 'This loan has % in repayments. Delete those repayments first, otherwise they would still be counted in the pool balance.',
      dhsa_inr(v_repaid);
  end if;
  update loans set deleted = true, edit_reason = p_reason, edited_at = now() where id = p_id;
end $$;

-- ── 8. Repayments ───────────────────────────────────────────────────────────

create or replace function dhsa_add_repayment(
  p_id text, p_loan_id text, p_amount numeric, p_date date, p_note text
) returns void language plpgsql as $$
declare l loans%rowtype; v_remaining numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into l from loans where id = p_loan_id for update;
  if not found or l.deleted is true then raise exception 'Loan % not found.', p_loan_id; end if;

  v_remaining := l.amount - dhsa_loan_repaid(p_loan_id);
  if v_remaining <= 0 then
    raise exception 'This loan is already fully repaid. No further payment is allowed.';
  end if;
  if p_amount > v_remaining then
    raise exception 'Amount exceeds remaining balance of %. Enter % or less.',
      dhsa_inr(v_remaining), dhsa_inr(v_remaining);
  end if;

  insert into repayments (id, loan_id, member_id, amount, date, note)
  values (p_id, p_loan_id, l.member_id, p_amount, p_date, p_note);
  perform dhsa_sync_loan_status(p_loan_id);
end $$;

create or replace function dhsa_update_repayment(
  p_id text, p_amount numeric, p_date date, p_note text, p_reason text
) returns void language plpgsql as $$
declare o repayments%rowtype; l loans%rowtype; v_remaining numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into o from repayments where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Repayment % not found.', p_id; end if;
  select * into l from loans where id = o.loan_id;
  if not found or l.deleted is true then raise exception 'Loan % has been deleted.', o.loan_id; end if;

  v_remaining := l.amount - dhsa_loan_repaid(o.loan_id, p_id);
  if p_amount > v_remaining then
    raise exception 'Amount exceeds what is left on loan % (%).', l.id, dhsa_inr(v_remaining);
  end if;

  -- A repayment always belongs to its loan's borrower
  update repayments set amount = p_amount, date = p_date, note = p_note,
    member_id = l.member_id, edit_reason = p_reason, edited_at = now()
  where id = p_id;
  perform dhsa_sync_loan_status(o.loan_id);
end $$;

create or replace function dhsa_delete_repayment(p_id text, p_reason text)
returns void language plpgsql as $$
declare v_loan text;
begin
  perform dhsa_lock();
  select loan_id into v_loan from repayments where id = p_id and deleted is not true for update;
  if not found then raise exception 'Repayment % not found.', p_id; end if;
  update repayments set deleted = true, edit_reason = p_reason, edited_at = now() where id = p_id;
  perform dhsa_sync_loan_status(v_loan);
end $$;

-- ── 9. Permanent member delete (all-or-nothing) ─────────────────────────────

create or replace function dhsa_delete_member(p_id text)
returns void language plpgsql as $$
begin
  perform dhsa_lock();
  delete from withdrawals where member_id = p_id;
  delete from repayments  where member_id = p_id;
  delete from deposits    where member_id = p_id;
  delete from loans       where member_id = p_id;
  delete from members     where id = p_id;
end $$;

-- ── 10. Let the app call the functions ──────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'dhsa\_%' loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon', r.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage, select on sequence dhsa_loan_number_seq to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage, select on sequence dhsa_loan_number_seq to authenticated;
  end if;
end $$;

commit;

-- Ask Supabase's API to pick up the new functions straight away
notify pgrst, 'reload schema';
