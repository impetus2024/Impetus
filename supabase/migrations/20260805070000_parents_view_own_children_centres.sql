-- 20260805060000 gave parents read access to news_events/monthly_highlights
-- and their _centres mapping tables, but missed that both queries also
-- embed centres(id, name) — without a policy here, RLS blocks that
-- embedded row and PostgREST returns null for it instead of omitting the
-- parent row entirely, which crashed TargetCentresBadges on a null centre.
-- Same "own children's centres" scoping as those policies, via
-- parent_player_links.centre_id.

create policy "parents view own children's centres" on public.centres
  for select using (
    private.user_role() = 'parent'
    and id in (
      select centre_id from public.parent_player_links where parent_id = auth.uid()
    )
  );
