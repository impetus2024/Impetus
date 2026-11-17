# Backup & disaster recovery

> **Status of production backup settings: UNVERIFIED.** Nothing in this repository records the
> production Supabase plan, whether Point-in-Time Recovery (PITR) is enabled, or the backup
> retention window. Those are Supabase Dashboard settings, not code. Do **not** assume PITR is on.
> Fill in the table below from the Dashboard (Database → Backups) and re-verify before each
> release (`docs/RELEASE_CHECKLIST.md`, "Backups & Recovery").

## Recovery objectives and backup facts (fill in — do not guess)

| Item | Value | Verified by / date |
| --- | --- | --- |
| Supabase plan (production project) | `<TBD>` | `<TBD>` |
| Daily backups available? Retention (days) | `<TBD>` | `<TBD>` |
| PITR enabled? Retention window (days) | `<TBD — currently unconfirmed>` | `<TBD>` |
| **RPO** — max data loss we accept | `<TBD>` | `<TBD>` |
| **RTO** — max time to be back up | `<TBD>` | `<TBD>` |
| Last restore drill (into a scratch project) and measured duration | `<never run / TBD>` | `<TBD>` |
| Recovery owner (who may authorise a restore) | `<TBD>` | `<TBD>` |
| R2 versioning / mirror configured? | `<TBD — not configured by this repo>` | `<TBD>` |

How to read the RPO until the table is filled in: **if PITR is not enabled, the worst case is
loss of everything written since the last daily backup (up to roughly 24 hours).** If it is
enabled, the RPO is set by Supabase's PITR granularity — confirm the figure in Supabase's current
documentation and record it above. Supabase's plan features and retention change over time; this
document deliberately does not hard-code them.

## Database (Supabase Postgres)

**Backups are managed by Supabase, not this application.** There is no backup code in this repo.
Whether daily backups exist, how long they are kept, and whether PITR is available all depend on
the project's plan and add-ons — check them, don't assume (table above).

What a Supabase database restore covers, given how this app is built:

- **Covered (all in Postgres):** every `public` table, RLS policies, functions/triggers, **and
  the `auth` schema** — so user accounts, password hashes and sessions are restored to the
  restore point. `profiles.id` is a 1:1 FK to `auth.users` (`on delete cascade`,
  `20260727125052_core_schema.sql:55`), so the two are always restored consistently.
- **Not covered:** Cloudflare R2 objects (all private documents and centre logos — see
  "Storage" below), Vercel environment variables, and Sentry/Resend data.
- **A restore is project-wide.** It rewinds *every* centre/tenant to the restore point. There is
  no per-tenant or per-table restore. See "Project-wide restore procedure".

There is no in-app restore flow, and there shouldn't be: a restore is destructive, infrequent
and operator-supervised.

**What this repo owns:** `supabase/migrations/` is the schema's source of truth; `schema.sql` at
the repo root is a generated reference (regenerate with `npm run db:dump-schema` after a
migration change; it is not applied anywhere). `scripts/lib/supabase-guard.ts` hard-blocks
`supabase db reset --linked` against the production project ref and refuses any CLI command
outside `link` / `db push` / `db reset` — it protects the npm-script path only, **not** a direct
`npx supabase …` call or a service-role key used elsewhere, so backups remain the real safety
net.

## Migration rollback

Every migration is **forward-only** — there are no paired "down" migrations. Most are additive,
but some are not:

- **Delete data:** the benchmark migrations run unconditional deletes —
  `20260927000000_five_s_speed_benchmark_bands.sql` (`five_s_test_benchmarks`, speed
  `five_s_age_bands`), `20260928000000_five_s_stamina_benchmark_bands.sql`
  (`five_s_stamina_benchmarks`, stamina bands) and
  `20260928000001_five_s_strength_benchmark_bands.sql` (`five_s_strength_benchmarks`, strength
  bands). Reference data only, and already applied — but they would re-run on any fresh or reset
  database.
- **Drop/recreate objects:** many `drop policy` / `drop constraint` / `drop column if exists`
  statements, e.g. `20260731050000_restrict_centre_admin_centre_columns.sql`,
  `20260731060000_performance_indexes.sql`, `20260809020000_player_batches.sql`.

There is no scripted way back to the exact prior state for these. Practical rollback of a bad
production migration is the project-wide restore below (requires a usable backup/PITR point from
before it ran); otherwise write and apply a new corrective migration. Several recent migrations
already carry their reverse steps in comments (e.g. `20261005000000_batch_head_coach_optional.sql`,
`20261003000000_protect_players_parent_email.sql`) — follow that pattern for any migration that
drops or alters an existing object.

## Deployment rollback (application code)

Vercel keeps previous deployments addressable — "Instant Rollback" in the dashboard (or
`vercel rollback`) repoints production to a prior deployment without a rebuild. This undoes
*application code*, not the database; a release that shipped a breaking migration still needs the
migration addressed separately, since old code against a migrated-forward schema can itself break.

## Storage (Cloudflare R2)

**Treat this as a known gap.** Database backups/PITR do **not** cover R2. This repo configures
no R2 versioning, no soft delete and no mirror; whether any exists on the Cloudflare side is
`<TBD — verify in the Cloudflare dashboard>`. `deleteFile()` (`src/lib/storage/r2.ts`) issues a
hard `DeleteObject`; unless R2 itself retains versions, a deleted or overwritten object cannot be
recovered.

What lives in R2:

- **Private documents** under the managed prefixes `player-documents/`, `staff-documents/`,
  `injury-reports/` (`MANAGED_DOCUMENT_PREFIXES`, `src/lib/storage/document-registry.ts`),
  referenced from `players` (`aadhaar_doc_path`, `medical_records_path`,
  `profile_picture_path`), `staff_profiles` (`aadhaar_doc_path`, `birth_certificate_path`,
  `profile_picture_path`, `other_documents_path`) and `injuries` (`report_doc_path`).
- **Centre logos** (`centres.logo_path`) and other uploaded images referenced by database rows.

Where the app deletes R2 objects today (`deleteFile`):

| Trigger | Code | Effect |
| --- | --- | --- |
| Replacing a document / profile picture | `upload-doc-fields.ts` (`deleteReplacedDocs`), `players/actions.ts`, `coach/profile/actions.ts`, `administrators/actions.ts` | Old object deleted after the new one is saved |
| Deleting a **centre** | `super-admin/centres/actions.ts` → `releaseDocuments` (`document-lifecycle.ts`) + logo delete | Every player/injury/staff document of that centre, and its logo, deleted from R2 after the database delete succeeds |
| Deleting a **centre admin** | `deleteCentreAdmin` → `deleteWithDocumentCleanup` | That admin's staff documents deleted from R2 |
| Deleting a monthly highlight / news item | `lib/monthly-highlights/actions.ts`, `lib/news-events/actions.ts` | Row (and any image it owns) deleted |

### Consequence for database restores

A database restore rewinds rows but **cannot bring back R2 objects deleted after the restore
point.** After restoring (for example, to undo a mistaken `deleteCentre`):

- The restored rows will reference R2 keys whose objects were hard-deleted by
  `releaseDocuments`. The UI shows these as unavailable once the signed URL 404s.
- Objects *created* after the restore point become unreferenced orphans.
- Run the read-only reconciliation (below) after every restore and treat `missing` entries as
  permanently lost files unless R2-side versioning/mirroring exists.

Detection (not prevention): `npm run reconcile:documents` compares every document reference to
the objects under the managed prefixes and reports `referenced`, `shared`, `missing`,
`unreferenced`, `grace_period`. It only reads, **except** `--record-missing`, which appends
`missing` events to `document_audit_events` and is gated by `scripts/lib/db-guard.ts` (local only
unless `ALLOW_REMOTE_DB=true` *and* `--allow-remote`). Deletion, orphan and missing events are
also written to `document_audit_events` by the app and the `audit_document_columns` trigger —
that table has **no foreign keys and is append-only** (`20261001000000_document_audit_events.sql`),
so it survives a centre delete and records which objects were removed, by whom, and when.

Mitigations, in order of effort (none configured by this repo):

1. Enable R2 object versioning, or R2 event notifications mirroring every write/delete to a
   second bucket or cold storage ([Cloudflare docs](https://developers.cloudflare.com/r2/buckets/event-notifications/)).
2. Before any bulk or centre-level delete, copy that centre's managed-prefix objects somewhere
   else.
3. Run `reconcile:documents` on a schedule so unexpected loss is detected early.

## Cascade delete blast radius

Foreign-key delete behaviour is **mixed**, not uniformly `cascade`. Derived from
`supabase/migrations/`:

**`ON DELETE CASCADE` from `centres`** — deleting a `centres` row removes, directly or through `players`/`batches`:
`player_types`, `age_categories`, `packages`, `batches`, `players`, `parent_player_links`,
`payments`, `gate_pass_logs`, `attendance` (via player/batch), `injuries`, `player_batches`,
`package_change_logs`, `whatsapp_logs`, `five_s_results`, `five_s_category_notes`,
`five_s_question_responses`, `five_s_group_notes`, `five_s_reports`, plus the publish mappings
`monthly_highlight_centres` and `news_event_centres`.

**`ON DELETE CASCADE` from `players`** — `parent_player_links`, `payments`, `gate_pass_logs`,
`attendance`, `injuries`, `player_batches`, `package_change_logs`, `whatsapp_logs` and every
`five_s_*` result/note/response/report table for that player.

**`ON DELETE CASCADE` from `batches`** — `attendance`, `player_batches`.

**`ON DELETE CASCADE` from `profiles`** — `staff_profiles`, `parent_player_links` (as parent),
`news_event_dismissals`, `monthly_highlight_dismissals`. `profiles` itself cascades from
`auth.users`.

**Deliberately NOT cascading** (these block or detach instead):

- `profiles.centre_id → centres` is **`ON DELETE RESTRICT`** (`core_schema.sql:57`): a centre with
  any staff profile cannot be deleted until those accounts are removed first.
- Staff-authored records reference `profiles` with **`RESTRICT`**: `players.created_by`,
  `payments.recorded_by`, `attendance.marked_by`, `batches.head_coach_id`,
  `gate_pass_logs.performed_by`, `injuries.reported_by`, `five_s_*.recorded_by`,
  `five_s_reports.published_by`, `package_change_logs.changed_by`,
  `monthly_highlights.created_by`, `news_events.created_by`. A staff member with history cannot
  be deleted.
- `SET NULL`: `batches.player_type_id`, `players.age_category_id/player_type_id/package_id/batch_id`,
  `payments.package_id`, `batches.assistant_coach_id`, `email_logs` and `whatsapp_logs` profile
  links — the row survives, the link is cleared.
- `batches.age_category_id` is `RESTRICT`.
- `document_audit_events` has no FKs at all, by design.

### Deletes the application can actually perform today

There is **no** player-delete action (the only `players`-adjacent `.delete()` is
`player_batches` re-sync in `centre-admin/players/actions.ts:207`). The app **does** have:

| Action | File | Authorisation | What it removes |
| --- | --- | --- | --- |
| `deleteCentre` | `src/app/super-admin/centres/actions.ts:305` | `requireRole("super_admin")` + type-the-centre-name confirmation | Hard-deletes every staff **auth account** of the centre (one by one, not transactional), then the `centres` row and its entire cascade above, then the R2 documents and logo |
| `deleteCentreAdmin` | same file, `:438` | `super_admin`, no typed confirmation | One centre admin's auth account, `profiles`, `staff_profiles`, and their R2 documents |
| Monthly highlight / news item delete | `lib/monthly-highlights/actions.ts`, `lib/news-events/actions.ts` (service role via `lib/publishable-content/delete-with-cascade.ts`) | Caller access-checked first | The row and its `*_centres` mapping rows |

`deleteCentre` pre-checks (`findStaffWithHistoricalRecords`) that no staff member has `RESTRICT`
history and refuses the whole operation otherwise — but the loop that deletes staff accounts is
**not transactional**: a GoTrue failure partway through leaves earlier accounts deleted. The
service-role client bypasses RLS for these deletes.

**Recovery note:** a deleted centre is only recoverable via a project-wide restore (below),
because there is no soft delete (`deleted_at`) anywhere in the schema. Its R2 documents will
not come back with it.

**Recommendation:** if centres or players must be recoverable, back the delete with a soft delete
(`deleted_at`, filtered in RLS) instead of `DELETE`, or at minimum take an on-demand backup /
confirm a fresh PITR point immediately before running `deleteCentre`.

## Project-wide restore procedure

> A restore rewinds **the whole project, all tenants**. Everything written after the restore
> point is lost for every centre. Never run this on production without the owner's explicit
> sign-off. The steps below are the process this repo expects; the exact Dashboard wording and
> options are Supabase's — follow their current documentation for the restore itself, and record
> any deviation here after the first drill.

### 0. Prerequisites (do before an incident)

- Fill in the table at the top of this document; confirm the recovery owner and RPO/RTO.
- Run at least one **restore drill into a separate scratch project** (never production), time it,
  and record the result above.
- Know where the Supabase project owner login, Cloudflare access and Vercel access live.

### 1. Decide that a restore is the right tool

- Code bug only → Vercel Instant Rollback, not a restore.
- A single bad row/tenant, restore not necessary → consider restoring into a **separate
  project** and copying just the affected rows back (see step 7), instead of rewinding everyone.
- Data loss or corruption affecting production data → continue.

### 2. Freeze and scope

1. Stop further damage: put the app in maintenance (or pause the Vercel production deployment /
   revoke the offending credential), and stop any in-flight scripts.
2. Record the **incident time** and the **target restore time** (latest point you are confident
   was good — e.g. just before the bad migration or `deleteCentre`). Use `document_audit_events`,
   Sentry and Vercel logs to pin the time.
3. List what will be lost: every write by every centre between the restore time and now. Tell the
   centres' admins.

### 3. Confirm a restore point exists

- In the Dashboard, check that a daily backup or PITR window actually covers the target time
  (this is the point where an unverified setup is discovered — hence the table at the top).
- If **no** restore point covers it, stop: the only remaining path is a corrective migration or
  manual repair.

### 4. Take a safety copy of the current (damaged) state

Before rewinding, preserve the current database if at all possible (an on-demand backup, or a
`pg_dump` taken by an authorised operator), so post-restore data created after the target time can
be extracted and re-applied later. Do this using Supabase's tooling; this repo's guard wrapper
does not run dumps.

### 5. Perform the restore (operator, in the Supabase Dashboard)

Restore the project to the chosen backup or PITR timestamp following Supabase's current
procedure. Expect the project to be unavailable while it runs; the duration is `<TBD — measure in
a drill>`. Do **not** use `npm run db:reset:linked` / `supabase db reset` — that is a wipe, and
it is hard-blocked on the production ref.

### 6. Verify after restore

1. `/api/health` returns healthy (database reachable).
2. Log in as a super admin, a centre admin, a coach and a parent; confirm each role lands on the
   right dashboard. Users who changed their password or were created after the restore point
   revert to the older state, so some may need a password reset
   (`resetUserPassword` / `revoke_user_sessions`).
3. Spot-check counts and recent rows for the affected centre(s) against `document_audit_events`,
   payment records and any external records.
4. Confirm that migrations match the app: compare `supabase_migrations.schema_migrations` with
   `supabase/migrations/`. If the restore point predates a migration the deployed code needs,
   re-apply it with `npm run db:push -- --confirm-ref <ref>` (guarded) — or roll the deployment
   back first.
5. Run `npm run reconcile:documents` (read-only) and review `missing` entries — expect missing
   R2 objects if the incident deleted files (see "Consequence for database restores").
6. Re-enable the app; watch Sentry.

### 7. Reapply post-restore data (optional)

If a safety copy exists (step 4), extract rows created after the restore point for unaffected
centres and re-insert them via reviewed SQL, one table at a time, in a transaction, against a
verified target. Never replay the offending `DELETE`.

### 8. Post-incident

Record the timeline, the actual RPO/RTO achieved, what was lost (including R2 objects) and the
corrective actions in this document's table; fix whatever allowed the incident.

## Operational recovery runbook

| Scenario | Response |
| --- | --- |
| Bad code deploy (crash, broken page) | Vercel Instant Rollback to the last known-good deployment |
| Bad migration (data corruption, broken query) | Project-wide restore to just before the migration ran (needs a restore point covering that time — verify, see table above); otherwise write and apply a corrective migration |
| Centre or admin deleted by mistake (`deleteCentre` / `deleteCentreAdmin`) | Project-wide restore, or restore to a scratch project and copy that centre's rows back; R2 documents deleted by the action are **not** recovered by a database restore |
| Supabase project unreachable | `/api/health` reports `"down"` (503) — check the Supabase status page and project health; the app has no automatic failover |
| R2 unreachable | `/api/health` reports `"degraded"` (200) — uploads/downloads fail with a user-facing error; the rest of the app keeps working |
| Accidental object deletion in R2 | Not recoverable by this repo unless R2 versioning/mirroring exists (`<TBD>`); run `reconcile:documents` to scope the loss |
| Leaked `SUPABASE_SERVICE_ROLE_KEY` or R2 credentials | Rotate immediately in the Supabase Dashboard / Cloudflare dashboard, redeploy with the new value |

## What's already covered elsewhere

- **Error visibility during an incident:** Sentry (if configured) + `/api/health` — see
  `docs/DEPLOYMENT.md`, `src/lib/logger.ts`, `src/instrumentation.ts`.
- **Session revocation** (e.g. a compromised account): `revoke_user_sessions`
  (`20260731040000_revoke_user_sessions.sql`), called from `resetUserPassword`
  (`src/lib/auth/provision-user.ts`).
- **Document audit trail:** `document_audit_events` (append-only, no FKs) records document
  reference changes, storage cleanups, orphans and missing objects — use it to scope an incident.
