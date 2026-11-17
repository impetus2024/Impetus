-- Monthly Highlights / News & Events lists embed the centre (name) each item
-- is published to. Without read access to its own centre row, a media user
-- gets null centres back and those pages crash. Same role set as
-- 20260803140000, plus 'media'; still limited to the user's own centre.
drop policy "centre staff can view own centre" on public.centres;
create policy "centre staff can view own centre" on public.centres
  for select using (
    private.user_role() in ('centre_admin', 'coach', 'medical', 'staff', 'finance', 'media')
    and id = private.user_centre_id()
  );
