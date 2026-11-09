-- ============================================================================
-- Deleting a loan also deletes its repayments  (2026-11-09)
--
-- Run AFTER 20261109_security_and_audit.sql.
-- SAFE FOR EXISTING DATA: only adds one function; no rows are touched.
--
-- Loan and repayments are marked deleted together in one transaction (soft
-- delete, so they can be restored). The pool stays correct: the loan stops
-- counting as money out, and its repayments stop counting as money back in.
-- The audit log records every row that is marked deleted.
-- ============================================================================

begin;

create or replace function dhsa_delete_loan_cascade(p_id text, p_reason text)
returns void language plpgsql as $$
begin
  perform dhsa_lock();
  if not exists (select 1 from loans where id = p_id and deleted is not true) then
    raise exception 'Loan % not found.', p_id;
  end if;

  update repayments
     set deleted = true,
         edit_reason = 'Loan ' || p_id || ' deleted: ' || coalesce(p_reason, ''),
         edited_at = now()
   where loan_id = p_id and deleted is not true;

  update loans
     set deleted = true, edit_reason = p_reason, edited_at = now()
   where id = p_id;
end $$;

-- Same access as the other money functions
revoke all on function dhsa_delete_loan_cascade(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function dhsa_delete_loan_cascade(text, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function dhsa_delete_loan_cascade(text, text) to authenticated;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
