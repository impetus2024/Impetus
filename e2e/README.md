# End-to-end smoke tests

[Playwright](https://playwright.dev). Spec files, split by what they need to run:

| File | Needs | What it covers |
| --- | --- | --- |
| `smoke.spec.ts` | Nothing — a running server only | Health endpoint, unauthenticated redirects, login page renders |
| `auth.spec.ts` | Seeded test accounts | Login, wrong-password rejection, role-based redirect (authorization), logout |
| `workflows.spec.ts` | Seeded test accounts + mock data | CRUD (packages), file upload (administrator profile picture), gate pass, attendance |
| `batch-edit.spec.ts` | Seeded test accounts + mock data, service-role key — creates and removes its own throwaway coaches, batches and second centre | Batch Edit coach assignment: removing a Head Coach, clearing an Assistant Coach, promoting the Assistant Coach to Head Coach in one save, assigning coaches to an unassigned batch, a no-op save writing back exactly what is stored, Add Batch still requiring a Head Coach, and server-side rejection of forged cross-centre and same-centre non-coach ids |

`smoke.spec.ts` is safe to run anywhere, including CI on every PR, because it never touches a real
database — the health check assertion accepts either `200` (healthy) or `503` (DB/storage
unreachable), so it still passes against a placeholder Supabase project.

`auth.spec.ts` and `workflows.spec.ts` need a real Supabase project with seeded fixtures. They
`test.skip()` themselves with a clear reason when `DEV_DEFAULT_PASSWORD` isn't set, rather than
failing — a missing seed is an environment gap, not a regression.

## Running locally

```bash
# 1. Start local Supabase and apply migrations (see README.md's "Local development" section)
npx supabase start
npx supabase db reset

# 2. Create the centre the test accounts attach to (no-op if one already exists)
node --env-file=.env.local -r tsx/cjs scripts/seed-local-centre.ts

# 3. Seed the fixed test accounts + mock data these tests use
npm run seed:test-accounts
npm run seed:mock-data

# 4. Run the suite (starts `next dev` for you — see playwright.config.ts)
npm run test:e2e
```

`playwright.config.ts` loads `.env.local` (the same file `next dev` and the seed scripts read)
before any spec runs, so the local Supabase connection and the local R2/S3 storage config
(`R2_ENDPOINT`, `R2_BUCKET_NAME`, ...) reach both the test process and the dev server it starts —
no manual `export` required. Values already present in the environment win, so CI's explicit env
is unaffected.

`documents-ui.spec.ts` and `documents-storage.spec.ts` both create, mutate (documents-ui
shrinks the bucket's file-size limit to force a real upload failure) and delete the one bucket the
app is configured with, and the workflow specs upload into that same bucket. Every spec also shares
the one dev server and the one local database. `playwright.config.ts` therefore runs the whole
suite with a single worker, and lists the two documents specs in their own project last, so nothing
races over that shared bucket — this is the `--workers=1` the storage specs have always required.
`e2e/global-setup.ts` creates that bucket up front (locally only) so an upload spec running before
the documents specs doesn't hit `NoSuchBucket` on a fresh `supabase db reset`.

`seed:test-accounts` provisions one account per role, all sharing `DEV_DEFAULT_PASSWORD` from
`.env.local`:

- `centreadmin@impetus.local`
- `coach@impetus.local`
- `medical@impetus.local`
- `parent@impetus.local`

`seed:mock-data` populates player types, age categories, packages, batches, players (including
"Arjun Mehta" in the "Morning U-15 Elite" batch, which `workflows.spec.ts` references directly),
payments, gate pass logs, and attendance for those accounts.

## Running against a real deployment

Point `PLAYWRIGHT_BASE_URL` at a staging/production URL instead of letting Playwright manage a
local dev server:

```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com ALLOW_REMOTE_E2E=true DEV_DEFAULT_PASSWORD=... npm run test:e2e
```

Never point this at a real production deployment with real user data — `workflows.spec.ts`
creates real rows (a package, an administrator, a gate pass entry) and `batch-edit.spec.ts`
creates throwaway coaches, batches and a second centre (all removed again in its own `afterAll`),
against whatever database the target environment is wired to. Use a dedicated staging project
seeded with the same fixtures.

This isn't just a documentation convention: `auth.spec.ts`, `workflows.spec.ts` and
`batch-edit.spec.ts` all call `assertSafeE2ETarget()` (`e2e/helpers.ts`) at module load, which
throws before any test runs if `PLAYWRIGHT_BASE_URL` is set to a non-local host and
`ALLOW_REMOTE_E2E` isn't `"true"`.
`smoke.spec.ts` doesn't call it — it never mutates data, so it's fine against any target,
including a placeholder/production URL, as noted above.

## Why Playwright, not a unit-test framework

The riskiest paths in this app (RLS-scoped data access, Server Actions, file upload validation,
role-based redirects) only fail in ways that matter when exercised through a real browser against
a real (test) database — a unit test with mocked Supabase calls wouldn't catch an RLS policy gap
or a broken redirect. Keeping the suite small and workflow-shaped (one test per real user task)
was a deliberate choice over broad component-level unit tests, per the brief for this pass:
lightweight, not exhaustive.
