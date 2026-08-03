-- Grants 'staff' and 'finance' the same centre-scoped *read* visibility
-- centre_admin has across every table centre_admin can see — but strictly
-- select-only, mirroring exactly whatever centre_admin's own read access
-- already looks like per table (some of which is itself select-only, e.g.
-- attendance/injuries/five_s_*, since those are entered by coach/medical).
-- No insert/update/delete policy is added for either role anywhere: the
-- absence of a write policy is what makes them read-only, on top of every
-- Server Action's own requireRole("centre_admin") check already refusing
-- these roles regardless of RLS.

-- Both roles are centre-scoped staff, same as centre_admin/coach/medical.
alter table public.profiles drop constraint centre_required_for_staff;
alter table public.profiles add constraint centre_required_for_staff check (
  (role in ('centre_admin', 'coach', 'medical', 'staff', 'finance') and centre_id is not null)
  or (role in ('super_admin', 'parent'))
);

-- Centres: extend the existing "centre staff can view own centre" policy's
-- role list rather than adding a parallel one.
drop policy "centre staff can view own centre" on public.centres;
create policy "centre staff can view own centre" on public.centres
  for select using (
    private.user_role() in ('centre_admin', 'coach', 'medical', 'staff', 'finance')
    and id = private.user_centre_id()
  );

create policy "staff_finance views own centre profiles" on public.profiles
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre staff_profiles" on public.staff_profiles
  for select using (
    private.user_role() in ('staff', 'finance')
    and profile_id in (select id from public.profiles where centre_id = private.user_centre_id())
  );

create policy "staff_finance views own centre player_types" on public.player_types
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre age_categories" on public.age_categories
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre batches" on public.batches
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre packages" on public.packages
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre players" on public.players
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views links for own centre players" on public.parent_player_links
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre gate_pass_logs" on public.gate_pass_logs
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre payments" on public.payments
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre attendance" on public.attendance
  for select using (
    private.user_role() in ('staff', 'finance')
    and batch_id in (select id from public.batches where centre_id = private.user_centre_id())
  );

create policy "staff_finance views own centre injuries" on public.injuries
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

-- 5S: mirror centre_admin's publish-gated read access (20260730010000) —
-- staff/finance only ever see a player's 5S data once a coach has
-- published it, same as centre_admin and parents.
create policy "staff_finance views own centre five_s_reports" on public.five_s_reports
  for select using (
    private.user_role() in ('staff', 'finance') and centre_id = private.user_centre_id()
  );

create policy "staff_finance views own centre five_s_results" on public.five_s_results
  for select using (
    private.user_role() in ('staff', 'finance')
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_results.player_id)
  );

create policy "staff_finance views own centre five_s_question_responses" on public.five_s_question_responses
  for select using (
    private.user_role() in ('staff', 'finance')
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_question_responses.player_id)
  );

create policy "staff_finance views own centre five_s_category_notes" on public.five_s_category_notes
  for select using (
    private.user_role() in ('staff', 'finance')
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_category_notes.player_id)
  );

create policy "staff_finance views own centre five_s_group_notes" on public.five_s_group_notes
  for select using (
    private.user_role() in ('staff', 'finance')
    and centre_id = private.user_centre_id()
    and exists (select 1 from public.five_s_reports r where r.player_id = five_s_group_notes.player_id)
  );
