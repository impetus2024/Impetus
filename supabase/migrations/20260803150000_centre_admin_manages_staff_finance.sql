-- Without this, centre_admin's own "manages own centre staff" policy
-- (role in ('centre_admin','coach','medical')) would silently exclude any
-- 'staff'/'finance' profile it creates from every RLS-scoped query the
-- Administrator Management page runs — centre_admin couldn't see, edit,
-- enable/disable, or reset the password of the very accounts it just
-- created via the same "Add Administrator" flow.
drop policy "centre_admin manages own centre staff" on public.profiles;
create policy "centre_admin manages own centre staff" on public.profiles
  for all using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical', 'staff', 'finance')
  )
  with check (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical', 'staff', 'finance')
  );
