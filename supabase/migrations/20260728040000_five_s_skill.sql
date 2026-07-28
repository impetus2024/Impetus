-- Skill category: like Strength, tests are grouped into named subsections
-- (Test 1: Passing, Test 2: Trapping/Controlling, ...), but here each group
-- also has its own required remarks field, in addition to the category's
-- overall remarks (five_s_category_notes). is_required lets one test
-- (Defending's "1 v 1") be optional, matching the reference form exactly —
-- every other test in the app has been required so far.

alter table public.five_s_tests
  add column is_required boolean not null default true;

create table public.five_s_group_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  category public.five_s_category not null,
  group_name text not null,
  -- Denormalized from players.centre_id, same reasoning as five_s_results.centre_id.
  centre_id uuid not null references public.centres (id) on delete cascade,
  remarks text not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, category, group_name)
);

create index five_s_group_notes_player_id_idx on public.five_s_group_notes (player_id);
create index five_s_group_notes_centre_id_idx on public.five_s_group_notes (centre_id);

create trigger set_updated_at before update on public.five_s_group_notes
  for each row execute function public.set_updated_at();

alter table public.five_s_group_notes enable row level security;

create policy "super_admin full access to five_s_group_notes" on public.five_s_group_notes
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

create policy "centre_admin views own centre five_s_group_notes" on public.five_s_group_notes
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

create policy "coach manages five_s_group_notes for own batch players" on public.five_s_group_notes
  for all using (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  )
  with check (
    private.user_role() = 'coach'
    and player_id in (
      select p.id from public.players p
      join public.batches b on b.id = p.batch_id
      where b.head_coach_id = auth.uid()
    )
  );

create policy "parents view own children's five_s_group_notes" on public.five_s_group_notes
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

grant select, insert, update, delete on public.five_s_group_notes to authenticated, service_role;

-- Skill category test catalog.
insert into public.five_s_tests (category, name, unit, group_name, display_order, is_required) values
  ('skill', 'Ground Ball Passing', '', 'Test 1 : Passing', 1, true),
  ('skill', 'Long-Range Passing', '', 'Test 1 : Passing', 2, true),
  ('skill', 'In foot', '', 'Test 2 : Trapping/Controlling', 3, true),
  ('skill', 'Laces', '', 'Test 2 : Trapping/Controlling', 4, true),
  ('skill', 'Thighs', '', 'Test 2 : Trapping/Controlling', 5, true),
  ('skill', 'Chest', '', 'Test 2 : Trapping/Controlling', 6, true),
  ('skill', 'Head', '', 'Test 2 : Trapping/Controlling', 7, true),
  ('skill', 'Sole', '', 'Test 2 : Trapping/Controlling', 8, true),
  ('skill', 'In foot', '', 'Test 3 : Dribbling', 9, true),
  ('skill', 'Out foot', '', 'Test 3 : Dribbling', 10, true),
  ('skill', 'Laces', '', 'Test 3 : Dribbling', 11, true),
  ('skill', 'Sole', '', 'Test 3 : Dribbling', 12, true),
  ('skill', 'Rebounder Shooting', '', 'Test 4 : Shooting', 13, true),
  ('skill', 'Cross & Finish', '', 'Test 4 : Shooting', 14, true),
  ('skill', '1 v 1', '', 'Test 5 : Defending', 15, false),
  ('skill', 'Interceptions', '', 'Test 5 : Defending', 16, true);
