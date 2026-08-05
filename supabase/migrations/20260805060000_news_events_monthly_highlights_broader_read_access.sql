-- News & Events and Monthly Highlights launched (20260805040000,
-- 20260805030000) with read access for only super_admin and centre_admin —
-- every other role that can see a dashboard was missed, unlike every other
-- table, which got broadened read access for staff/finance in
-- 20260803140000 and for coach/medical/parent case-by-case throughout
-- 20260727125052. This backfills the same "own centre" read visibility
-- coach/staff/finance already have elsewhere, plus a parent variant scoped
-- to their linked children's centres via parent_player_links.centre_id —
-- the denormalized column documented on that table specifically so RLS here
-- never has to subquery players (which would recreate the A-references-B,
-- B-references-A cycle already documented there).

create policy "centre_staff views own centre news_events" on public.news_events
  for select using (
    private.user_role() in ('coach', 'medical', 'staff', 'finance')
    and id in (
      select news_event_id from public.news_event_centres
      where centre_id = private.user_centre_id()
    )
  );

create policy "centre_staff views own centre news_event_centres" on public.news_event_centres
  for select using (
    private.user_role() in ('coach', 'medical', 'staff', 'finance')
    and centre_id = private.user_centre_id()
  );

create policy "parents view own children's centres news_events" on public.news_events
  for select using (
    private.user_role() = 'parent'
    and id in (
      select news_event_id from public.news_event_centres
      where centre_id in (
        select centre_id from public.parent_player_links where parent_id = auth.uid()
      )
    )
  );

create policy "parents view own children's centres news_event_centres" on public.news_event_centres
  for select using (
    private.user_role() = 'parent'
    and centre_id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  );


create policy "centre_staff views own centre monthly_highlights" on public.monthly_highlights
  for select using (
    private.user_role() in ('coach', 'medical', 'staff', 'finance')
    and id in (
      select highlight_id from public.monthly_highlight_centres
      where centre_id = private.user_centre_id()
    )
  );

create policy "centre_staff views own centre monthly_highlight_centres" on public.monthly_highlight_centres
  for select using (
    private.user_role() in ('coach', 'medical', 'staff', 'finance')
    and centre_id = private.user_centre_id()
  );

create policy "parents view own children's centres monthly_highlights" on public.monthly_highlights
  for select using (
    private.user_role() = 'parent'
    and id in (
      select highlight_id from public.monthly_highlight_centres
      where centre_id in (
        select centre_id from public.parent_player_links where parent_id = auth.uid()
      )
    )
  );

create policy "parents view own children's centres monthly_highlight_centres" on public.monthly_highlight_centres
  for select using (
    private.user_role() = 'parent'
    and centre_id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  );
