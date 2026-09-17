# Deployment guide

This app is designed to deploy to **Vercel** (Next.js's own platform, and what its Server
Actions/proxy/edge runtime assumptions are built around) with **Supabase** (managed Postgres +
Auth) and **Cloudflare R2** (object storage) as the two external dependencies. Nothing in the code
is Vercel-specific beyond that assumption, but the steps below are written for it.

## 1. Supabase (production project)

1. Create a project at [supabase.com](https://supabase.com) (or self-host — the app only depends
   on standard Postgres + GoTrue + PostgREST behavior, nothing Supabase-cloud-specific).
2. Apply every migration in `supabase/migrations/` in order, using the guarded wrapper scripts —
   never call `supabase link` / `supabase db push` directly, so a stray linked project can't get
   pushed to by habit:
   ```bash
   npm run supabase:link -- --project-ref <your-project-ref> --yes
   npm run db:push -- --confirm-ref <your-project-ref>
   ```
   Both wrappers (`scripts/lib/supabase-guard.ts`) print the project you're about to act on and
   refuse to proceed without the explicit flag shown above — `--yes` for linking, and typing the
   project ref again as `--confirm-ref` for the push itself, so it can't be fat-fingered from a
   copied command. These migrations are the only source of truth for the schema — don't hand-edit
   tables via the Studio UI in production, or `db push` will drift from what's actually running.
   `supabase db reset` (no `--linked`) stays as a direct CLI call — it only ever touches the local
   Docker Postgres instance, never a hosted project, so it isn't gated. To reset a *linked* project
   (rare, destructive), use `npm run db:reset:linked -- --confirm-ref <project-ref>`.
3. **Auth → URL Configuration**: set the Site URL to your production domain, and add
   `https://<your-domain>/auth/confirm` to the redirect allow-list (this is where password reset
   links land — see `src/app/auth/confirm/route.ts`). Requests to unlisted redirect URLs are
   rejected by GoTrue itself, so this step isn't optional.
4. **Auth → Providers → Email**: confirm `enable_confirmations` matches what
   `src/lib/auth/provision-user.ts` expects (accounts are created via the admin API with
   `email_confirm: true`, so this app never relies on Supabase's own confirmation-email flow).
5. **Auth → Rate Limits**: the local `supabase/config.toml` defaults are reasonable starting
   points; review them against expected login volume before launch (see `[auth.rate_limit]` in
   that file for what's currently assumed).
6. Copy `Project URL`, `anon` key, and `service_role` key into your deployment's environment
   variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`). **The service role key bypasses Row Level Security — it must
   never be exposed to the browser or committed to git** (already enforced: every file that
   imports it has `import "server-only"`, and `.gitignore` excludes all `.env*` files).
7. **Connection pooling**: at meaningful concurrency, confirm Supabase's connection pooler
   (Supavisor/PgBouncer, enabled by default on hosted projects) is active — the app opens a fresh
   Supabase client per request and doesn't manage its own pool.

## 2. Cloudflare R2

1. Create two buckets: one for public assets (centre logos) and one for private documents
   (Aadhaar, medical records, injury reports, staff documents). If you only create one, set only
   `R2_BUCKET_NAME` — the app falls back to storing "private" objects there too, distinguished
   only by an unguessable UUID key, not a real bucket-level access boundary (see the comment in
   `src/lib/storage/r2.ts`). Two buckets is the production-recommended setup.
2. Enable public access (a custom domain or the `r2.dev` subdomain) **only on the public bucket**
   — set `R2_PUBLIC_URL` to that. Leave the private bucket's public access off entirely.
3. Create an R2 API token (Account → R2 → Manage API Tokens) scoped to just these two buckets,
   read+write. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. Set `R2_PRIVATE_BUCKET_NAME` to the second bucket's name.
5. No CORS configuration is needed — all R2 access happens server-side (uploads go through Server
   Actions, downloads are short-lived signed URLs generated server-side); the browser never talks
   to R2 directly.

## 3. Resend (transactional email)

Every email this app sends is transactional and goes through Resend (`src/lib/email/send.ts`):
the account invite that carries a newly provisioned account's temporary password, the admin
password reset, and the "your sign-in email has been updated" notice sent to a parent's new
address after a Centre Admin changes it. There is no other channel that delivers a temporary
password, so unlike R2 or Sentry this is **not** optional in production — `src/lib/env.ts`
refuses to boot with `NODE_ENV=production` unless `RESEND_API_KEY` and `EMAIL_FROM` are both set,
and `EMAIL_FROM` is well-formed.

1. Create an API key (Resend → API Keys) with **Sending access** only. Set `RESEND_API_KEY`.
2. Add and verify your sending domain (Resend → Domains): add the DKIM, SPF and (recommended)
   DMARC records Resend generates to that domain's DNS, and wait for the status to read
   **Verified**. Resend rejects a send from an unverified domain with a 403 — that failure is now
   recorded as a `failed` row in `email_logs`, visible in the app's Email Analytics pages, but
   nothing reaches the recipient.
3. Set `EMAIL_FROM` to an address on that verified domain. Both `noreply@your-domain.com` and the
   named form `Impetus <noreply@your-domain.com>` are accepted.
4. Add a webhook (Resend → Webhooks) pointing at `https://<your-domain>/api/webhooks/resend`, and
   copy its **Signing Secret** into `RESEND_WEBHOOK_SECRET`. Subscribe it to `email.sent`,
   `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.failed` and
   `email.complained` — the seven events `src/app/api/webhooks/resend/route.ts` tracks. Without
   this, email still sends; only the delivery status shown in Email Analytics stays at `sent`
   forever.
5. Leave Resend's own suppression list enabled (the default). A hard-bounced parent address will
   otherwise keep being retried on every invite.

## 4. Sentry (optional but recommended)

Create a Sentry project, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (the same value — DSNs
aren't secret, the `NEXT_PUBLIC_` one just ships in the browser bundle) and, for source-map
upload during build, `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`. Every one of these is a
no-op if left unset — see `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`,
`src/instrumentation-client.ts`.

## 5. Vercel

1. Import the repository, set the environment variables from steps 1–3 (Production **and**
   Preview environments — Preview deploys are how PRs get reviewed, and they need a working
   Supabase connection too; point Preview at a separate non-production Supabase project if you
   want deploy previews isolated from real data).
2. **Do not set `DEV_DEFAULT_PASSWORD`** in any deployed environment — the app refuses to boot if
   it's set while `NODE_ENV=production` (`src/lib/env.ts`), specifically because it would give
   every newly provisioned account the same known password.
3. Build command / output: defaults (`next build`) — nothing custom needed.
4. Confirm the `Proxy (Middleware)` bundle Vercel reports at build time includes
   `src/proxy.ts` (this Next.js version's renamed `middleware.ts` — see `AGENTS.md`) — it's what
   enforces the authentication redirect on every route.

## 6. Post-deploy verification

1. Hit `/api/health` — expect `{"status":"ok","checks":{"database":"ok","storage":"ok"}}` with a
   `200`. `"degraded"` (still `200`) means storage is unreachable but the app is otherwise
   functional; `"down"` (`503`) means the database is unreachable — investigate before
   considering the deploy live. This endpoint is unauthenticated by design (see
   `src/lib/supabase/middleware.ts`'s `ALWAYS_ALLOWED_PATHS`) — point your uptime monitor at it.
2. Run `npm run seed:super-admin` once against production (with real `SEED_SUPER_ADMIN_*` values)
   to create the first login. Every seed script (`scripts/lib/db-guard.ts`) refuses to run against
   anything but a local Supabase instance by default — for this one intentional production run,
   set `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to the production
   project's values, then run:
   ```bash
   ALLOW_REMOTE_DB=true npm run seed:super-admin -- --allow-remote
   ```
   Never add that override to `seed:test-accounts` or `seed:mock-data` in production — those
   create throwaway fixture accounts/data and are local/staging-only by design.
3. Sign in as that Super Admin, create a centre (this exercises the R2 logo upload and the first
   Centre Admin provisioning email in one action), and confirm the invite email arrives. Sign in
   as that Centre Admin with the temporary password from the email: the app must send you
   straight to `/reset-password?required=1` and refuse every other page until you have set your
   own password (`profiles.must_change_password`, enforced in `src/lib/auth/dal.ts`).
4. Confirm response headers on any page include `Content-Security-Policy`,
   `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
   and `Permissions-Policy` (`next.config.ts`'s `headers()` — these apply globally, so any page
   works as a check).
5. If Sentry is configured, confirm an intentionally-triggered error (e.g. a 404) shows up in the
   Sentry project within a few minutes.

## Repeatability

Every step above is either a migration (`supabase/migrations/`, applied via `db push`, idempotent
by construction — `create index if not exists`, etc. where that matters) or an environment
variable. There is no manual production-database editing step in this process — a fresh
environment should be reproducible end-to-end from this document plus the repository.
