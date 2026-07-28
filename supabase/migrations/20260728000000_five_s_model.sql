-- 5S Model: Speed, Stamina, Strength, Spirit, Skill assessment tests.
--
-- Schema is deliberately test-catalog + results, not one column per test:
-- "each [category] has different tests in different formats" (per product
-- brief), so hardcoding columns per test would mean a migration every time
-- a category is added. Adding Stamina/Strength/Spirit/Skill later is just
-- inserting more five_s_tests rows — no schema change needed.
--
-- Only Speed's 5 tests are seeded for now; the other 4 categories are
-- intentionally empty until built.

create type public.five_s_category as enum ('speed', 'stamina', 'strength', 'spirit', 'skill');

-- Fixed reference data (standardized test names), not centre-customizable
-- like player_types/age_categories — seeded here, not user-editable in the
-- app.
create table public.five_s_tests (
  id uuid primary key default gen_random_uuid(),
  category public.five_s_category not null,
  name text not null,
  unit text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.five_s_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  -- Denormalized from players.centre_id at insert time, same reasoning as
  -- parent_player_links.centre_id: lets centre_admin's read-only policy
  -- avoid subquerying players, since "coach manages ... for own batch
  -- players" below already subqueries players -> batches, and a
  -- five_s_results policy that ALSO subqueried players would risk the same
  -- "infinite recursion detected in policy" class of bug hit earlier if
  -- players ever gains a policy that subqueries five_s_results back. It
  -- doesn't today, but denormalizing here costs nothing and forecloses it.
  centre_id uuid not null references public.centres (id) on delete cascade,
  score numeric(6, 2) not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, test_id)
);

create index five_s_results_player_id_idx on public.five_s_results (player_id);
create index five_s_results_centre_id_idx on public.five_s_results (centre_id);

create trigger set_updated_at before update on public.five_s_results
  for each row execute function public.set_updated_at();

alter table public.five_s_tests enable row level security;
alter table public.five_s_results enable row level security;

-- Test catalog: non-sensitive reference data (names/units), readable by any
-- signed-in user — every role needs it to render labels (coach entering
-- scores, centre_admin/parent viewing results).
create policy "authenticated can view five_s_tests" on public.five_s_tests
  for select using (auth.uid() is not null);

create policy "super_admin full access to five_s_results" on public.five_s_results
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

-- Centre admin: view only, per product decision — coaches own data entry.
create policy "centre_admin views own centre five_s_results" on public.five_s_results
  for select using (
    private.user_role() = 'centre_admin' and centre_id = private.user_centre_id()
  );

-- Coach: full access, but only for players in batches they head — no other
-- coach's players, no exceptions (per product decision).
create policy "coach manages five_s_results for own batch players" on public.five_s_results
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

create policy "parents view own children's five_s_results" on public.five_s_results
  for select using (
    private.user_role() = 'parent'
    and player_id in (select player_id from public.parent_player_links where parent_id = auth.uid())
  );

-- Speed category test catalog.
insert into public.five_s_tests (category, name, unit, display_order) values
  ('speed', '10m Sprint', 'sec', 1),
  ('speed', '20m Shuttle', 'sec', 2),
  ('speed', 'Flying 30m', 'sec', 3),
  ('speed', 'Curve Sprint', 'sec', 4),
  ('speed', 'Illinois Agility Test', 'sec', 5);

grant select, insert, update, delete on public.five_s_tests, public.five_s_results
  to authenticated, service_role;
