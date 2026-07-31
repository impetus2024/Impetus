# Backup & disaster recovery

## Database (Supabase Postgres)

**Backups are managed by Supabase, not this application** — there is no custom backup code in
this repo, and none is needed for the baseline capability:

- Every Supabase project (including the free tier) takes **automatic daily backups**, retained on
  a schedule tied to your plan (Dashboard → Project Settings → Backups).
- **Point-in-time recovery (PITR)** — restoring to any specific second, not just a daily snapshot
  — requires a paid add-on. If this app is handling real player/medical/financial data in
  production, enabling PITR is strongly recommended: the default daily-backup granularity means
  up to 24 hours of data loss in the worst case.
- Restoring a backup is a Dashboard action (Project Settings → Backups → Restore) — there is no
  in-app restore flow, and there shouldn't be one (a restore is a destructive, infrequent,
  operator-supervised action, not something to automate behind a button).

**What this repo owns**: `supabase/migrations/` is the schema's source of truth, and `schema.sql`
at the repo root is a generated flat reference of the current schema (regenerate after any
migration change so it stays a useful diff target — it is not itself applied anywhere).

## Migration rollback

Every migration in this project is **forward-only** — there are no paired "down" migrations.
This is deliberate for how most of them were written (additive: new tables, new indexes, new
columns with defaults) but is a real gap for the ones that aren't — the migrations that
`drop index`/`drop policy` before recreating (see `20260731050000_restrict_centre_admin_centre_columns.sql`,
`20260731060000_performance_indexes.sql`) have no scripted way back to the exact prior state.

**Current mitigation**: Supabase's PITR (above) is the practical rollback mechanism for a bad
migration in production — restore to the moment before it ran. Without PITR enabled, rolling back
a destructive migration means manually writing and applying a new migration that reverses it.

**Recommendation for future work**: for any migration that drops or alters an existing object
(as opposed to purely adding one), write the reverse operation as a comment in the same file, or
maintain a parallel `down/` migration per file — neither exists today.

## Deployment rollback (application code)

Vercel keeps every previous deployment addressable and promotable — "Instant Rollback" in the
Vercel dashboard (or `vercel rollback` via the CLI) repoints production traffic to a prior
deployment in seconds, with no rebuild. This is the primary rollback path for a bad release: it
undoes the *application code*, not the database — a release that shipped a breaking migration
still needs the migration addressed separately (see above), since old code talking to a
migrated-forward schema can itself break.

## Storage (Cloudflare R2)

**This is the weakest link in the current setup and should be treated as a known gap, not an
assumption of safety**: R2 objects in this app's buckets have **no versioning and no soft-delete**
configured. `deleteFile()` (`src/lib/storage/r2.ts`) issues a hard delete; an overwritten or
deleted object (a replaced player document, a re-uploaded logo) is not recoverable through R2
itself.

Mitigations, in order of effort:

1. **Minimize exposure**: the app already only calls `deleteFile()` in one place —
   `deleteReplacedDocs()` (`src/lib/storage/upload-doc-fields.ts`), cleaning up a document that
   was just successfully replaced by a new upload. There is no bulk-delete or admin "empty
   storage" action anywhere in the app.
2. **Cloudflare-side**: R2 supports [event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/)
   that can fan out to a Worker or queue on every write/delete — wiring that up to mirror objects
   into a second bucket (or an external cold-storage target) gives real recoverability without
   changing application code. Not configured today.
3. **Operational**: since every stored object's key is only ever referenced from a specific
   database row (`aadhaar_doc_path`, `medical_records_path`, etc.), a scheduled job that diffs R2
   bucket contents against referenced keys in Postgres can at least detect (not prevent) an
   unexpected loss.

## Cascade delete blast radius

Every foreign key in this schema is `on delete cascade` (see `supabase/migrations/20260727125052_core_schema.sql`
onward) — deliberate, since an orphaned row referencing a deleted parent would be a worse failure
mode than the cascade itself, and RLS already scopes every table by `centre_id`, so a cascade
can't cross tenants. These cascades are correct and should not be removed; this section exists so
a future delete is never surprised by how far it reaches.

**`centres`** is the top of the tree — deleting a centre row cascades through every centre-scoped
table: `player_types`, `age_categories`, `packages`, `batches`, `players`, `parent_player_links`,
`payments`, `gate_pass_logs`, `attendance`, `injuries`, and every `five_s_*` table. In a
multi-tenant app, deleting one centre is effectively deleting that entire tenant's data.

**`players`** is the second-largest fan-out — deleting a player cascades to `parent_player_links`,
`payments`, `gate_pass_logs`, `attendance`, `injuries`, and every `five_s_*` result/report table
for that player.

**`profiles`** (1:1 with `auth.users`, both `on delete cascade`) cascades to `staff_profiles` and
any `parent_player_links` where that profile is the parent.

**Current mitigation — no code change needed today:** there is no delete action anywhere in the
app for `centres` or `players` (confirmed via the code graph's `callers_of` / a repo-wide search
for `.delete(` in `src/`) — the only way either cascade fires today is a manual SQL statement
against the database directly, which this framework's rules above (never run `DELETE FROM`
without review, always confirm the target environment first) already cover.

**Recommendation for future work:** if a "delete centre" or "delete player" action is ever added
to the app, back it with a soft-delete (`deleted_at timestamptz`, filtered out of RLS policies)
rather than a real `DELETE`, given the size of these two cascades — a soft-delete is recoverable
and auditable, a cascade delete is neither. Smaller-fan-out tables (`payments`, `attendance`,
single gate pass entries) are reasonable candidates for a real delete if that's ever needed, since
their blast radius is just themselves.

## Operational recovery runbook

| Scenario | Response |
| --- | --- |
| Bad code deploy (crash, broken page) | Vercel Instant Rollback to the last known-good deployment |
| Bad migration (data corruption, broken query) | Restore Supabase project from PITR/backup to just before the migration ran; if PITR isn't enabled, write and apply a corrective migration |
| Supabase project unreachable | `/api/health` reports `"down"` (503) — check Supabase status page and project health in the Dashboard; the app has no automatic failover, it depends on Supabase being up |
| R2 unreachable | `/api/health` reports `"degraded"` (200) — uploads/downloads fail with a user-facing error (see `src/lib/storage/r2.ts`'s timeout/retry config), but the rest of the app keeps working |
| Accidental object deletion in R2 | Not recoverable today — see "Storage" above. This is the top priority gap to close before this app handles data where that's unacceptable |
| Leaked `SUPABASE_SERVICE_ROLE_KEY` or R2 credentials | Rotate immediately in the Supabase Dashboard / Cloudflare dashboard, redeploy with the new value — nothing in the app caches these beyond process lifetime |

## What's already covered elsewhere

- **Error visibility during an incident**: Sentry (if configured) + `/api/health` — see
  `docs/DEPLOYMENT.md` and the Reliability & Observability work (`src/lib/logger.ts`,
  `src/instrumentation.ts`).
- **Session revocation** (e.g. responding to a compromised account): 
  `revoke_user_sessions` (migration `20260731040000_revoke_user_sessions.sql`), invoked from
  `resetUserPassword` (`src/lib/auth/provision-user.ts`) — already wired into the "reset password"
  admin action, not something that needs building for an incident response.
