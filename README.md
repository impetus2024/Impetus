# Impetus — Club Management System

A multi-tenant club management platform for football training centres: player enrollment,
batches, attendance, gate pass logging, payments, injury tracking, and the 5S Model assessment
(Speed, Stamina, Strength, Spirit, Skill), with five roles — Super Admin, Centre Admin, Coach,
Medical, and Parent — each scoped to their own data via Postgres Row Level Security.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack)
- **Supabase** — Postgres, Auth, and Row Level Security (every table's access rules live in the
  database, not just in application code)
- **Cloudflare R2** — S3-compatible object storage for documents and images
- **Sentry** — error tracking (optional, see [Environment variables](#environment-variables))
- **Playwright** — end-to-end smoke tests (see [`e2e/README.md`](e2e/README.md))

## Local development

### Prerequisites

- Node.js 20+
- [Docker](https://www.docker.com/) (required by the Supabase CLI to run Postgres locally)
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
  (`npx supabase` works too — no global install needed)

### Setup

```bash
npm install

# Start local Postgres/Auth/Storage in Docker and apply every migration in supabase/migrations/
npx supabase start
npx supabase db reset

# Copy the connection details `supabase start` just printed (or re-run `npx supabase status`)
cp .env.local.example .env.local
# ...then fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). There's no public sign-up — every account is
provisioned by someone above it in the role hierarchy. To get your first Super Admin account:

```bash
# Fill in SEED_SUPER_ADMIN_EMAIL/PASSWORD/NAME in .env.local first
npm run seed:super-admin
```

From there, a Super Admin creates centres (which provisions that centre's first Centre Admin),
who in turn creates Coaches/Medical staff and enrolls players (which auto-invites each player's
parent). To skip that by hand for local testing, two scripts do it for you:

```bash
npm run seed:test-accounts  # one account per role, all sharing DEV_DEFAULT_PASSWORD
npm run seed:mock-data      # players, batches, payments, attendance, etc. against those accounts
```

### Database safety

Every seed script refuses to run against anything but a local Supabase instance by default (it
reads `NEXT_PUBLIC_SUPABASE_URL` and treats any hosted `*.supabase.co` project as production —
see `scripts/lib/db-guard.ts`). Pass `--dry-run` to any of them to preview what would be created
without writing anything. Rerunning a seed script is safe — each checks for existing data first
and skips rather than duplicating.

The Supabase CLI's project-linking and schema-push commands are similarly gated — always use
`npm run supabase:link`, `npm run db:push`, and `npm run db:reset:linked` instead of calling
`supabase link` / `supabase db push` / `supabase db reset --linked` directly (see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)). Plain `supabase db reset` (no `--linked`) is
unaffected — it only ever touches your local Docker Postgres.

See [`e2e/README.md`](e2e/README.md) for how these tie into the smoke test suite, and
[`CLAUDE.md`](CLAUDE.md)'s "Database Safety" section for the rules any AI assistant working in
this repo must follow.

### Local email

Locally, Supabase's Inbucket catches every email the app sends (invites, password resets) instead
of actually delivering them — view them at the URL `npx supabase status` prints for
`Inbucket URL` (default `http://127.0.0.1:54324`). `RESEND_API_KEY`/`EMAIL_FROM` are only needed
once you're pointed at a real (non-local) Supabase/SMTP setup.

## Environment variables

Every variable is documented inline in [`.env.local.example`](.env.local.example) — copy it to
`.env.local` and fill in real values. Summary:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Absolute-URL base for links in emails |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase client config |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only admin client (account provisioning, resets) — **never** expose this to the browser |
| `FIELD_ENCRYPTION_KEY` | Yes | AES-256-GCM key for Aadhaar/passport numbers at rest (`openssl rand -base64 32`) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Recommended | Cloudflare R2 storage — degrades gracefully (logged warning, upload fails cleanly) if unset, so auth/data flows can stand up before storage is wired in |
| `R2_PRIVATE_BUCKET_NAME` | Optional | A second bucket with public access left off, for a real public/private boundary on staff/player documents (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Recommended | Transactional email (invites, password resets) — same graceful-degradation as R2 |
| `DEV_DEFAULT_PASSWORD` | Local dev only | Every newly provisioned account gets this fixed password instead of a random emailed one. **The app refuses to start in production if this is set** (see `src/lib/env.ts`) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Optional | Error tracking — a no-op everywhere until `SENTRY_DSN` is set |
| `SEED_SUPER_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` | One-time | Only read by `scripts/seed-super-admin.ts` |

Required variables are validated at server startup (`src/lib/env.ts`, wired through
`src/instrumentation.ts`) — the app fails fast with a clear error listing what's missing rather
than crashing on whichever request happens to touch the missing value first.

## Testing

```bash
npx tsc --noEmit     # typecheck
npx eslint src        # lint
npm run build          # production build
npm run test:e2e       # Playwright smoke tests — see e2e/README.md
```

All four run in CI on every pull request (`.github/workflows/ci.yml`); the E2E step there runs
only the no-database-required subset (`e2e/smoke.spec.ts`). The full workflow suite needs seeded
fixtures and is meant to run against a staging deployment — see [`e2e/README.md`](e2e/README.md).

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full production setup: Supabase project
configuration, Cloudflare R2 buckets, Vercel environment variables, and post-deploy verification.

## Backup & disaster recovery

See [`docs/BACKUP_RECOVERY.md`](docs/BACKUP_RECOVERY.md).

## Release checklist

See [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) before shipping to production.

## Architecture

- `src/app/` — routes, grouped by role (`centre-admin/`, `coach/`, `medical/`, `parent/`,
  `super-admin/`), each with its own `layout.tsx` (auth guard + nav shell), `error.tsx`,
  `not-found.tsx`, and `loading.tsx`
- `src/lib/` — server-only shared logic: `auth/` (session, roles, provisioning), `supabase/`
  (client factories), `storage/` (R2 upload/signing), `crypto/` (field encryption), `five-s/`
  (5S Model business rules + cached reference data), `logger.ts`, `env.ts`, `pagination.ts`
- `src/components/` — shared UI: `ui/` (design system primitives), `shell/` (nav/topbar/sidebar),
  domain components used across more than one role's pages
- `supabase/migrations/` — every schema change, RLS policy, and index, in order — this is the
  single source of truth for the database schema (`schema.sql` at the repo root is a generated
  flat reference for diffing — regenerate it after any migration change with
  `npm run db:dump-schema`, which requires local Supabase running via `npx supabase start`)
- `scripts/` — one-off operational scripts (seeding), run manually, never imported by the app

Every table has Row Level Security enabled — authorization is enforced in Postgres, not just in
Server Actions, so a bug in application-layer role checks doesn't expose another centre's data.
