-- profiles.centre_required_for_staff (last set by 20260803140000) lists every
-- centre-scoped role; without 'media' here, creating a media account fails
-- with a check-constraint violation inside the auth.users -> profiles trigger.
alter table public.profiles drop constraint centre_required_for_staff;
alter table public.profiles add constraint centre_required_for_staff check (
  (role in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media') and centre_id is not null)
  or role in ('super_admin', 'parent')
);
