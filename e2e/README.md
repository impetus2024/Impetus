# End-to-end smoke tests

[Playwright](https://playwright.dev). Three spec files, split by what they need to run:

| File | Needs | What it covers |
| --- | --- | --- |
| `smoke.spec.ts` | Nothing — a running server only | Health endpoint, unauthenticated redirects, login page renders |
| `auth.spec.ts` | Seeded test accounts | Login, wrong-password rejection, role-based redirect (authorization), logout |
| `workflows.spec.ts` | Seeded test accounts + mock data | CRUD (packages), file upload (administrator profile picture), gate pass, attendance |

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

# 2. Seed the fixed test accounts + mock data these tests use
npm run seed:test-accounts
npm run seed:mock-data

# 3. Run the suite (starts `next dev` for you — see playwright.config.ts)
npm run test:e2e
```

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
creates real rows (a package, an administrator, a gate pass entry) against whatever database the
target environment is wired to. Use a dedicated staging project seeded with the same fixtures.

This isn't just a documentation convention: `auth.spec.ts` and `workflows.spec.ts` both call
`assertSafeE2ETarget()` (`e2e/helpers.ts`) at module load, which throws before any test runs if
`PLAYWRIGHT_BASE_URL` is set to a non-local host and `ALLOW_REMOTE_E2E` isn't `"true"`.
`smoke.spec.ts` doesn't call it — it never mutates data, so it's fine against any target,
including a placeholder/production URL, as noted above.

## Why Playwright, not a unit-test framework

The riskiest paths in this app (RLS-scoped data access, Server Actions, file upload validation,
role-based redirects) only fail in ways that matter when exercised through a real browser against
a real (test) database — a unit test with mocked Supabase calls wouldn't catch an RLS policy gap
or a broken redirect. Keeping the suite small and workflow-shaped (one test per real user task)
was a deliberate choice over broad component-level unit tests, per the brief for this pass:
lightweight, not exhaustive.
