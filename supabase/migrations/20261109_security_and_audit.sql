-- ============================================================================
-- DHSA PIN-security + audit migration  (2026-11-09)
--
-- Run AFTER 20261108_data_integrity.sql.
--
-- SAFE FOR EXISTING DATA: no existing row is updated or deleted. This script
-- only adds tables, functions and permissions. Admin access is unchanged
-- (the app keeps using its existing login and key).
--
-- What it does
--   • Members log in through a server-side PIN check that returns a session
--     token; the member portal only returns that member's records.
--   • 5 wrong PINs in a row lock that member (or the admin PIN) for 15 minutes.
--   • Every insert/edit/delete on money tables is copied to dhsa_audit_log,
--     which cannot be edited or deleted through the app's key.
--   • Withdrawals and other changes may not push the pool below zero.
--   • A member can only be permanently deleted once their balance is zero and
--     they have no unpaid loan.
--
-- It can be run again safely.
-- ============================================================================

begin;

-- ── 0. Supabase helpers we rely on ──────────────────────────────────────────
-- auth.jwt() is provided by Supabase. gen_random_uuid() is built into Postgres.

-- ── 2. Audit log (append-only) ──────────────────────────────────────────────
create table if not exists dhsa_audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      text,
  table_name text not null,
  op         text not null,
  row_id     text,
  old_row    jsonb,
  new_row    jsonb
);
create index if not exists dhsa_audit_log_row_idx on dhsa_audit_log (table_name, row_id);

create or replace function dhsa_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb;
begin
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD) - 'pin'; end if;   -- never copy PINs
  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW) - 'pin'; end if;
  insert into dhsa_audit_log (actor, table_name, op, row_id, old_row, new_row)
  values (coalesce(auth.jwt() ->> 'email', current_user), TG_TABLE_NAME, TG_OP,
          coalesce(v_new ->> 'id', v_old ->> 'id'), v_old, v_new);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['members','deposits','loans','repayments','withdrawals','settings'] loop
    execute format('drop trigger if exists dhsa_audit_trg on %I', t);
    execute format('create trigger dhsa_audit_trg after insert or update or delete on %I
                    for each row execute function dhsa_audit()', t);
  end loop;
end $$;

-- ── 3. PIN lockout + member sessions ────────────────────────────────────────
create table if not exists dhsa_login_attempts (
  key          text primary key,
  failures     int not null default 0,
  locked_until timestamptz
);

create table if not exists dhsa_member_sessions (
  token      uuid primary key default gen_random_uuid(),
  member_id  text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

-- Returns an error message if this key is locked, else null
create or replace function dhsa_lockout_message(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select 'Too many wrong PINs. Please try again after '
         || to_char(locked_until at time zone 'Asia/Kolkata', 'HH12:MI AM') || '.'
  from dhsa_login_attempts where key = p_key and locked_until > now()
$$;

-- Records a wrong PIN; the 5th in a row locks the key for 15 minutes
create or replace function dhsa_record_failure(p_key text) returns void
language sql security definer set search_path = public as $$
  insert into dhsa_login_attempts (key, failures) values (p_key, 1)
  on conflict (key) do update set
    failures     = case when dhsa_login_attempts.locked_until <= now() then 1
                        else dhsa_login_attempts.failures + 1 end,
    locked_until = case when dhsa_login_attempts.locked_until <= now() then null
                        when dhsa_login_attempts.failures + 1 >= 5 then now() + interval '15 minutes'
                        else null end
$$;

-- Names for the member login list (no PINs, no phone numbers)
create or replace function dhsa_member_names() returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select id, name from members where status = 'active' order by name
$$;

-- Member login. Returns {token, member_id, name} or {error}. (Errors are returned,
-- not raised, so the failed-attempt counter is saved.)
create or replace function dhsa_member_login(p_member_id text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare m members%rowtype; v_key text := 'member:' || p_member_id; v_msg text; v_token uuid;
begin
  v_msg := dhsa_lockout_message(v_key);
  if v_msg is not null then return json_build_object('error', v_msg); end if;

  select * into m from members where id = p_member_id;
  if not found then return json_build_object('error', 'Member not found.'); end if;
  if m.pin is null or m.pin = '' then
    return json_build_object('error', 'No PIN set for this member. Please contact the admin.');
  end if;
  if m.pin is distinct from p_pin then
    perform dhsa_record_failure(v_key);
    v_msg := dhsa_lockout_message(v_key);
    return json_build_object('error', coalesce(v_msg, 'Incorrect PIN. Please try again.'));
  end if;

  delete from dhsa_login_attempts where key = v_key;
  delete from dhsa_member_sessions where expires_at < now();
  insert into dhsa_member_sessions (member_id) values (m.id) returning token into v_token;
  return json_build_object('token', v_token, 'member_id', m.id, 'name', m.name);
end $$;

create or replace function dhsa_member_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from dhsa_member_sessions where token = p_token
$$;

-- Everything the member portal shows, for the session's member only
create or replace function dhsa_member_portal(p_token uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_member text;
begin
  select member_id into v_member from dhsa_member_sessions
  where token = p_token and expires_at > now();
  if not found then raise exception 'Your session has expired. Please log in again.'; end if;

  return json_build_object(
    'member', (select json_build_object('id', id, 'name', name) from members where id = v_member),
    'deposits', coalesce((select json_agg(x order by x.date, x.id) from (
        select id, amount, date, note from deposits
        where member_id = v_member and deleted is not true) x), '[]'::json),
    'withdrawals', coalesce((select json_agg(x order by x.date, x.id) from (
        select id, amount, date, note from withdrawals
        where member_id = v_member and deleted is not true) x), '[]'::json),
    'loans', coalesce((select json_agg(x order by x.date, x.id) from (
        select id, amount, date, reason, status from loans
        where member_id = v_member and deleted is not true) x), '[]'::json),
    'repayments', coalesce((select json_agg(x order by x.date, x.id) from (
        select r.id, r.loan_id, r.amount, r.date, r.note from repayments r
        join loans l on l.id = r.loan_id and l.deleted is not true and l.member_id = v_member
        where r.deleted is not true) x), '[]'::json)
  );
end $$;

-- ── 4. Admin PIN (checked on the server, with lockout) ──────────────────────
create or replace function dhsa_verify_admin_pin(p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare v_key text; v_msg text; v_pin text;
begin
  v_key := 'admin';
  v_msg := dhsa_lockout_message(v_key);
  if v_msg is not null then return json_build_object('error', v_msg); end if;

  select pin into v_pin from settings where id = 'global';
  if v_pin is distinct from p_pin then
    perform dhsa_record_failure(v_key);
    return json_build_object('error', coalesce(dhsa_lockout_message(v_key), 'Incorrect PIN'));
  end if;
  delete from dhsa_login_attempts where key = v_key;
  return json_build_object('ok', true);
end $$;

create or replace function dhsa_change_admin_pin(p_current text, p_new text) returns json
language plpgsql security definer set search_path = public as $$
declare v json;
begin
  v := dhsa_verify_admin_pin(p_current);
  if v ->> 'error' is not null then return v; end if;
  if p_new !~ '^\d{4}$' then return json_build_object('error', 'PIN must be exactly 4 digits.'); end if;
  update settings set pin = p_new where id = 'global';
  return json_build_object('ok', true);
end $$;

-- ── 5. Pool may not go below zero ───────────────────────────────────────────
-- p_pool_change is how much the change adds to (+) or takes from (−) the pool.
create or replace function dhsa_check_pool(p_pool_change numeric) returns void
language plpgsql as $$
declare v_pool numeric := dhsa_pool_balance();
begin
  if p_pool_change < 0 and v_pool + p_pool_change < 0 then
    raise exception 'Not enough cash in the pool: only % is available right now (the rest is out on loan).',
      dhsa_inr(greatest(v_pool, 0));
  end if;
end $$;

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
  perform dhsa_check_pool(-p_amount);
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

  v_before := dhsa_member_balance(p_member_id);
  v_after  := dhsa_member_balance(p_member_id, null, p_id) - p_amount;
  perform dhsa_check_balance(v_before, v_after, 'This edit');
  perform dhsa_check_pool(o.amount - p_amount);

  update withdrawals set member_id = p_member_id, amount = p_amount, date = p_date,
    note = p_note, edit_reason = p_reason, edited_at = now()
  where id = p_id;
end $$;

create or replace function dhsa_update_deposit(
  p_id text, p_member_id text, p_amount numeric, p_date date, p_note text, p_reason text
) returns void language plpgsql as $$
declare o deposits%rowtype; v_before numeric; v_after numeric;
begin
  perform dhsa_lock();
  perform dhsa_check_amount(p_amount);
  select * into o from deposits where id = p_id for update;
  if not found or o.deleted is true then raise exception 'Deposit % not found.', p_id; end if;

  v_before := dhsa_member_balance(o.member_id);
  v_after  := v_before - o.amount + case when p_member_id = o.member_id then p_amount else 0 end;
  perform dhsa_check_balance(v_before, v_after, 'This edit');
  perform dhsa_check_pool(p_amount - o.amount);

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
  perform dhsa_check_pool(-o.amount);
  update deposits set deleted = true, edit_reason = p_reason, edited_at = now() where id = p_id;
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
  perform dhsa_check_pool(p_amount - o.amount);

  update repayments set amount = p_amount, date = p_date, note = p_note,
    member_id = l.member_id, edit_reason = p_reason, edited_at = now()
  where id = p_id;
  perform dhsa_sync_loan_status(o.loan_id);
end $$;

create or replace function dhsa_delete_repayment(p_id text, p_reason text)
returns void language plpgsql as $$
declare o repayments%rowtype;
begin
  perform dhsa_lock();
  select * into o from repayments where id = p_id and deleted is not true for update;
  if not found then raise exception 'Repayment % not found.', p_id; end if;
  perform dhsa_check_pool(-o.amount);
  update repayments set deleted = true, edit_reason = p_reason, edited_at = now() where id = p_id;
  perform dhsa_sync_loan_status(o.loan_id);
end $$;

-- ── 6. Permanent member delete only when nothing is owed either way ─────────
create or replace function dhsa_delete_member(p_id text)
returns void language plpgsql as $$
declare v_balance numeric; v_owed numeric;
begin
  perform dhsa_lock();
  v_balance := dhsa_member_balance(p_id);
  select coalesce(sum(greatest(l.amount - dhsa_loan_repaid(l.id), 0)), 0) into v_owed
  from loans l where l.member_id = p_id and l.deleted is not true;
  if v_balance <> 0 then
    raise exception 'This member still has a deposit balance of %. Settle it to zero before deleting.', dhsa_inr(v_balance);
  end if;
  if v_owed > 0 then
    raise exception 'This member still owes % on loans. Clear the loans before deleting.', dhsa_inr(v_owed);
  end if;
  -- The audit log keeps a copy of every row removed here
  delete from withdrawals where member_id = p_id;
  delete from repayments  where member_id = p_id;
  delete from deposits    where member_id = p_id;
  delete from loans       where member_id = p_id;
  delete from members     where id = p_id;
end $$;

-- ── 7. Permissions ──────────────────────────────────────────────────────────
-- Data tables are left exactly as they are. The internal tables get no direct
-- access, so the audit log can't be altered and PIN attempts/sessions can't be
-- read or reset through the app's key.
do $$
declare t text; p record;
begin
  foreach t in array array['dhsa_audit_log','dhsa_login_attempts','dhsa_member_sessions'] loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format('revoke all on %I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on %I from authenticated', t);
    end if;
  end loop;
end $$;

-- The app may call the dhsa_ functions, except the internal PIN/audit helpers
do $$
declare r record; v_internal text[] := array['dhsa_audit','dhsa_record_failure','dhsa_lockout_message'];
begin
  for r in select p.oid::regprocedure as sig, p.proname from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'dhsa\_%' loop
    execute format('revoke all on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format(case when r.proname = any (v_internal) then 'revoke all on function %s from anon'
                          else 'grant execute on function %s to anon' end, r.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format(case when r.proname = any (v_internal) then 'revoke all on function %s from authenticated'
                          else 'grant execute on function %s to authenticated' end, r.sig);
    end if;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
