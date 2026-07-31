# Release checklist

Run through this before shipping to production. Items marked **[verify]** need a human to check
against the actual target environment (they can't be true/false from the code alone); everything
else is already true of the codebase as of this pass and just needs to stay that way.

## Security

- [x] Every table has Row Level Security enabled, scoped by role + centre (see
      `supabase/migrations/20260727125052_core_schema.sql` onward)
- [x] Privilege-escalation paths closed: `profiles.role`/`centre_id` locked to super_admin-only
      changes (`prevent_role_escalation`), `centres` columns locked to intended fields for
      centre_admin (`restrict_centre_admin_centre_update`)
- [x] File uploads validated by magic bytes (not client-declared MIME type), size-capped,
      rate-limited per uploader (`src/lib/storage/r2.ts`)
- [x] Security headers set globally: CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
      Referrer-Policy, Permissions-Policy (`next.config.ts`)
- [x] Rate limiting on login, password reset, and file uploads (`src/lib/auth/rate-limit.ts`)
- [x] Secrets never reach the client bundle: service-role key and R2 credentials only imported
      from `"server-only"`-guarded modules
- [x] `DEV_DEFAULT_PASSWORD` cannot be set in a production boot (`src/lib/env.ts`)
- [ ] **[verify]** Supabase Auth redirect URL allow-list matches the real production domain
- [ ] **[verify]** R2 API token is scoped to only the two buckets this app uses, not full-account access
- [ ] **[verify]** `SUPABASE_SERVICE_ROLE_KEY` has not been committed, logged, or shared outside the deployment platform's env var store

## Performance & Database

- [x] Every foreign key has a covering index; the busiest filter/sort combinations have composite
      indexes (`players`, `payments`, `gate_pass_logs`, `attendance` — see
      `supabase/migrations/20260731060000_performance_indexes.sql`)
- [x] Pagination on every list page that grows unboundedly (players, payments, administrators,
      injuries, 5S reports); gate pass defaults to a rolling 30-day window
- [x] Static reference data (5S test/question catalog) cached server-side, not re-queried per page
- [x] No N+1 query patterns; independent queries run via `Promise.all`
- [ ] **[verify]** Supabase connection pooling (Supavisor) is enabled on the production project

## Deployment

- [x] CI runs typecheck, lint, build, and no-database-required smoke tests on every PR
      (`.github/workflows/ci.yml`)
- [x] `/api/health` reports database + storage status, unauthenticated, suitable for uptime
      monitoring (`src/app/api/health/route.ts`)
- [x] Environment variables validated at startup — the app fails fast on missing required config
      instead of crashing on the first request that needs it (`src/lib/env.ts`)
- [x] Deployment is repeatable from documented steps + migrations, no manual DB editing
      (`docs/DEPLOYMENT.md`)
- [ ] **[verify]** All required env vars are set in the deployment platform for Production *and*
      Preview environments
- [ ] **[verify]** `npx supabase db push` has been run against the production project with every
      migration in `supabase/migrations/`

## Monitoring & Logging

- [x] Every unexpected failure (catch block or unlogged DB error) logs with context via
      `src/lib/logger.ts`, not silently swallowed
- [x] Sentry wired for Server Components, Route Handlers, Server Actions, and React rendering
      errors — no-op until `SENTRY_DSN` is set (`src/instrumentation.ts`, `error.tsx`,
      `global-error.tsx`)
- [x] Role-scoped `error.tsx`/`not-found.tsx` at every top-level route so a failure doesn't blank
      the whole app shell, just the content area
- [ ] **[verify]** An uptime monitor is actually pointed at `/api/health` in production
- [ ] **[verify]** Sentry alerting (not just capture) is configured for whoever's on call

## Backups & Recovery

- [x] Backup/restore/rollback strategy documented, including known gaps (`docs/BACKUP_RECOVERY.md`)
- [ ] **[verify]** Point-in-time recovery is enabled on the production Supabase project (default
      daily backups mean up to 24h of potential data loss otherwise)
- [ ] **[verify]** R2 event-notification mirroring (or an equivalent) is set up if object-level
      recovery is required — not configured by default (see `docs/BACKUP_RECOVERY.md`)

## Documentation

- [x] Local development setup documented (`README.md`)
- [x] Every environment variable documented, both inline (`.env.local.example`) and in a table
      (`README.md`)
- [x] Supabase, Cloudflare/R2, and Sentry setup documented (`docs/DEPLOYMENT.md`)
- [x] Backup strategy and restore process documented (`docs/BACKUP_RECOVERY.md`)

## Testing

- [x] `smoke.spec.ts` — no-auth Playwright smoke tests, run in CI on every PR
- [x] `auth.spec.ts` — login, wrong-password rejection, role-based redirect (authorization),
      logout — needs seeded test accounts to run
- [x] `workflows.spec.ts` — CRUD, file upload, gate pass, attendance — needs seeded test accounts
      + mock data to run
- [ ] **[verify]** The full E2E suite (not just `smoke.spec.ts`) has been run at least once
      against a staging deployment with real seeded data before this release
