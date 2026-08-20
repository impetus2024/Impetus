-- Optional second coach per batch. Product wants the assistant coach to be
-- a full substitute for the head coach -- same batch visibility, same
-- attendance/5S/injuries access for that batch's players -- not a lesser
-- role, so every "coach owns this batch" RLS check below is widened from
-- `head_coach_id = auth.uid()` to also match `assistant_coach_id`.
--
-- These are the *current* live definitions of each policy (several were
-- already replaced once by 20260809020000_player_batches.sql, which moved
-- the ownership check from players.batch_id to the player_batches join
-- table) -- alter policy updates each in place rather than dropping and
-- recreating, so there's no window where the policy doesn't exist.

alter table public.batches
  add column assistant_coach_id uuid references public.profiles (id) on delete set null;

alter table public.batches
  add constraint batches_assistant_coach_not_head
  check (assistant_coach_id is null or assistant_coach_id <> head_coach_id);

create index batches_assistant_coach_id_idx on public.batches (assistant_coach_id);

alter policy "coach views own assigned batches" on public.batches
  using (
    private.user_role() = 'coach'
    and (head_coach_id = auth.uid() or assistant_coach_id = auth.uid())
  );

alter policy "coach views own batches player_batches" on public.player_batches
  using (
    private.user_role() = 'coach'
    and batch_id in (
      select id from public.batches
      where head_coach_id = auth.uid() or assistant_coach_id = auth.uid()
    )
  );

alter policy "coach views players in own batches" on public.players
  using (
    private.user_role() = 'coach'
    and id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach manages attendance for own batches" on public.attendance
  using (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and (b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid())
    )
  )
  with check (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where pb.player_id = attendance.player_id
        and b.id = attendance.batch_id
        and (b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid())
    )
  );

alter policy "coach manages injuries for own batch players" on public.injuries
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach manages five_s_reports for own batch players" on public.five_s_reports
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach manages five_s_category_notes for own batch players" on public.five_s_category_notes
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach manages five_s_group_notes for own batch players" on public.five_s_group_notes
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach manages five_s_question_responses for own batch players" on public.five_s_question_responses
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach views five_s_results for own batch players" on public.five_s_results
  using (
    private.user_role() = 'coach'
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach inserts five_s_results for own batch players" on public.five_s_results
  with check (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );

alter policy "coach updates own five_s_results" on public.five_s_results
  using (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and recorded_by = auth.uid()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );
