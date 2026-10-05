-- players.parent_email may only change when a centre admin explicitly edits
-- it on that player's Parent Profile and saves (updateParentProfile in
-- src/app/centre-admin/players/actions.ts). That action authorizes the
-- request, checks the form's updated_at version, and then writes the column
-- through the service-role client.
--
-- Nothing stopped a direct write, though: "centre_admin manages own centre
-- players" is FOR ALL, so a centre admin could PATCH any of their centre's
-- players.parent_email through the Data API, skipping the intent check, the
-- version check and the parent-login handling entirely.
--
-- Same carve-out as prevent_profile_email_tamper: private.user_role() reads
-- app_metadata.role from the request JWT, so it is NULL for the service-role
-- key (the app's server-side write) and for direct database sessions. Every
-- authenticated Data API request carries a role, and those are the writes
-- blocked here. Every other players column is untouched, so ordinary player
-- edits keep working through RLS as before. INSERT is not covered: creating a
-- player necessarily sets its parent email.
--
-- Additive only: a new function and trigger. Existing policies, triggers and
-- data are untouched. Revert with:
--   drop trigger prevent_parent_email_tamper on public.players;
--   drop function public.prevent_parent_email_tamper();
create or replace function public.prevent_parent_email_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() is not null
     and new.parent_email is distinct from old.parent_email then
    raise exception 'players.parent_email can only be changed from the Parent Profile.';
  end if;
  return new;
end;
$$;

create trigger prevent_parent_email_tamper before update on public.players
  for each row execute function public.prevent_parent_email_tamper();
