# Super Admin Bootstrap

## Initial setup

`prisma db seed` **never** creates or resets an administrator. The first
Super Admin is created interactively:

```powershell
npm run admin:bootstrap
```

Prompts (PowerShell / any terminal):

1. **Admin email** — validated, lower-cased. Required.
2. **Display name** — optional, defaults to `Super Admin`.
3. **BD mobile** — optional; validated against the project `bdPhoneSchema`
   (`01XXXXXXXXX` / `+880…` / `880…`, normalized to `+880…`).
4. **Password** — typed **hidden** (terminal echo disabled), 8–128 chars.
5. **Confirm password** — hidden; must match or the run aborts with no changes.

On success the CLI creates a `User` (`role=SUPER_ADMIN`, `status=ACTIVE`)
plus its `AdminProfile` inside one transaction, then prints only the email —
never the password or hash.

Log in via the existing panel login:

```
POST /api/admin/auth/login
{ "email": "<admin email>", "password": "<the password you typed>" }
```

## Safety rules

- Refuses to run if a `SUPER_ADMIN` already exists.
- Refuses if the email or mobile is already registered (any role).
- Never overwrites, resets, or deletes existing credentials — no upsert.
- Uses the configured `DATABASE_URL`; no migrations, no resets.
- Passwords are bcrypt-hashed at cost **12**, matching admin login.

## Recovery

There is no self-service reset inside the bootstrap CLI (by design — it must
never modify an existing account). To regain access:

1. Use the admin password-reset / recovery flow if enabled for panel users.
2. Otherwise a platform operator with database access sets a temporary
   credential or promotes another operator through the admin panel — never
   by re-running `admin:bootstrap` (it will refuse while a SUPER_ADMIN row exists).

## What `prisma db seed` still does

Reference data only — Knowledge Hub, Feed Catalog, AIMS foundation, AI
ecosystem, marketplace, locations, and dev demo content. Demo `ContentPost`
attribution uses the first existing admin/super-admin as author, if any; it
is skipped when no admin exists.
