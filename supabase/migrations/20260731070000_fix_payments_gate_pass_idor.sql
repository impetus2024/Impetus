-- Penetration test finding (same class as 20260731020000_fix_attendance_idor.sql):
-- "centre_admin manages own centre payments" and "centre_admin manages own
-- centre gate_pass_logs" only validated centre_id, never that player_id
-- actually belongs to a player in that centre. Confirmed exploitable: a
-- centre_admin could record a payment or gate pass log against any
-- player_id — including one belonging to a different centre entirely — as
-- long as they set centre_id to their own. Fixed with the same "derive
-- ownership through the player" pattern already used correctly by
-- attendance/injuries/five_s_* policies. Neither table has a batch_id
-- column (unlike attendance), so the join is against players only.

drop policy "centre_admin manages own centre payments" on public.payments;

create policy "centre_admin manages own centre payments" on public.payments
  for all using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (
      select 1 from public.players p
      where p.id = payments.player_id
        and p.centre_id = private.user_centre_id()
    )
  )
  with check (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (
      select 1 from public.players p
      where p.id = payments.player_id
        and p.centre_id = private.user_centre_id()
    )
  );

drop policy "centre_admin manages own centre gate_pass_logs" on public.gate_pass_logs;

create policy "centre_admin manages own centre gate_pass_logs" on public.gate_pass_logs
  for all using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (
      select 1 from public.players p
      where p.id = gate_pass_logs.player_id
        and p.centre_id = private.user_centre_id()
    )
  )
  with check (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and exists (
      select 1 from public.players p
      where p.id = gate_pass_logs.player_id
        and p.centre_id = private.user_centre_id()
    )
  );
