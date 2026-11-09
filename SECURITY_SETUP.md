# Security setup — do these steps in this order

None of these steps changes or deletes any existing record.

## 1. Create the admin login in Supabase (before deploying)

The app no longer has the admin password built into it. Admins sign in through Supabase.

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Email: `financewing982@gmail.com` (the email the app uses today).
3. Password: choose a **new, strong** password. The old one was visible to anyone who
   opened the app, so treat it as leaked.
4. Tick **Auto Confirm User**, then **Create user**.
5. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up",
   so nobody else can create an account.

## 2. Deploy the new app version

Push `main` (Vercel deploys it). Then, in Vercel → Project → Settings → Environment Variables,
**delete `VITE_ADMIN_EMAIL` and `VITE_ADMIN_PASSWORD`**. They are no longer used.
Also delete them from your local `.env.local`.

Check: sign in on the Admin tab with the email and password from step 1, then enter the admin PIN.

## 3. Run the security SQL

Supabase dashboard → **SQL Editor** → paste all of
`supabase/migrations/20261109_security_and_audit.sql` → **Run**.

(`20261108_data_integrity.sql` must already have been run. It has.)

Check:
- Admin: sign out and sign in again, then open the dashboard. All data shows.
- Member: log in with a member PIN. Only that member's records show.

## What changes for people

| Who | Before | After |
|---|---|---|
| Admin | Password was inside the app (anyone could read it) | Supabase sign-in; password never leaves Supabase |
| Admin PIN | Checked in the browser | Checked by the database; 5 wrong tries → locked 15 min |
| Members | PIN checked in the browser; anyone could read all PINs | PIN checked by the database; 5 wrong tries → locked 15 min; can only see their own records |
| Public app key | Could read, change or delete anything | Can only list member names and do the member PIN login |

## Adding another admin

1. Create the user in Supabase (step 1).
2. SQL Editor: `insert into dhsa_admins (email) values ('their@email.com');`

## Audit log

Every new, edited or deleted record is copied to the `dhsa_audit_log` table with who did it
and when, including the old and new values. Nobody can change or delete it from the app.
Supabase dashboard → Table Editor → `dhsa_audit_log`.

## If something goes wrong

Full backups (on this computer only) are in `backups/`. The latest, taken just before these
changes, is `backups/backup-2026-11-09T06-05-00/`.
If step 3 fails partway, nothing is applied: the script runs as one transaction.
