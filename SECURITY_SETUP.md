# Database update — PIN security, audit log, pool rule

None of this changes or deletes any existing record. Admin login is unchanged.

## Run it

Supabase dashboard → **SQL Editor** → paste all of
`supabase/migrations/20261109_security_and_audit.sql` → **Run**.

(`20261108_data_integrity.sql` must already have been run. It has.)

Until it's run, the app keeps working with its built-in checks. Once it's run:

- **Member login:** the PIN is checked by the database. 5 wrong tries lock that member
  for 15 minutes. The portal only returns that member's records.
- **Admin PIN:** also checked by the database, with the same 15-minute lock.
- **Audit log:** every new, edited or deleted record is copied to `dhsa_audit_log` with the
  time and the old and new values. The app's key can't change or delete it.
  To view it: Supabase dashboard → Table Editor → `dhsa_audit_log`.
- **Pool rule:** withdrawals, and deletes or edits that would take the pool below zero,
  are refused.
- **Member delete:** only allowed once the member's balance is zero and no loan is unpaid.

Members who are already logged in to the portal will be asked to log in again once.

## Known risk (by choice)

The admin email and password are still built into the app, and the app's public key can
still read and change the data tables directly. Anyone who opens the app in a browser can
find both. Supabase Auth for admins would close this; the code for it is on the
`fix/security-and-audit` branch history if you want it later.

## Backups

Full backups (on this computer only) are in `backups/`. The latest, taken before these
changes, is `backups/backup-2026-11-09T06-05-00/`.
