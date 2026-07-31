-- 5S report publishing: coaches record scores privately (per product
-- decision) — centre_admin and parents should only see a player's 5S
-- results once the coach explicitly publishes. A row existing in
-- five_s_reports IS the "published" state (no separate boolean needed).
-- Coach access is untouched: they always see their own batch players'
-- data regardless of publish status.

create table public.five_s_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players (id) on delete cascade,
  centre_id uuid not null references public.centres (id) on delete cascade,
  published_by uuid not null references public.profiles (id) on delete restrict,
  published_at timestamptz not null default now()
);

create index five_s_reports_centre_id_idx on public.five_s_reports (centre_id);

alter table public.five_s_reports enable row level security;

create policy "super_admin full access to five_s_reports" on public.five_s_reports
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre five_s_reports" on public.five_s_reports
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach manages five_s_reports for own batch players" on public.five_s_reports
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

create policy "parents view own children's five_s_reports" on public.five_s_reports
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

grant select, insert, update, delete on public.five_s_reports to authenticated, service_role;

-- Gate centre_admin/parent read access on the underlying score data behind
-- publish status. Coach and super_admin policies are untouched.

drop policy "centre_admin views own centre five_s_results" on public.five_s_results;
create policy "centre_admin views own centre five_s_results" on public.five_s_results
  for select using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_results.player_id)
  );

drop policy "parents view own children's five_s_results" on public.five_s_results;
create policy "parents view own children's five_s_results" on public.five_s_results
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_results.player_id)
  );

drop policy "centre_admin views own centre five_s_question_responses" on public.five_s_question_responses;
create policy "centre_admin views own centre five_s_question_responses" on public.five_s_question_responses
  for select using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_question_responses.player_id)
  );

drop policy "parents view own children's five_s_question_responses" on public.five_s_question_responses;
create policy "parents view own children's five_s_question_responses" on public.five_s_question_responses
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_question_responses.player_id)
  );

drop policy "centre_admin views own centre five_s_category_notes" on public.five_s_category_notes;
create policy "centre_admin views own centre five_s_category_notes" on public.five_s_category_notes
  for select using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_category_notes.player_id)
  );

drop policy "parents view own children's five_s_category_notes" on public.five_s_category_notes;
create policy "parents view own children's five_s_category_notes" on public.five_s_category_notes
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_category_notes.player_id)
  );

drop policy "centre_admin views own centre five_s_group_notes" on public.five_s_group_notes;
create policy "centre_admin views own centre five_s_group_notes" on public.five_s_group_notes
  for select using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_group_notes.player_id)
  );

drop policy "parents view own children's five_s_group_notes" on public.five_s_group_notes;
create policy "parents view own children's five_s_group_notes" on public.five_s_group_notes
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_group_notes.player_id)
  );
