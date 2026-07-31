-- The "centre_admin manages own centre staff" policy on profiles has no
-- FOR clause, so it governs UPDATE too, and its WITH CHECK only constrains
-- centre_id + that role stays within (centre_admin, coach, medical) — it
-- never compares against the row's PREVIOUS role, which RLS predicates
-- can't express (USING sees the old row, WITH CHECK sees the new row, but
-- nothing compares the two). In practice that meant a centre_admin could
-- promote a coach/medical profile straight to centre_admin, or demote the
-- other admin, via a raw client call — the app's own UI never does this
-- (updateAdministrator only ever writes full_name; setAdministratorActive
-- only ever writes is_active) but RLS allowed it regardless.
--
-- A trigger is the only way to compare old vs. new here — locks `role`
-- and `centre_id` on profiles to super_admin only, everything else
-- centre_admin already does (full_name, is_active) is untouched.

-- Scoped to "the acting request is specifically a centre_admin", not
-- "isn't super_admin" — deliberately, so this can't interact with the
-- handle_auth_user_sync trigger's own INSERT ... ON CONFLICT DO UPDATE
-- (which runs from GoTrue's own connection, outside any PostgREST/RLS
-- session, so private.user_role() there is NULL, never 'centre_admin').
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() = 'centre_admin'
     and (new.role is distinct from old.role or new.centre_id is distinct from old.centre_id) then
    raise exception 'Only a super admin can change a profile''s role or centre.';
  end if;
  return new;
end;
$$;

create trigger prevent_role_escalation before update on public.profiles
  for each row execute function public.prevent_role_escalation();
