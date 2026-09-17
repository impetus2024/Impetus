-- ============================================================================
-- MIGRATION HISTORY BACKFILL - Impetus
--
-- MANUAL OPERATIONS RUNBOOK. This is NOT a Supabase migration.
--
-- It lives in docs/ on purpose: it is a one-off operator procedure, not a
-- schema change, and the Supabase CLI only reads supabase/migrations/ - so
-- keeping it here guarantees "supabase db push" can never apply it.
--
-- WHAT IT DOES
-- Marks the 21 migration versions below as APPLIED in
-- supabase_migrations.schema_migrations for ONE target environment - the one
-- whose history has actually drifted. Each row records the statements
-- byte-identically to how the Supabase CLI stores them (sourced from the local
-- CLI-applied history, not re-parsed). No migration SQL is executed here, and
-- no application data is read, written or deleted.
--
-- SAFETY PROPERTIES
--   * Insert-only. The file contains no update, delete, drop, alter, grant,
--     revoke or truncate statement - only inserts into the history table.
--   * Idempotent. ON CONFLICT (version) DO NOTHING never modifies or deletes an
--     existing row, so re-running the file is a no-op.
--   * Transactional. The whole file is one explicit transaction that commits
--     atomically, so a partial failure leaves the history untouched.
--   * Preserves all existing data and all existing history rows.
--
-- HOW TO USE IT - all four conditions below are mandatory
--   1. MANUAL OPERATIONS RUNBOOK ONLY. A human operator runs it by hand,
--      against one explicitly named target environment, having read it first.
--   2. NEVER EXECUTE THROUGH CI/CD. Do not call it from GitHub Actions, Vercel
--      builds, preview/branch runs, npm scripts, git hooks or any other
--      automated pipeline, and never run it unattended or on a schedule.
--   3. RUN ONLY AFTER VERIFYING ACTUAL MIGRATION-HISTORY DRIFT. First confirm
--      the target really is missing exactly these versions, using the read-only
--      pre-flight queries at the bottom of this file (V1-V5). If the result is
--      anything other than the expected drift, STOP and re-audit before
--      executing. Applying these rows to an environment where the migrations
--      are NOT actually applied would make a future "supabase db push" skip
--      those real migrations.
--   4. REQUIRES EXPLICIT OPERATOR REVIEW. This file changes nothing on its own;
--      running it is a deliberate, reviewed decision. Review the diff, take a
--      backup of the target first, and record who ran it, where, and when.
--
-- The 21 versions below are environment-independent: the same history gap is
-- repaired in whichever environment is shown to have it.
--
-- Alternative (CLI-sanctioned, equivalent effect, no SQL executed):
--   supabase migration repair <version> --status applied   (one per version)
-- ============================================================================
BEGIN;
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260803160000', '{"-- submitSkillScores (src/app/coach/5s-model/actions.ts) previously wrote to
-- five_s_results, five_s_group_notes, and five_s_category_notes as three
-- separate .upsert() calls â€” a failure on the second or third left the
-- first already committed, with no way to undo it. Unlike deleteCentre
-- (which calls the GoTrue admin REST API and can''t be wrapped in a SQL
-- transaction), all three writes here are plain SQL against tables in the
-- same database, so a single function call gives them real atomicity:
-- Postgres runs the whole function body as one transaction, and any
-- exception (e.g. an RLS violation on one of the three tables) rolls back
-- everything, not just the failed statement.
--
-- Not `security definer`, matching toggle_gate_pass and every other RPC in
-- this app that''s meant to run as the caller â€” RLS''s existing \"coach
-- manages ... for own batch players\" policies on all three tables still
-- apply exactly as they did to the three separate upserts, since a coach
-- calling this still runs it under their own role.
create or replace function public.submit_skill_scores(
  p_results jsonb,
  p_group_notes jsonb,
  p_category_note jsonb
) returns void
language plpgsql
as $$
begin
  if jsonb_array_length(p_results) > 0 then
    insert into public.five_s_results (player_id, test_id, centre_id, score, recorded_by)
    select
      (r->>''player_id'')::uuid,
      (r->>''test_id'')::uuid,
      (r->>''centre_id'')::uuid,
      (r->>''score'')::numeric,
      (r->>''recorded_by'')::uuid
    from jsonb_array_elements(p_results) as r
    on conflict (player_id, test_id) do update set
      score = excluded.score,
      centre_id = excluded.centre_id,
      recorded_by = excluded.recorded_by;
  end if;

  insert into public.five_s_group_notes (player_id, category, group_name, centre_id, remarks, recorded_by)
  select
    (g->>''player_id'')::uuid,
    (g->>''category'')::public.five_s_category,
    g->>''group_name'',
    (g->>''centre_id'')::uuid,
    g->>''remarks'',
    (g->>''recorded_by'')::uuid
  from jsonb_array_elements(p_group_notes) as g
  on conflict (player_id, category, group_name) do update set
    remarks = excluded.remarks,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();

  insert into public.five_s_category_notes (player_id, category, centre_id, remarks, recorded_by)
  values (
    (p_category_note->>''player_id'')::uuid,
    (p_category_note->>''category'')::public.five_s_category,
    (p_category_note->>''centre_id'')::uuid,
    p_category_note->>''remarks'',
    (p_category_note->>''recorded_by'')::uuid
  )
  on conflict (player_id, category) do update set
    remarks = excluded.remarks,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();
end;
$$","grant execute on function public.submit_skill_scores(jsonb, jsonb, jsonb) to authenticated"}', 'atomic_skill_scores_submit')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260804000000', '{"-- Product now wants centre_admin able to change any of its own centre''s
-- managed accounts'' role (Administrator Management > edit > Role), applied
-- immediately since role is read fresh from profiles on every request (see
-- verifySession). prevent_role_escalation (20260731010000) currently blocks
-- *any* role change by a centre_admin unconditionally â€” that was closing a
-- real escalation gap (raw client could promote straight to centre_admin or
-- worse), not ruling out this feature. Narrow it instead of removing it:
-- still block centre_id changes, and still block any role transition that
-- touches a role outside the set centre_admin already manages (see the
-- \"centre_admin manages own centre staff\" policy, 20260803150000) â€” that
-- keeps super_admin/parent unreachable via this path â€” but allow reassigning
-- within that managed set (centre_admin/coach/medical/staff/finance).
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() = ''centre_admin'' then
    if new.centre_id is distinct from old.centre_id then
      raise exception ''Only a super admin can change a profile''''s centre.'';
    end if;

    if new.role is distinct from old.role
       and (
         old.role not in (''centre_admin'', ''coach'', ''medical'', ''staff'', ''finance'')
         or new.role not in (''centre_admin'', ''coach'', ''medical'', ''staff'', ''finance'')
       ) then
      raise exception ''Only a super admin can change a profile''''s role.'';
    end if;
  end if;
  return new;
end;
$$"}', 'allow_centre_admin_role_changes')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805000000', '{"-- Foundation for Resend email tracking. Nothing writes to this table yet
-- (sendAccountInviteEmail in src/lib/email/send.ts doesn''t log here) â€” this
-- migration only lays down the schema so a future webhook handler
-- (Resend -> POST /api/webhooks/resend) and the send call sites have
-- somewhere to record delivery status.
--
-- One row per send attempt. Status is the current/most-recently-known state
-- from Resend''s webhook events; the per-event timestamp columns preserve the
-- full lifecycle (an email can be delivered *and* later opened *and* later
-- clicked -- collapsing that into a single `status` column would lose
-- whichever event isn''t the most recent one).
create type public.email_status as enum (
  ''sent'',
  ''delivered'',
  ''opened'',
  ''clicked'',
  ''bounced'',
  ''failed'',
  ''complained''
)","create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  -- Resend''s id for the send (their /emails response, and the `data.id` on
  -- every webhook event) -- how an incoming webhook maps back to this row.
  -- Null for sends that failed before Resend returned one.
  resend_email_id text,
  -- App-defined purpose of the email (e.g. ''account_invite'',
  -- ''password_reset'') -- free text rather than an enum since this set is
  -- expected to grow as more transactional emails are added.
  email_type text not null,
  -- The actual subject line sent, for display in the email log (see
  -- email-analytics) -- nullable rather than derived from email_type at
  -- read time, since two emails of the same type won''t always share a
  -- subject forever (e.g. once send.ts''s copy diverges per type).
  subject text,
  recipient_email text not null,
  -- Nullable: on delete set null keeps the log row (and its delivery
  -- history) around as an audit trail even if the profile is later removed.
  recipient_profile_id uuid references public.profiles (id) on delete set null,
  centre_id uuid references public.centres (id) on delete set null,
  status public.email_status not null default ''sent'',
  -- Bounce/complaint/failure detail from the webhook payload, if any.
  error_message text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  complained_at timestamptz,
  -- Resend fires a separate webhook event per open/click (e.g. re-opening
  -- an email, clicking multiple links) -- opened_at/clicked_at only capture
  -- the first occurrence, these counters track how many.
  open_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)","-- Partial (nulls excluded) so multiple failed-before-Resend-returned-an-id
-- rows don''t collide, while still guaranteeing one row per real Resend send
-- for webhook mapping.
create unique index email_logs_resend_email_id_idx on public.email_logs (resend_email_id) where resend_email_id is not null","create index email_logs_recipient_profile_id_idx on public.email_logs (recipient_profile_id)","-- Composite, not a lone centre_id index: every analytics query filters by
-- centre_id and a sent_at range together (see email-analytics), and orders
-- by sent_at by default â€” same reasoning as payments_centre_id_payment_date_idx.
create index email_logs_centre_id_sent_at_idx on public.email_logs (centre_id, sent_at desc)","create index email_logs_recipient_email_idx on public.email_logs (recipient_email)","create index email_logs_status_idx on public.email_logs (status)","create trigger set_updated_at before update on public.email_logs
  for each row execute function public.set_updated_at()","alter table public.email_logs enable row level security","-- Writes come exclusively from server-side code on the service-role client
-- (the send call site, and the future webhook handler) -- both bypass RLS,
-- so no insert/update policy is needed for any authenticated role, same as
-- the auth-sync trigger writing `profiles`. Only read policies below.
create policy \"super_admin full access to email_logs\" on public.email_logs
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin views own centre email_logs\" on public.email_logs
  for select using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )"}', 'email_logs')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805010000', '{"-- Backs the event-handling side of the Resend webhook
-- (src/app/api/webhooks/resend). Two pieces:
--
-- 1. email_webhook_events: an idempotency guard. Resend (via Svix) redelivers
--    a webhook on timeout or a non-2xx response, so the same event can arrive
--    more than once carrying the same svix delivery id. That matters here
--    specifically because open_count/click_count are \"+1 per event\" counters
--    (a recipient genuinely opening an email twice must count twice) --
--    there''s no way to tell a real second open apart from a redelivered
--    first one except by remembering which delivery ids were already
--    processed.
--
-- 2. record_email_event: does the lookup-by-resend_email_id and the
--    conditional column updates as one atomic statement, so a duplicate
--    delivery that loses the email_webhook_events race never touches
--    email_logs at all, and a genuine update can''t race with itself.
create table public.email_webhook_events (
  webhook_event_id text primary key,
  received_at timestamptz not null default now()
)","alter table public.email_webhook_events enable row level security","create policy \"super_admin full access to email_webhook_events\" on public.email_webhook_events
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","-- security definer, matching revoke_user_sessions: called exclusively by the
-- webhook route on the service-role client, never by a logged-in user, so
-- there''s no caller-RLS to preserve the way toggle_gate_pass/
-- submit_skill_scores deliberately stay security invoker.
create or replace function public.record_email_event(
  p_webhook_event_id text,
  p_resend_email_id text,
  p_event_type public.email_status,
  p_error_message text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- First writer wins: if this delivery id was already recorded, the
  -- conflict means FOUND is false below and we return before touching
  -- email_logs a second time.
  insert into public.email_webhook_events (webhook_event_id)
  values (p_webhook_event_id)
  on conflict (webhook_event_id) do nothing;

  if not found then
    return;
  end if;

  update public.email_logs
  set
    status = p_event_type,
    delivered_at = case when p_event_type = ''delivered'' then now() else delivered_at end,
    -- opened_at/clicked_at capture only the first occurrence; open_count/
    -- click_count below track every one.
    opened_at = case when p_event_type = ''opened'' then coalesce(opened_at, now()) else opened_at end,
    clicked_at = case when p_event_type = ''clicked'' then coalesce(clicked_at, now()) else clicked_at end,
    bounced_at = case when p_event_type = ''bounced'' then now() else bounced_at end,
    failed_at = case when p_event_type = ''failed'' then now() else failed_at end,
    complained_at = case when p_event_type = ''complained'' then now() else complained_at end,
    open_count = open_count + case when p_event_type = ''opened'' then 1 else 0 end,
    click_count = click_count + case when p_event_type = ''clicked'' then 1 else 0 end,
    error_message = coalesce(p_error_message, error_message)
  where resend_email_id = p_resend_email_id;

  if not found then
    raise warning ''record_email_event: no email_logs row for resend_email_id %'', p_resend_email_id;
  end if;
end;
$$","revoke all on function public.record_email_event(text, text, public.email_status, text) from public","grant execute on function public.record_email_event(text, text, public.email_status, text) to service_role"}', 'email_webhook_event_processing')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805020000', '{"-- Backs the Centre Admin / Super Admin Email Analytics dashboards. Same
-- reasoning as payments_by_month: counting sent/delivered/opened/clicked/
-- bounced/failed/complained for a date range is a single-pass aggregate --
-- doing it by pulling every email_logs row for the window into JS and
-- counting there would transfer every row over the wire for no reason.
--
-- Counts come from the per-event timestamp columns (delivered_at is not
-- null, etc.), not the `status` column -- status is only the *current*
-- state (see email_logs''s own migration comment), so counting by status
-- would undercount e.g. \"Delivered\" for any email that was later opened
-- (status has since moved on to ''opened'').
--
-- security invoker (the default) deliberately, not definer -- matching
-- payments_by_month: this runs as the calling user, so the existing RLS
-- policies on email_logs (\"centre_admin views own centre email_logs\" /
-- \"super_admin full access to email_logs\") still scope the result exactly
-- as a direct select would. p_centre_id is an additional, explicit filter
-- on top of that -- not a substitute for it -- so a bug in how a caller
-- resolves p_centre_id still can''t leak another centre''s counts.
create or replace function public.email_analytics_summary(
  p_centre_id uuid,
  p_since timestamptz,
  p_until timestamptz
) returns table (
  sent_count bigint,
  delivered_count bigint,
  opened_count bigint,
  clicked_count bigint,
  bounced_count bigint,
  failed_count bigint,
  complained_count bigint
)
language sql
stable
as $$
  select
    count(*) filter (where sent_at is not null) as sent_count,
    count(*) filter (where delivered_at is not null) as delivered_count,
    count(*) filter (where opened_at is not null) as opened_count,
    count(*) filter (where clicked_at is not null) as clicked_count,
    count(*) filter (where bounced_at is not null) as bounced_count,
    count(*) filter (where failed_at is not null) as failed_count,
    count(*) filter (where complained_at is not null) as complained_count
  from public.email_logs
  where centre_id = p_centre_id
    and sent_at >= p_since
    and sent_at < p_until;
$$","grant execute on function public.email_analytics_summary(uuid, timestamptz, timestamptz) to authenticated"}', 'email_analytics_summary')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805030000', '{"-- Foundation for the Monthly Highlights module. Highlight content
-- (title/description/image) is centre-agnostic; which centre(s) it''s
-- visible in is a separate many-to-many mapping (monthly_highlight_centres)
-- so a Super Admin can publish one highlight to several centres at once,
-- while a Centre Admin''s own highlights are auto-linked to just their own
-- centre (resolved server-side from the authenticated session -- the
-- client never supplies a centre UUID directly, same as every other
-- centre-scoped write in this app). No dashboard integration or automatic
-- cleanup job yet -- this migration only lays down the schema, RLS, and
-- expiry rule; the management module (create/edit/delete UI) is built on
-- top of it.

create table public.monthly_highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_path text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Declarative 30-day expiry, no start_date/end_date and no cleanup job:
  -- a generated column keeps the rule in one place instead of every future
  -- reader reimplementing the same interval math against created_at.
  expires_at timestamptz not null default (now() + interval ''30 days'')
)","create index monthly_highlights_created_by_idx on public.monthly_highlights (created_by)","create index monthly_highlights_expires_at_idx on public.monthly_highlights (expires_at)","alter table public.monthly_highlights enable row level security","create policy \"super_admin full access to monthly_highlights\" on public.monthly_highlights
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","-- A Centre Admin manages ANY highlight published to their centre (not just
-- ones they personally created â€” e.g. a highlight a Super Admin published
-- to them too), via a subquery into monthly_highlight_centres. `created_by
-- = auth.uid()` is kept as an alternate branch specifically for the moment
-- a highlight is first inserted: at INSERT time no monthly_highlight_centres
-- row exists yet (it''s created in a second statement right after), and
-- Postgres filters INSERT ... RETURNING through this same SELECT-shaped
-- USING clause -- without this branch, a Centre Admin''s own just-created
-- row would come back empty from the insert and the app could never learn
-- its id to create the link row. WITH CHECK only re-asserts the role, not
-- created_by, so editing a highlight originally created by someone else
-- (e.g. a Super Admin''s) still passes on UPDATE.

-- ============================================================
-- Monthly highlight <-> centre publish mapping
--
-- Never subqueries monthly_highlights: the policy above already subqueries
-- *this* table, and a policy here that subqueried monthly_highlights back
-- would create a genuine A-references-B, B-references-A cycle -- documented
-- on parent_player_links in the core schema migration. Postgres''s RLS
-- rewriter detects that cycle structurally and fails every query on either
-- table with \"infinite recursion detected in policy for relation ...\".
-- created_by is kept purely as an audit column (who published this link),
-- same as gate_pass_logs.performed_by / injuries.reported_by elsewhere --
-- not used for scoping here, since a Centre Admin manages links for their
-- centre regardless of who created them (mirrors the monthly_highlights
-- policy above).
-- ============================================================
create table public.monthly_highlight_centres (
  highlight_id uuid not null references public.monthly_highlights (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (highlight_id, centre_id)
)","create index monthly_highlight_centres_centre_id_idx on public.monthly_highlight_centres (centre_id)","alter table public.monthly_highlight_centres enable row level security","create policy \"super_admin full access to monthly_highlight_centres\" on public.monthly_highlight_centres
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin manages own centre highlight links\" on public.monthly_highlight_centres
  for all using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )","create policy \"centre_admin manages own or centre-published monthly_highlights\" on public.monthly_highlights
  for all using (
    private.user_role() = ''centre_admin''
    and (
      created_by = auth.uid()
      or id in (
        select highlight_id
        from public.monthly_highlight_centres
        where centre_id = private.user_centre_id()
      )
    )
  )
  with check (
    private.user_role() = ''centre_admin''
  )"}', 'monthly_highlights')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805040000', '{"-- Sister module to Monthly Highlights (20260805030000_monthly_highlights.sql)
-- â€” same shape (a content table + a `<table>_centres` many-to-many publish
-- mapping), same expiry rule, same RLS design. Reusing that structure
-- deliberately instead of inventing a new one: everything documented there
-- about the INSERT/RETURNING visibility branch and the A-references-B,
-- B-references-A RLS cycle applies identically here, so comments below only
-- note what''s different (type/event_date, no image).

create type public.news_event_type as enum (''upcoming_event'', ''news_announcement'')","create table public.news_events (
  id uuid primary key default gen_random_uuid(),
  type public.news_event_type not null,
  title text not null,
  description text,
  -- Required for upcoming_event, must be absent for news_announcement â€” a
  -- CHECK constraint backstops the client-side form''s conditional field the
  -- same way the app never trusts the client for centre scoping.
  event_date date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval ''30 days''),
  constraint event_date_matches_type check (
    (type = ''upcoming_event'' and event_date is not null)
    or (type = ''news_announcement'' and event_date is null)
  )
)","create index news_events_created_by_idx on public.news_events (created_by)","create index news_events_expires_at_idx on public.news_events (expires_at)","alter table public.news_events enable row level security","create policy \"super_admin full access to news_events\" on public.news_events
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create table public.news_event_centres (
  news_event_id uuid not null references public.news_events (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (news_event_id, centre_id)
)","create index news_event_centres_centre_id_idx on public.news_event_centres (centre_id)","alter table public.news_event_centres enable row level security","create policy \"super_admin full access to news_event_centres\" on public.news_event_centres
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin manages own centre news_event links\" on public.news_event_centres
  for all using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )","create policy \"centre_admin manages own or centre-published news_events\" on public.news_events
  for all using (
    private.user_role() = ''centre_admin''
    and (
      created_by = auth.uid()
      or id in (
        select news_event_id
        from public.news_event_centres
        where centre_id = private.user_centre_id()
      )
    )
  )
  with check (
    private.user_role() = ''centre_admin''
  )"}', 'news_events')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805050000', '{"-- Per-user \"hide from my dashboard feed\" marker for News & Events and
-- Monthly Highlights. Dismissing never touches the underlying item â€” it
-- stays visible to every other user, and unchanged in the admin management
-- tables (getNewsEvents/getMonthlyHighlights only filter dismissals when
-- explicitly asked to, which the dashboard feed does and the management
-- tables never do). One table per content type, mirroring the
-- <table>_centres pattern, rather than a single polymorphic table â€” keeps a
-- real FK (and its on-delete cascade) instead of a loose item_id/item_type
-- pair, consistent with keeping these two features fully parallel.

create table public.news_event_dismissals (
  news_event_id uuid not null references public.news_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (news_event_id, user_id)
)","alter table public.news_event_dismissals enable row level security","create policy \"users manage own news_event dismissals\" on public.news_event_dismissals
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid())","create table public.monthly_highlight_dismissals (
  monthly_highlight_id uuid not null references public.monthly_highlights (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (monthly_highlight_id, user_id)
)","alter table public.monthly_highlight_dismissals enable row level security","create policy \"users manage own monthly_highlight dismissals\" on public.monthly_highlight_dismissals
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid())"}', 'dashboard_item_dismissals')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805060000', '{"-- News & Events and Monthly Highlights launched (20260805040000,
-- 20260805030000) with read access for only super_admin and centre_admin â€”
-- every other role that can see a dashboard was missed, unlike every other
-- table, which got broadened read access for staff/finance in
-- 20260803140000 and for coach/medical/parent case-by-case throughout
-- 20260727125052. This backfills the same \"own centre\" read visibility
-- coach/staff/finance already have elsewhere, plus a parent variant scoped
-- to their linked children''s centres via parent_player_links.centre_id â€”
-- the denormalized column documented on that table specifically so RLS here
-- never has to subquery players (which would recreate the A-references-B,
-- B-references-A cycle already documented there).

create policy \"centre_staff views own centre news_events\" on public.news_events
  for select using (
    private.user_role() in (''coach'', ''medical'', ''staff'', ''finance'')
    and id in (
      select news_event_id from public.news_event_centres
      where centre_id = private.user_centre_id()
    )
  )","create policy \"centre_staff views own centre news_event_centres\" on public.news_event_centres
  for select using (
    private.user_role() in (''coach'', ''medical'', ''staff'', ''finance'')
    and centre_id = private.user_centre_id()
  )","create policy \"parents view own children''s centres news_events\" on public.news_events
  for select using (
    private.user_role() = ''parent''
    and id in (
      select news_event_id from public.news_event_centres
      where centre_id in (
        select centre_id from public.parent_player_links where parent_id = auth.uid()
      )
    )
  )","create policy \"parents view own children''s centres news_event_centres\" on public.news_event_centres
  for select using (
    private.user_role() = ''parent''
    and centre_id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  )","create policy \"centre_staff views own centre monthly_highlights\" on public.monthly_highlights
  for select using (
    private.user_role() in (''coach'', ''medical'', ''staff'', ''finance'')
    and id in (
      select highlight_id from public.monthly_highlight_centres
      where centre_id = private.user_centre_id()
    )
  )","create policy \"centre_staff views own centre monthly_highlight_centres\" on public.monthly_highlight_centres
  for select using (
    private.user_role() in (''coach'', ''medical'', ''staff'', ''finance'')
    and centre_id = private.user_centre_id()
  )","create policy \"parents view own children''s centres monthly_highlights\" on public.monthly_highlights
  for select using (
    private.user_role() = ''parent''
    and id in (
      select highlight_id from public.monthly_highlight_centres
      where centre_id in (
        select centre_id from public.parent_player_links where parent_id = auth.uid()
      )
    )
  )","create policy \"parents view own children''s centres monthly_highlight_centres\" on public.monthly_highlight_centres
  for select using (
    private.user_role() = ''parent''
    and centre_id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  )"}', 'news_events_monthly_highlights_broader_read_access')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260805070000', '{"-- 20260805060000 gave parents read access to news_events/monthly_highlights
-- and their _centres mapping tables, but missed that both queries also
-- embed centres(id, name) â€” without a policy here, RLS blocks that
-- embedded row and PostgREST returns null for it instead of omitting the
-- parent row entirely, which crashed TargetCentresBadges on a null centre.
-- Same \"own children''s centres\" scoping as those policies, via
-- parent_player_links.centre_id.

create policy \"parents view own children''s centres\" on public.centres
  for select using (
    private.user_role() = ''parent''
    and id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  )"}', 'parents_view_own_children_centres')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260807000000', '{"-- Age Category names (e.g. \"Cubs\", \"U12\") are an arbitrary label chosen by
-- each centre and don''t reliably map to a real age. The 5S Model needs the
-- actual numeric age behind a category, so add it alongside the name.
-- Nullable: existing categories keep working until a centre_admin edits
-- them in; the app enforces the 4-20 dropdown for new/renamed entries.

alter table public.age_categories
  add column age smallint,
  add constraint age_categories_age_range check (age is null or (age between 4 and 20))"}', 'age_categories_age_number')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260807010000', '{"-- Widen the age_categories.age range to 25 (was 4-20) per updated product
-- requirement.

alter table public.age_categories
  drop constraint age_categories_age_range,
  add constraint age_categories_age_range check (age is null or (age between 4 and 25))"}', 'age_categories_age_range_25')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260808000000', '{"-- Speed benchmark scoring: super_admin sets Min/Max/Avg per test per age
-- band (e.g. \"10m Sprint\" at U13 = 2.3s-3.2s, avg 2.75s). category is on
-- the band itself (not a separate join) so Stamina/Strength/Skill can
-- define their own bands later without redesigning this table; only
-- ''speed'' is seeded for now per product decision to go category-by-category.

create table public.five_s_age_bands (
  id uuid primary key default gen_random_uuid(),
  category public.five_s_category not null,
  label text not null,
  min_age smallint not null,
  max_age smallint,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category, label),
  constraint five_s_age_bands_range check (
    min_age >= 4 and (max_age is null or max_age >= min_age)
  )
)","create table public.five_s_test_benchmarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  age_band_id uuid not null references public.five_s_age_bands (id) on delete cascade,
  min_value numeric(6, 2) not null,
  max_value numeric(6, 2) not null,
  avg_value numeric(6, 2) not null,
  updated_at timestamptz not null default now(),
  unique (test_id, age_band_id),
  constraint five_s_test_benchmarks_range check (
    min_value <= max_value and avg_value between min_value and max_value
  )
)","create index five_s_age_bands_category_idx on public.five_s_age_bands (category)","create index five_s_test_benchmarks_test_id_idx on public.five_s_test_benchmarks (test_id)","create trigger set_updated_at before update on public.five_s_test_benchmarks
  for each row execute function public.set_updated_at()","alter table public.five_s_age_bands enable row level security","alter table public.five_s_test_benchmarks enable row level security","-- Reference data, same visibility as five_s_tests: any signed-in user may
-- eventually need band labels, only super_admin edits them.
create policy \"authenticated can view five_s_age_bands\" on public.five_s_age_bands
  for select using (auth.uid() is not null)","create policy \"super_admin manages five_s_age_bands\" on public.five_s_age_bands
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","-- Benchmarks aren''t consumed anywhere yet (scoring wiring is a later step),
-- so keep them super_admin-only until a reader role actually needs them.
create policy \"super_admin full access to five_s_test_benchmarks\" on public.five_s_test_benchmarks
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","grant select, insert, update, delete on public.five_s_age_bands, public.five_s_test_benchmarks
  to authenticated, service_role","insert into public.five_s_age_bands (category, label, min_age, max_age, display_order) values
  (''speed'', ''U10'', 4, 10, 1),
  (''speed'', ''U13'', 11, 13, 2),
  (''speed'', ''U15'', 14, 15, 3),
  (''speed'', ''U18'', 16, 18, 4),
  (''speed'', ''>18'', 19, null, 5)"}', 'five_s_speed_benchmarks')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260808010000', '{"-- Relabel Speed''s age bands as explicit ranges instead of \"U\" prefixes, per
-- product decision. Boundaries are unchanged (U10=4-10, U13=11-13,
-- U15=14-15, U18=16-18, >18=19-25) â€” the shared boundary age (10/13/15/18)
-- stays owned by the lower band, same as before.

update public.five_s_age_bands set label = ''<10'' where category = ''speed'' and label = ''U10''","update public.five_s_age_bands set label = ''10-13'' where category = ''speed'' and label = ''U13''","update public.five_s_age_bands set label = ''13-15'' where category = ''speed'' and label = ''U15''","update public.five_s_age_bands set label = ''15-18'' where category = ''speed'' and label = ''U18''"}', 'five_s_speed_age_band_labels')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260809000000', '{"-- Beep Test scores are Level/Shuttle pairs (e.g. \"4/1\"), not a single
-- decimal â€” both numbers are independently meaningful and must be compared
-- lexicographically (level first, shuttle as tiebreaker), so they can''t be
-- squeezed into the existing single `score` column. score becomes optional
-- so Beep Test rows can leave it null and use level/shuttle instead; every
-- other test (Cooper, Speed, Strength, Skill) keeps using score as before.

alter table public.five_s_results
  alter column score drop not null,
  add column level smallint,
  add column shuttle smallint,
  add constraint five_s_results_score_or_level_shuttle check (
    score is not null or (level is not null and shuttle is not null)
  )"}', 'five_s_results_level_shuttle')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260809010000', '{"-- Stamina benchmarks: Poor/Average/Elite bands per test per age, unlike
-- Speed''s single Min/Max/Avg. Each (test, age_band) has 4 threshold
-- points â€” poor_ceiling, average_low, average_high, elite_floor â€” dividing
-- a coach''s raw result into 5 zones (below poor_ceiling = 1 ... above
-- elite_floor = 5). Stored as one row per point (not 4 wide columns) since
-- a point is either a plain number (Cooper, metres) or a Level/Shuttle pair
-- (Beep Test) â€” exactly one of `value` or (`level` + `shuttle`) is set.
--
-- Reuses five_s_age_bands (already seeded for ''speed'') with the same
-- boundaries for ''stamina''.

create type public.five_s_benchmark_tier as enum (
  ''poor_ceiling'', ''average_low'', ''average_high'', ''elite_floor''
)","create table public.five_s_stamina_benchmarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  age_band_id uuid not null references public.five_s_age_bands (id) on delete cascade,
  tier public.five_s_benchmark_tier not null,
  value numeric(7, 2),
  level smallint,
  shuttle smallint,
  updated_at timestamptz not null default now(),
  unique (test_id, age_band_id, tier),
  constraint five_s_stamina_benchmarks_shape check (
    (value is not null and level is null and shuttle is null)
    or (value is null and level is not null and shuttle is not null)
  )
)","create index five_s_stamina_benchmarks_test_id_idx on public.five_s_stamina_benchmarks (test_id)","create trigger set_updated_at before update on public.five_s_stamina_benchmarks
  for each row execute function public.set_updated_at()","alter table public.five_s_stamina_benchmarks enable row level security","-- Unlike five_s_test_benchmarks (Speed, not wired into scoring yet), this
-- one is read by computeFiveSScores for coach/parent/centre_admin score
-- displays, so any signed-in user needs select â€” only super_admin edits.
create policy \"authenticated can view five_s_stamina_benchmarks\" on public.five_s_stamina_benchmarks
  for select using (auth.uid() is not null)","create policy \"super_admin manages five_s_stamina_benchmarks\" on public.five_s_stamina_benchmarks
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","grant select, insert, update, delete on public.five_s_stamina_benchmarks to authenticated, service_role","insert into public.five_s_age_bands (category, label, min_age, max_age, display_order) values
  (''stamina'', ''<10'', 4, 10, 1),
  (''stamina'', ''10-13'', 11, 13, 2),
  (''stamina'', ''13-15'', 14, 15, 3),
  (''stamina'', ''15-18'', 16, 18, 4),
  (''stamina'', ''>18'', 19, null, 5)"}', 'five_s_stamina_benchmarks')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260809020000', '{"-- Players can now belong to multiple batches (each batch has its own coach
-- and its own attendance calendar). players.batch_id stays as the *primary*
-- batch â€” player lists, filters, dashboards, and the parent-facing views
-- keep reading it unchanged. This new table is the full membership (the
-- primary batch''s row lives here too) and becomes the source of truth for
-- every coach-facing \"does this player belong to one of my batches?\" check:
-- rosters, attendance, 5S, and injuries.
--
-- Denormalizes centre_id (same reasoning as five_s_results, see
-- 20260728000000_five_s_model.sql) so RLS never needs to subquery players
-- for it.

create table public.player_batches (
  player_id uuid not null references public.players (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, batch_id)
)","create index player_batches_batch_id_idx on public.player_batches (batch_id)","create index player_batches_centre_id_idx on public.player_batches (centre_id)","insert into public.player_batches (player_id, batch_id, centre_id)
select id, batch_id, centre_id from public.players where batch_id is not null
on conflict do nothing","alter table public.player_batches enable row level security","create policy \"super_admin full access to player_batches\" on public.player_batches
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin manages own centre player_batches\" on public.player_batches
  for all using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )","create policy \"coach views own batches player_batches\" on public.player_batches
  for select using (
    private.user_role() = ''coach''
    and batch_id in (select id from public.batches where head_coach_id = auth.uid())
  )","create policy \"medical views own centre player_batches\" on public.player_batches
  for select using (
    private.user_role() = ''medical'' and centre_id = private.user_centre_id()
  )","create policy \"staff_finance views own centre player_batches\" on public.player_batches
  for select using (
    private.user_role() in (''staff'', ''finance'') and centre_id = private.user_centre_id()
  )","grant select, insert, update, delete on public.player_batches to authenticated, service_role","-- ============================================================
-- Swap every \"player belongs to this coach''s batch\" check from
-- players.batch_id (single, primary-only) to player_batches (full
-- membership). Same ownership-tying pattern as the attendance IDOR fix
-- (20260731020000_fix_attendance_idor.sql) â€” player_id and batch_id are
-- always tied together through the join, never checked independently.

drop policy \"coach views players in own batches\" on public.players","create policy \"coach views players in own batches\" on public.players
  for select using (
    private.user_role() = ''coach''
    and id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages attendance for own batches\" on public.attendance","create policy \"coach manages attendance for own batches\" on public.attendance
  for all using (
    private.user_role() = ''coach''
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages five_s_reports for own batch players\" on public.five_s_reports","create policy \"coach manages five_s_reports for own batch players\" on public.five_s_reports
  for all using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages five_s_category_notes for own batch players\" on public.five_s_category_notes","create policy \"coach manages five_s_category_notes for own batch players\" on public.five_s_category_notes
  for all using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages five_s_group_notes for own batch players\" on public.five_s_group_notes","create policy \"coach manages five_s_group_notes for own batch players\" on public.five_s_group_notes
  for all using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages five_s_question_responses for own batch players\" on public.five_s_question_responses","create policy \"coach manages five_s_question_responses for own batch players\" on public.five_s_question_responses
  for all using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","drop policy \"coach manages injuries for own batch players\" on public.injuries","create policy \"coach manages injuries for own batch players\" on public.injuries
  for all using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","-- ============================================================
-- five_s_results: a player can now be tested by more than one coach (one
-- per batch), but only one result may exist per (player, test) â€” see the
-- existing unique(player_id, test_id). Whoever records a test first \"wins\";
-- it''s frozen for every other coach from then on. Splitting the previous
-- single \"for all\" policy into select/insert/update makes that enforceable:
-- SELECT stays open to every coach across the player''s batches (so a locked
-- test still shows read-only), but INSERT/UPDATE additionally require
-- recorded_by = auth.uid() â€” checked against the pre-existing row on the
-- UPDATE path, so a second coach''s upsert conflicts into a row they don''t
-- own and is rejected by RLS rather than silently overwriting it. No
-- coach-facing delete policy (none existed before either â€” least
-- privilege); submit_skill_scores (20260803160000) is not `security
-- definer`, so it runs as the caller and these policies apply to it too.

drop policy \"coach manages five_s_results for own batch players\" on public.five_s_results","create policy \"coach views five_s_results for own batch players\" on public.five_s_results
  for select using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","create policy \"coach inserts five_s_results for own batch players\" on public.five_s_results
  for insert with check (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )","create policy \"coach updates own five_s_results\" on public.five_s_results
  for update using (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )"}', 'player_batches')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260811000000', '{"-- Adding a player (with a package or custom package) never created a
-- `payments` row, so the dashboard''s \"Payments\" chart and the Payment
-- History page stayed empty until a centre_admin separately used \"Add
-- Payment\". `is_registration_payment` marks the one payment row that
-- represents a player''s package assignment (created alongside the player,
-- kept in sync -- not duplicated -- whenever their package changes later),
-- as opposed to ad-hoc payments recorded from the Payments page. The
-- partial unique index enforces \"at most one\" at the database level instead
-- of trusting application code alone.
alter table public.payments
  add column is_registration_payment boolean not null default false","create unique index payments_one_registration_per_player_idx
  on public.payments (player_id)
  where is_registration_payment","-- Audit trail for package assignment changes on a player (initial
-- assignment at creation, plus every later change from Edit Player / the
-- Parent Profile tab), shown on the player''s Package Details section so a
-- centre_admin can see when and what changed. Snapshots old/new package
-- name + amount as plain columns rather than package_id FKs: a custom
-- package is updated in place (see resolvePackageId in players/actions.ts),
-- so an old package_id would just show today''s values instead of what was
-- true at the time of the change.
create table public.package_change_logs (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  old_package_name text,
  old_amount numeric(10, 2),
  new_package_name text,
  new_amount numeric(10, 2),
  changed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
)","create index package_change_logs_player_id_idx on public.package_change_logs (player_id)","create index package_change_logs_centre_id_created_at_idx on public.package_change_logs (centre_id, created_at)","alter table public.package_change_logs enable row level security","create policy \"super_admin full access to package_change_logs\" on public.package_change_logs
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin manages own centre package_change_logs\" on public.package_change_logs
  for all using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )","create policy \"staff_finance views own centre package_change_logs\" on public.package_change_logs
  for select using (
    private.user_role() in (''staff'', ''finance'') and centre_id = private.user_centre_id()
  )","grant select, insert, update, delete on public.package_change_logs to authenticated, service_role"}', 'registration_payments_and_package_logs')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260812000000', '{"-- Foundation for Route Mobile WhatsApp send tracking (Phase 1: the
-- new-player onboarding welcome message only). One row per send attempt,
-- written exclusively by src/lib/whatsapp/send.ts on the service-role
-- client -- same \"server writes, RLS only gates reads\" shape as
-- email_logs. No per-status-event timestamps yet (Phase 2''s Route Mobile
-- callback handler will need its own migration once that''s implemented --
-- deliberately not building ahead of it here).
create type public.whatsapp_status as enum (
  ''sent'',
  ''failed'',
  ''skipped''
)","create table public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  -- Nullable: the WhatsApp number lives on the player row regardless of
  -- whether the parent profile link succeeded (see resolveParentProfileId
  -- in players/actions.ts) -- on delete set null keeps the log row around
  -- as an audit trail if the profile is later removed.
  parent_profile_id uuid references public.profiles (id) on delete set null,
  -- The normalized (+E.164) number actually sent to, not necessarily
  -- identical to the raw stored players.parent_contact_number value.
  recipient_phone text not null,
  template_name text not null,
  -- Route Mobile''s request_id from a 202 Accepted response -- confirms
  -- only that they *accepted* the message for processing, not delivery.
  -- Null for ''failed''/''skipped'' rows that never got one.
  route_mobile_request_id text,
  status public.whatsapp_status not null,
  error_message text,
  created_at timestamptz not null default now()
)","-- Partial (nulls excluded), mirrors email_logs_resend_email_id_idx -- lets
-- a future Phase 2 webhook map a callback back to this row by request_id.
create unique index whatsapp_logs_route_mobile_request_id_idx on public.whatsapp_logs (route_mobile_request_id) where route_mobile_request_id is not null","create index whatsapp_logs_player_id_idx on public.whatsapp_logs (player_id)","create index whatsapp_logs_centre_id_created_at_idx on public.whatsapp_logs (centre_id, created_at desc)","create index whatsapp_logs_status_idx on public.whatsapp_logs (status)","alter table public.whatsapp_logs enable row level security","-- Writes come exclusively from src/lib/whatsapp/send.ts on the
-- service-role client, which bypasses RLS -- same reasoning as
-- email_logs. Only read policies below; this is an audit trail, not a
-- user-editable resource.
create policy \"super_admin full access to whatsapp_logs\" on public.whatsapp_logs
  for all using (private.user_role() = ''super_admin'')
  with check (private.user_role() = ''super_admin'')","create policy \"centre_admin views own centre whatsapp_logs\" on public.whatsapp_logs
  for select using (
    private.user_role() = ''centre_admin'' and centre_id = private.user_centre_id()
  )","create policy \"staff_finance views own centre whatsapp_logs\" on public.whatsapp_logs
  for select using (
    private.user_role() in (''staff'', ''finance'') and centre_id = private.user_centre_id()
  )"}', 'whatsapp_logs')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260812010000', '{"-- Coach-entered overall 1-5 (half-star) rating per category, alongside the
-- existing free-text remarks on five_s_category_notes. Skill and Spirit''s
-- existing per-test/per-question entry only ever tracked *completion* (was
-- something filled in), never the actual value entered -- this rating
-- becomes the real radar-graph score for those two categories (see
-- computeFiveSScores in src/lib/five-s/scores.ts), while the detailed
-- sub-test/question entry is unchanged and stays for notes/detail/the PDF
-- report. Speed/Stamina/Strength are untouched by this.
alter table public.five_s_category_notes
  add column rating numeric(3, 1)","alter table public.five_s_category_notes
  add constraint five_s_category_notes_rating_range check (
    rating is null or (rating >= 1 and rating <= 5 and round(rating * 2) = rating * 2)
  )","-- submit_skill_scores (see 20260803160000_atomic_skill_scores_submit.sql)
-- needs to carry the new rating through its p_category_note upsert too --
-- same function, same signature, just one more field written atomically
-- alongside remarks.
create or replace function public.submit_skill_scores(
  p_results jsonb,
  p_group_notes jsonb,
  p_category_note jsonb
) returns void
language plpgsql
as $$
begin
  if jsonb_array_length(p_results) > 0 then
    insert into public.five_s_results (player_id, test_id, centre_id, score, recorded_by)
    select
      (r->>''player_id'')::uuid,
      (r->>''test_id'')::uuid,
      (r->>''centre_id'')::uuid,
      (r->>''score'')::numeric,
      (r->>''recorded_by'')::uuid
    from jsonb_array_elements(p_results) as r
    on conflict (player_id, test_id) do update set
      score = excluded.score,
      centre_id = excluded.centre_id,
      recorded_by = excluded.recorded_by;
  end if;

  insert into public.five_s_group_notes (player_id, category, group_name, centre_id, remarks, recorded_by)
  select
    (g->>''player_id'')::uuid,
    (g->>''category'')::public.five_s_category,
    g->>''group_name'',
    (g->>''centre_id'')::uuid,
    g->>''remarks'',
    (g->>''recorded_by'')::uuid
  from jsonb_array_elements(p_group_notes) as g
  on conflict (player_id, category, group_name) do update set
    remarks = excluded.remarks,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();

  insert into public.five_s_category_notes (player_id, category, centre_id, remarks, rating, recorded_by)
  values (
    (p_category_note->>''player_id'')::uuid,
    (p_category_note->>''category'')::public.five_s_category,
    (p_category_note->>''centre_id'')::uuid,
    p_category_note->>''remarks'',
    (p_category_note->>''rating'')::numeric,
    (p_category_note->>''recorded_by'')::uuid
  )
  on conflict (player_id, category) do update set
    remarks = excluded.remarks,
    rating = excluded.rating,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();
end;
$$"}', 'five_s_category_rating')
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260820000000', '{"-- Optional second coach per batch. Product wants the assistant coach to be
-- a full substitute for the head coach -- same batch visibility, same
-- attendance/5S/injuries access for that batch''s players -- not a lesser
-- role, so every \"coach owns this batch\" RLS check below is widened from
-- `head_coach_id = auth.uid()` to also match `assistant_coach_id`.
--
-- These are the *current* live definitions of each policy (several were
-- already replaced once by 20260809020000_player_batches.sql, which moved
-- the ownership check from players.batch_id to the player_batches join
-- table) -- alter policy updates each in place rather than dropping and
-- recreating, so there''s no window where the policy doesn''t exist.

alter table public.batches
  add column assistant_coach_id uuid references public.profiles (id) on delete set null","alter table public.batches
  add constraint batches_assistant_coach_not_head
  check (assistant_coach_id is null or assistant_coach_id <> head_coach_id)","create index batches_assistant_coach_id_idx on public.batches (assistant_coach_id)","alter policy \"coach views own assigned batches\" on public.batches
  using (
    private.user_role() = ''coach''
    and (head_coach_id = auth.uid() or assistant_coach_id = auth.uid())
  )","alter policy \"coach views own batches player_batches\" on public.player_batches
  using (
    private.user_role() = ''coach''
    and batch_id in (
      select id from public.batches
      where head_coach_id = auth.uid() or assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach views players in own batches\" on public.players
  using (
    private.user_role() = ''coach''
    and id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach manages attendance for own batches\" on public.attendance
  using (
    private.user_role() = ''coach''
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and (b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid())
    )
  )
  with check (
    private.user_role() = ''coach''
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and (b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid())
    )
  )","alter policy \"coach manages injuries for own batch players\" on public.injuries
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach manages five_s_reports for own batch players\" on public.five_s_reports
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach manages five_s_category_notes for own batch players\" on public.five_s_category_notes
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach manages five_s_group_notes for own batch players\" on public.five_s_group_notes
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach manages five_s_question_responses for own batch players\" on public.five_s_question_responses
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach views five_s_results for own batch players\" on public.five_s_results
  using (
    private.user_role() = ''coach''
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach inserts five_s_results for own batch players\" on public.five_s_results
  with check (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )","alter policy \"coach updates own five_s_results\" on public.five_s_results
  using (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = ''coach''
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )"}', 'batch_assistant_coach')
ON CONFLICT (version) DO NOTHING;


COMMIT;

-- ============================================================================
-- PRE-FLIGHT VERIFICATION QUERIES (read-only; run against the TARGET environment FIRST)
-- ============================================================================
-- V1. Current remote history + count (expect 23 rows ending at 20260803150000):
--   SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
--
-- V2. Local versions MISSING from remote (expect EXACTLY the 21 versions
--     backfilled above, i.e. 20260803160000..20260820000000; if this returns
--     anything else, STOP and re-audit before executing this file):
--   WITH local_v(v) AS (
--     VALUES
--       ('20260803160000'),
--       ('20260804000000'),
--       ('20260805000000'),
--       ('20260805010000'),
--       ('20260805020000'),
--       ('20260805030000'),
--       ('20260805040000'),
--       ('20260805050000'),
--       ('20260805060000'),
--       ('20260805070000'),
--       ('20260807000000'),
--       ('20260807010000'),
--       ('20260808000000'),
--       ('20260808010000'),
--       ('20260809000000'),
--       ('20260809010000'),
--       ('20260809020000'),
--       ('20260811000000'),
--       ('20260812000000'),
--       ('20260812010000'),
--       ('20260820000000')
--   )
--   SELECT v FROM local_v
--   WHERE v NOT IN (SELECT version FROM supabase_migrations.schema_migrations)
--   ORDER BY v;
--
-- V3. Duplicate version records (PK makes this impossible; run anyway):
--   SELECT version, count(*) FROM supabase_migrations.schema_migrations
--   GROUP BY version HAVING count(*) > 1;
--
-- V4. Name conflicts for versions that DO exist remotely (expect 0 rows):
--   WITH expected(v, n) AS (
--     VALUES
--       ('20260727125052', 'core_schema'),
--       ('20260727130445', 'grant_data_api_privileges'),
--       ('20260728000000', 'five_s_model'),
--       ('20260728010000', 'five_s_stamina'),
--       ('20260728020000', 'five_s_strength'),
--       ('20260728030000', 'five_s_spirit'),
--       ('20260728040000', 'five_s_skill'),
--       ('20260730000000', 'five_s_results_previous_score'),
--       ('20260730010000', 'five_s_report_publish'),
--       ('20260730020000', 'five_s_testing_window'),
--       ('20260731000000', 'missing_fk_indexes'),
--       ('20260731010000', 'prevent_role_escalation'),
--       ('20260731020000', 'fix_attendance_idor'),
--       ('20260731030000', 'atomic_gate_pass_toggle'),
--       ('20260731040000', 'revoke_user_sessions'),
--       ('20260731050000', 'restrict_centre_admin_centre_columns'),
--       ('20260731060000', 'performance_indexes'),
--       ('20260731070000', 'fix_payments_gate_pass_idor'),
--       ('20260801000000', 'payments_by_month_aggregate'),
--       ('20260803120000', 'custom_player_packages'),
--       ('20260803130000', 'add_staff_finance_roles'),
--       ('20260803140000', 'staff_finance_read_only_access'),
--       ('20260803150000', 'centre_admin_manages_staff_finance'),
--       ('20260803160000', 'atomic_skill_scores_submit'),
--       ('20260804000000', 'allow_centre_admin_role_changes'),
--       ('20260805000000', 'email_logs'),
--       ('20260805010000', 'email_webhook_event_processing'),
--       ('20260805020000', 'email_analytics_summary'),
--       ('20260805030000', 'monthly_highlights'),
--       ('20260805040000', 'news_events'),
--       ('20260805050000', 'dashboard_item_dismissals'),
--       ('20260805060000', 'news_events_monthly_highlights_broader_read_access'),
--       ('20260805070000', 'parents_view_own_children_centres'),
--       ('20260807000000', 'age_categories_age_number'),
--       ('20260807010000', 'age_categories_age_range_25'),
--       ('20260808000000', 'five_s_speed_benchmarks'),
--       ('20260808010000', 'five_s_speed_age_band_labels'),
--       ('20260809000000', 'five_s_results_level_shuttle'),
--       ('20260809010000', 'five_s_stamina_benchmarks'),
--       ('20260809020000', 'player_batches'),
--       ('20260811000000', 'registration_payments_and_package_logs'),
--       ('20260812000000', 'whatsapp_logs'),
--       ('20260812010000', 'five_s_category_rating'),
--       ('20260820000000', 'batch_assistant_coach')
--   )
--   SELECT e.v, e.n, s.name
--   FROM expected e JOIN supabase_migrations.schema_migrations s ON s.version = e.v
--   WHERE s.name IS DISTINCT FROM e.n;
--
-- V5. Post-backfill check (expect 0 rows, i.e. LOCAL == REMOTE):
--   WITH local_v(v) AS (
--     VALUES
--       ('20260727125052'),
--       ('20260727130445'),
--       ('20260728000000'),
--       ('20260728010000'),
--       ('20260728020000'),
--       ('20260728030000'),
--       ('20260728040000'),
--       ('20260730000000'),
--       ('20260730010000'),
--       ('20260730020000'),
--       ('20260731000000'),
--       ('20260731010000'),
--       ('20260731020000'),
--       ('20260731030000'),
--       ('20260731040000'),
--       ('20260731050000'),
--       ('20260731060000'),
--       ('20260731070000'),
--       ('20260801000000'),
--       ('20260803120000'),
--       ('20260803130000'),
--       ('20260803140000'),
--       ('20260803150000'),
--       ('20260803160000'),
--       ('20260804000000'),
--       ('20260805000000'),
--       ('20260805010000'),
--       ('20260805020000'),
--       ('20260805030000'),
--       ('20260805040000'),
--       ('20260805050000'),
--       ('20260805060000'),
--       ('20260805070000'),
--       ('20260807000000'),
--       ('20260807010000'),
--       ('20260808000000'),
--       ('20260808010000'),
--       ('20260809000000'),
--       ('20260809010000'),
--       ('20260809020000'),
--       ('20260811000000'),
--       ('20260812000000'),
--       ('20260812010000'),
--       ('20260820000000')
--   )
--   SELECT v FROM local_v
--   WHERE v NOT IN (SELECT version FROM supabase_migrations.schema_migrations)
--   ORDER BY v;
-- ============================================================================
