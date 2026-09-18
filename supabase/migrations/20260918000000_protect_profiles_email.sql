-- profiles.email is a mirror of auth.users.email, kept in sync by
-- handle_auth_user_sync (on_auth_user_created / on_auth_user_updated). The
-- app treats it as the login identity: changeOwnPassword signs in with it,
-- and the email-change flows look up duplicate addresses through it.
--
-- Nothing stopped a direct write to it, though: the "centre_admin manages own
-- centre staff" policy has no FOR clause, so a centre_admin could PATCH any
-- staff row's email through the Data API and leave profiles pointing at an
-- address the account can't sign in with. Every legitimate change goes
-- through the Auth Admin API (changeLoginEmail in
-- src/lib/auth/provision-user.ts) and reaches this column via the sync
-- trigger instead.
--
-- Same carve-out as prevent_must_change_password_tamper and
-- prevent_role_escalation: private.user_role() reads app_metadata.role from
-- the request JWT, so it is NULL both for GoTrue's own connection (where the
-- sync trigger runs) and for the service-role key. Only authenticated Data
-- API requests carry a role, and those are the writes being blocked.
--
-- Additive only: a new function and trigger. Existing triggers, policies and
-- data are untouched. No unique index is added — auth.users already enforces
-- unique emails, and a profiles index would first need a duplicate audit of
-- every environment it is deployed to.
create or replace function public.prevent_profile_email_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() is not null
     and new.email is distinct from old.email then
    raise exception 'profiles.email can only be changed through Supabase Auth.';
  end if;
  return new;
end;
$$;

create trigger prevent_profile_email_tamper before update on public.profiles
  for each row execute function public.prevent_profile_email_tamper();
