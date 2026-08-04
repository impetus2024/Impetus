-- Product now wants centre_admin able to change any of its own centre's
-- managed accounts' role (Administrator Management > edit > Role), applied
-- immediately since role is read fresh from profiles on every request (see
-- verifySession). prevent_role_escalation (20260731010000) currently blocks
-- *any* role change by a centre_admin unconditionally — that was closing a
-- real escalation gap (raw client could promote straight to centre_admin or
-- worse), not ruling out this feature. Narrow it instead of removing it:
-- still block centre_id changes, and still block any role transition that
-- touches a role outside the set centre_admin already manages (see the
-- "centre_admin manages own centre staff" policy, 20260803150000) — that
-- keeps super_admin/parent unreachable via this path — but allow reassigning
-- within that managed set (centre_admin/coach/medical/staff/finance).
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
