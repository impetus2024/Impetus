-- Coaches can now issue movement passes (check in / check out) for players
-- in their own batches, and every pass records WHO issued it and in what
-- role (admin vs coach) so the pass details can show it.
--
-- 1. gate_pass_logs gets performed_by_name / performed_by_role snapshots.
--    A snapshot (not a live profiles join) because coaches cannot read other
--    users' profile rows under RLS, and because a pass should keep showing
--    the role the issuer had at the time even if they are later changed.
-- 2. toggle_gate_pass becomes security definer. Coaches have no UPDATE
--    policy on players (and must not get one: it would expose every column),
--    so the is_checked_in flip has to run with owner rights. All access
--    control therefore lives inside the function: caller must be a
--    centre_admin or coach, p_performed_by must be the caller, the player
--    must be in the caller's centre, and for coaches the player must be in
--    a batch the coach heads or assists.
-- 3. Coaches get select-only RLS on gate_pass_logs for their batch players.
--    Writes only ever go through the function above.

alter table public.gate_pass_logs
  add column performed_by_name text,
  add column performed_by_role public.user_role;

-- Backfill existing rows (all were written by centre_admin, but read the
-- real value from profiles rather than assuming).
update public.gate_pass_logs l
set performed_by_name = p.full_name,
    performed_by_role = p.role
from public.profiles p
where p.id = l.performed_by;

create or replace function public.toggle_gate_pass(
  p_player_id uuid,
  p_centre_id uuid,
  p_reason text,
  p_performed_by uuid
) returns public.gate_pass_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := private.user_role();
  v_new_state boolean;
  v_action public.gate_pass_action;
  v_name text;
  v_log public.gate_pass_logs;
begin
  if auth.uid() is null
     or p_performed_by is distinct from auth.uid()
     or v_role not in ('centre_admin', 'coach')
     or p_centre_id is distinct from private.user_centre_id() then
    raise exception 'Not authorized';
  end if;

  if v_role = 'coach' and not exists (
    select 1
    from public.player_batches pb
    join public.batches b on b.id = pb.batch_id
    where pb.player_id = p_player_id
      and (b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  -- The UPDATE's row lock serialises concurrent toggles for the same player
  -- (see 20260731030000_atomic_gate_pass_toggle.sql).
  update public.players
  set is_checked_in = not is_checked_in
  where id = p_player_id
    and centre_id = p_centre_id
  returning is_checked_in into v_new_state;

  if not found then
    raise exception 'Player not found';
  end if;

  v_action := case when v_new_state then 'check_in' else 'check_out' end;

  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.gate_pass_logs
    (player_id, centre_id, action, reason, performed_by, performed_by_name, performed_by_role)
  values
    (p_player_id, p_centre_id, v_action, p_reason, auth.uid(), v_name, v_role)
  returning * into v_log;

  return v_log;
end;
$$;

-- create or replace keeps the old grants, which include PUBLIC (the default
-- for functions). A definer function must not be callable by anon.
revoke execute on function public.toggle_gate_pass(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.toggle_gate_pass(uuid, uuid, text, uuid) to authenticated;

create policy "coach views own batch players gate_pass_logs" on public.gate_pass_logs
  for select using (
    private.user_role() = 'coach'
    and centre_id = private.user_centre_id()
    and player_id in (
      select pb.player_id from public.player_batches pb
      join public.batches b on b.id = pb.batch_id
      where b.head_coach_id = auth.uid() or b.assistant_coach_id = auth.uid()
    )
  );
