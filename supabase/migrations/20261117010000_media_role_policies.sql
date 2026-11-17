-- RLS for the 'media' role (added in 20261117000000). Media gets exactly the
-- same access a centre_admin has to the four content tables behind Monthly
-- Highlights and News & Events, scoped to its own centre, and no access to any
-- other table. Each policy is recreated with 'media' added to the role check;
-- every other clause is unchanged from the migration that created it.
--
-- Additive in effect: no existing row is touched and no existing role loses
-- or gains anything.

-- ============================================================
-- profiles: centre_admin must be able to create/see/manage media accounts
-- from Administrator Management (same as staff/finance, see
-- 20260803150000_centre_admin_manages_staff_finance.sql).
-- ============================================================
drop policy "centre_admin manages own centre staff" on public.profiles;
create policy "centre_admin manages own centre staff" on public.profiles
  for all using (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media')
  )
  with check (
    private.user_role() = 'centre_admin'
    and centre_id = private.user_centre_id()
    and role in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media')
  );

-- Same body as 20260918010000_lock_coach_role.sql, with 'media' added to the
-- set of roles a centre_admin may assign/reassign.
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
         old.role not in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media')
         or new.role not in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media')
       ) then
      raise exception 'Only a super admin can change a profile''s role.';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Monthly Highlights (20260805030000)
-- ============================================================
drop policy "centre_admin manages own centre highlight links" on public.monthly_highlight_centres;
create policy "centre_admin manages own centre highlight links" on public.monthly_highlight_centres
  for all using (
    private.user_role() in ('centre_admin', 'media') and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() in ('centre_admin', 'media') and centre_id = private.user_centre_id()
  );

drop policy "centre_admin manages own or centre-published monthly_highlights" on public.monthly_highlights;
create policy "centre_admin manages own or centre-published monthly_highlights" on public.monthly_highlights
  for all using (
    private.user_role() in ('centre_admin', 'media')
    and (
      created_by = auth.uid()
      or id in (
        select highlight_id
        from public.monthly_highlight_centres
        where centre_id = private.user_centre_id()
      )
    )
  )
  with check (
    private.user_role() in ('centre_admin', 'media')
  );

-- ============================================================
-- News & Events (20260805040000)
-- ============================================================
drop policy "centre_admin manages own centre news_event links" on public.news_event_centres;
create policy "centre_admin manages own centre news_event links" on public.news_event_centres
  for all using (
    private.user_role() in ('centre_admin', 'media') and centre_id = private.user_centre_id()
  )
  with check (
    private.user_role() in ('centre_admin', 'media') and centre_id = private.user_centre_id()
  );

drop policy "centre_admin manages own or centre-published news_events" on public.news_events;
create policy "centre_admin manages own or centre-published news_events" on public.news_events
  for all using (
    private.user_role() in ('centre_admin', 'media')
    and (
      created_by = auth.uid()
      or id in (
        select news_event_id
        from public.news_event_centres
        where centre_id = private.user_centre_id()
      )
    )
  )
  with check (
    private.user_role() in ('centre_admin', 'media')
  );
