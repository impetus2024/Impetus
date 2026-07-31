-- 5S testing window: centre_admin sets a single active [start, end] date
-- range for the whole centre; coaches can only submit/update 5S scores
-- while today falls inside it (checked in the coach score-submission
-- actions, not via RLS — the underlying five_s_results/etc. write
-- policies stay unchanged). Publishing is NOT gated by this — a coach can
-- always publish whatever was completed during an open window, even after
-- it closes. One window per centre, overwritten each time the admin sets
-- new dates — no history of past windows is kept.

alter table public.centres
  add column five_s_window_start date,
  add column five_s_window_end date;

alter table public.centres
  add constraint five_s_window_valid_range check (
    five_s_window_start is null or five_s_window_end is null or five_s_window_end >= five_s_window_start
  );

-- centre_admin previously had SELECT-only access to their own centre row
-- ("centre staff can view own centre"). This grants UPDATE too, scoped to
-- their own centre. The underlying table grant is already unrestricted
-- per-column (see the original "GRANT ALL ... TO authenticated"), same as
-- every other write policy in this schema — RLS scopes rows/roles, the
-- server action (setFiveSTestingWindow) is what actually limits the
-- update payload to just the two window columns.
create policy "centre_admin sets own centre five_s testing window" on public.centres
  for update using (
    private.user_role() = 'centre_admin' and id = private.user_centre_id()
  )
  with check (
    private.user_role() = 'centre_admin' and id = private.user_centre_id()
  );
