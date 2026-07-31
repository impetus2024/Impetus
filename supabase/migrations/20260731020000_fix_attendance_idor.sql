-- Penetration test finding: the previous "coach manages attendance for own
-- batches" policy only validated batch_id ownership, never that player_id
-- actually belongs to that batch_id. Confirmed exploitable — a coach could
-- submit their own legitimately-owned batch_id paired with an arbitrary
-- player_id (any player, any centre) and the insert succeeded. Replaced
-- with the same "derive ownership through the player→batch join" pattern
-- already used correctly by the injuries/five_s_* policies, which ties
-- player_id and batch_id together instead of checking them independently.

drop policy "coach manages attendance for own batches" on public.attendance;

create policy "coach manages attendance for own batches" on public.attendance
  for all using (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.players p
      join public.batches b on b.id = p.batch_id
      where p.id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and exists (
      select 1 from public.players p
      join public.batches b on b.id = p.batch_id
      where p.id = attendance.player_id
        and b.id = attendance.batch_id
        and b.head_coach_id = auth.uid()
    )
  );
