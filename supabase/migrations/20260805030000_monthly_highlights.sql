-- Foundation for the Monthly Highlights module. Highlight content
-- (title/description/image) is centre-agnostic; which centre(s) it's
-- visible in is a separate many-to-many mapping (monthly_highlight_centres)
-- so a Super Admin can publish one highlight to several centres at once,
-- while a Centre Admin's own highlights are auto-linked to just their own
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
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index monthly_highlights_created_by_idx on public.monthly_highlights (created_by);
create index monthly_highlights_expires_at_idx on public.monthly_highlights (expires_at);

alter table public.monthly_highlights enable row level security;

create policy "super_admin full access to monthly_highlights" on public.monthly_highlights
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

-- A Centre Admin manages ANY highlight published to their centre (not just
-- ones they personally created — e.g. a highlight a Super Admin published
-- to them too), via a subquery into monthly_highlight_centres. `created_by
-- = auth.uid()` is kept as an alternate branch specifically for the moment
-- a highlight is first inserted: at INSERT time no monthly_highlight_centres
-- row exists yet (it's created in a second statement right after), and
-- Postgres filters INSERT ... RETURNING through this same SELECT-shaped
-- USING clause -- without this branch, a Centre Admin's own just-created
-- row would come back empty from the insert and the app could never learn
-- its id to create the link row. WITH CHECK only re-asserts the role, not
-- created_by, so editing a highlight originally created by someone else
-- (e.g. a Super Admin's) still passes on UPDATE.

-- ============================================================
-- Monthly highlight <-> centre publish mapping
--
-- Never subqueries monthly_highlights: the policy above already subqueries
-- *this* table, and a policy here that subqueried monthly_highlights back
-- would create a genuine A-references-B, B-references-A cycle -- documented
-- on parent_player_links in the core schema migration. Postgres's RLS
-- rewriter detects that cycle structurally and fails every query on either
-- table with "infinite recursion detected in policy for relation ...".
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
);

create index monthly_highlight_centres_centre_id_idx on public.monthly_highlight_centres (centre_id);

alter table public.monthly_highlight_centres enable row level security;

create policy "super_admin full access to monthly_highlight_centres" on public.monthly_highlight_centres
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre highlight links" on public.monthly_highlight_centres
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );


create policy "centre_admin manages own or centre-published monthly_highlights" on public.monthly_highlights
  for all using (
    private.user_role() = 'centre_admin'
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
    private.user_role() = 'centre_admin'
  );