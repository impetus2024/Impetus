-- Penetration test finding: createGatePassEntry read players.is_checked_in,
-- computed the opposite action from that read, then wrote both the log row
-- and the flipped boolean as two separate round trips — a classic TOCTOU
-- race. Confirmed exploitable: two concurrent requests for the same player
-- (a double-click submits this easily, no attacker required) both read the
-- same stale value and both recorded the same action, leaving two open
-- "checked in, never checked out" sessions.
--
-- Fixed by doing the read-toggle-log sequence inside a single Postgres
-- function instead of three separate REST round trips. The UPDATE...
-- RETURNING acquires a row lock on the player for the duration of the
-- function call: a second concurrent call for the same player blocks until
-- the first commits, then reads the already-flipped value — serializing
-- the toggle correctly instead of racing.
--
-- security invoker (the default) deliberately, not definer: this runs as
-- the calling user, so the existing RLS policies on players/gate_pass_logs
-- still apply exactly as before — this function doesn't grant any access
-- the caller didn't already have via direct table writes, it just makes
-- the sequence atomic.
create or replace function public.toggle_gate_pass(
  p_player_id uuid,
  p_centre_id uuid,
  p_reason text,
  p_performed_by uuid
) returns public.gate_pass_logs
language plpgsql
as $$
declare
  v_new_state boolean;
  v_action public.gate_pass_action;
  v_log public.gate_pass_logs;
begin
  update public.players
  set is_checked_in = not is_checked_in
  where id = p_player_id
  returning is_checked_in into v_new_state;

  if not found then
    raise exception 'Player not found';
  end if;

  v_action := case when v_new_state then 'check_in' else 'check_out' end;

  insert into public.gate_pass_logs (player_id, centre_id, action, reason, performed_by)
  values (p_player_id, p_centre_id, v_action, p_reason, p_performed_by)
  returning * into v_log;

  return v_log;
end;
$$;

grant execute on function public.toggle_gate_pass(uuid, uuid, text, uuid) to authenticated;
