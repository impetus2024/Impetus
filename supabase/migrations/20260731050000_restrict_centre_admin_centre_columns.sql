-- Security review finding: "centre_admin sets own centre five_s testing
-- window" (20260730020000) grants centre_admin UPDATE on their own centres
-- row, scoped by id/role in USING/WITH CHECK — but RLS predicates can't see
-- which columns are in the SET clause, only the resulting row. In practice
-- that policy authorizes a centre_admin to overwrite ANY column on their
-- centre via a raw REST call, not just five_s_window_start/end: name,
-- contact_number, email, country, logo_path, is_active. The app's own UI
-- never does this (setFiveSTestingWindow only ever writes the two window
-- columns) but RLS allowed it regardless — the same class of gap
-- prevent_role_escalation (20260731010000) closed on profiles.
--
-- Table-wide grants can't be split per-app-role here either: centre_admin
-- and super_admin both map to the single Postgres "authenticated" role, so
-- column-level GRANTs can't distinguish them. A trigger comparing OLD vs
-- NEW is the only way to enforce this, same as prevent_role_escalation.

create or replace function public.restrict_centre_admin_centre_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() = 'centre_admin' and (
    new.name is distinct from old.name
    or new.contact_number is distinct from old.contact_number
    or new.email is distinct from old.email
    or new.country is distinct from old.country
    or new.logo_path is distinct from old.logo_path
    or new.is_active is distinct from old.is_active
  ) then
    raise exception 'Only a super admin can change centre details.';
  end if;
  return new;
end;
$$;

create trigger restrict_centre_admin_centre_update before update on public.centres
  for each row execute function public.restrict_centre_admin_centre_update();
