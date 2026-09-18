-- A coach's role is fixed once the account is a coach: the role field is
-- read-only in AdministratorDetailForm, and updateAdministrator refuses a
-- coach -> anything transition outright (COACH_ROLE_LOCKED_MESSAGE in
-- src/app/centre-admin/administrators/actions.ts) because every batch
-- (head_coach_id/assistant_coach_id), attendance row (marked_by) and 5S
-- record hangs off that profile id.
--
-- That check only exists in the app, though. prevent_role_escalation was
-- relaxed by 20260804000000 to let a centre_admin reassign roles within its
-- own managed set (centre_admin/coach/medical/staff/finance), so the
-- database still accepts a coach -> medical/staff/finance/centre_admin
-- UPDATE from anyone who can write the row: a replayed raw PostgREST PATCH
-- on the centre admin's own token never touches the Server Action, and
-- leaves all of those relationships pointing at an account that is no
-- longer a coach.
--
-- Extend the existing trigger function rather than adding another trigger:
-- prevent_role_escalation is already the BEFORE UPDATE / FOR EACH ROW guard
-- on profiles, so one more branch is one more check on the write that
-- already happens, not a second trigger that could drift out of step with
-- the first.
--
-- Scope, deliberately:
--   * Gated on `private.user_role() is not null` — i.e. an actual Data API
--     caller. This preserves the existing carve-out: private.user_role()
--     reads app_metadata.role out of the request JWT, so it is NULL both for
--     GoTrue's own connection (where handle_auth_user_sync's INSERT ... ON
--     CONFLICT DO UPDATE runs on every auth.users email/user_metadata
--     update) and for the service-role key. Trusted server-side writes are
--     unaffected, exactly as before.
--   * Every authenticated role is covered, not just centre_admin: the
--     centre_admin branch below never fires for anyone else, so a coach
--     promoting itself (or any other non-centre_admin role doing it) would
--     otherwise still get through. Nothing in the app reassigns a coach —
--     the super admin has no such control either — so the coach -> X
--     direction is refused for all of them.
--   * Only OLD.role = 'coach' is locked. A non-coach -> coach transition
--     (e.g. medical promoted to coach) and every other reassignment inside
--     the roles centre_admin manages keep behaving exactly as 20260804000000
--     left them.
--   * centre_id keeps its own existing check, untouched and still
--     super_admin-only for a centre_admin caller.
--
-- Additive: CREATE OR REPLACE of the function body only. The trigger
-- definition, the other policies on profiles and every existing row are
-- untouched, and no row is read, written or recalculated by this migration.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.user_role() is not null
     and old.role = 'coach' and new.role is distinct from old.role then
    raise exception 'A coach''s role cannot be changed.';
  end if;

  if private.user_role() = 'centre_admin' then
    if new.centre_id is distinct from old.centre_id then
      raise exception 'Only a super admin can change a profile''s centre.';
    end if;

    if new.role is distinct from old.role
       and (
         old.role not in ('centre_admin', 'coach', 'medical', 'staff', 'finance')
         or new.role not in ('centre_admin', 'coach', 'medical', 'staff', 'finance')
       ) then
      raise exception 'Only a super admin can change a profile''s role.';
    end if;
  end if;
  return new;
end;
$$;