-- Players can now belong to multiple batches (each batch has its own coach
-- and its own attendance calendar). players.batch_id stays as the *primary*
-- batch — player lists, filters, dashboards, and the parent-facing views
-- keep reading it unchanged. This new table is the full membership (the
-- primary batch's row lives here too) and becomes the source of truth for
-- every coach-facing "does this player belong to one of my batches?" check:
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
);

create index player_batches_batch_id_idx on public.player_batches (batch_id);
create index player_batches_centre_id_idx on public.player_batches (centre_id);

insert into public.player_batches (player_id, batch_id, centre_id)
select id, batch_id, centre_id from public.players where batch_id is not null
on conflict do nothing;

alter table public.player_batches enable row level security;

create policy "super_admin full access to player_batches" on public.player_batches
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin manages own centre player_batches" on public.player_batches
  for all using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach views own batches player_batches" on public.player_batches
  for select using (
    private.user_role() = 'coach'
    and batch_id in (select id from public.batches where head_coach_id = auth.uid())
  );

create policy "medical views own centre player_batches" on public.player_batches
  for select using (
    private.user_role() = 'medical' and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre player_batches" on public.player_batches
  for select using (
    private.user_role() = any (array['staff', 'finance']) and centre_id = private.user_centre_id()
  );

grant select, insert, update, delete on public.player_batches to authenticated, service_role;

-- ============================================================
-- Swap every "player belongs to this coach's batch" check from
-- players.batch_id (single, primary-only) to player_batches (full
-- membership). Same ownership-tying pattern as the attendance IDOR fix
-- (20260731020000_fix_attendance_idor.sql) — player_id and batch_id are
-- always tied together through the join, never checked independently.

drop policy "coach views players in own batches" on public.players;
create policy "coach views players in own batches" on public.players
  for select using (
    private.user_role() = 'coach'
    and id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages attendance for own batches" on public.attendance;
create policy "coach manages attendance for own batches" on public.attendance
  for all using (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages five_s_reports for own batch players" on public.five_s_reports;
create policy "coach manages five_s_reports for own batch players" on public.five_s_reports
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages five_s_category_notes for own batch players" on public.five_s_category_notes;
create policy "coach manages five_s_category_notes for own batch players" on public.five_s_category_notes
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages five_s_group_notes for own batch players" on public.five_s_group_notes;
create policy "coach manages five_s_group_notes for own batch players" on public.five_s_group_notes
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages five_s_question_responses for own batch players" on public.five_s_question_responses;
create policy "coach manages five_s_question_responses for own batch players" on public.five_s_question_responses
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

drop policy "coach manages injuries for own batch players" on public.injuries;
create policy "coach manages injuries for own batch players" on public.injuries
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

-- ============================================================
-- five_s_results: a player can now be tested by more than one coach (one
-- per batch), but only one result may exist per (player, test) — see the
-- existing unique(player_id, test_id). Whoever records a test first "wins";
-- it's frozen for every other coach from then on. Splitting the previous
-- single "for all" policy into select/insert/update makes that enforceable:
-- SELECT stays open to every coach across the player's batches (so a locked
-- test still shows read-only), but INSERT/UPDATE additionally require
-- recorded_by = auth.uid() — checked against the pre-existing row on the
-- UPDATE path, so a second coach's upsert conflicts into a row they don't
-- own and is rejected by RLS rather than silently overwriting it. No
-- coach-facing delete policy (none existed before either — least
-- privilege); submit_skill_scores (20260803160000) is not `security
-- definer`, so it runs as the caller and these policies apply to it too.

drop policy "coach manages five_s_results for own batch players" on public.five_s_results;

create policy "coach views five_s_results for own batch players" on public.five_s_results
  for select using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

create policy "coach inserts five_s_results for own batch players" on public.five_s_results
  for insert with check (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

create policy "coach updates own five_s_results" on public.five_s_results
  for update using (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid()
    )
  );
