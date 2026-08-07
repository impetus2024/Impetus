-- Stamina benchmarks: Poor/Average/Elite bands per test per age, unlike
-- Speed's single Min/Max/Avg. Each (test, age_band) has 4 threshold
-- points — poor_ceiling, average_low, average_high, elite_floor — dividing
-- a coach's raw result into 5 zones (below poor_ceiling = 1 ... above
-- elite_floor = 5). Stored as one row per point (not 4 wide columns) since
-- a point is either a plain number (Cooper, metres) or a Level/Shuttle pair
-- (Beep Test) — exactly one of `value` or (`level` + `shuttle`) is set.
--
-- Reuses five_s_age_bands (already seeded for 'speed') with the same
-- boundaries for 'stamina'.

create type public.five_s_benchmark_tier as enum (
  'poor_ceiling', 'average_low', 'average_high', 'elite_floor'
);

create table public.five_s_stamina_benchmarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  age_band_id uuid not null references public.five_s_age_bands (id) on delete cascade,
  tier public.five_s_benchmark_tier not null,
  value numeric(7, 2),
  level smallint,
  shuttle smallint,
  updated_at timestamptz not null default now(),
  unique (test_id, age_band_id, tier),
  constraint five_s_stamina_benchmarks_shape check (
    (value is not null and level is null and shuttle is null)
    or (value is null and level is not null and shuttle is not null)
  )
);

create index five_s_stamina_benchmarks_test_id_idx on public.five_s_stamina_benchmarks (test_id);

create trigger set_updated_at before update on public.five_s_stamina_benchmarks
  for each row execute function public.set_updated_at();

alter table public.five_s_stamina_benchmarks enable row level security;

-- Unlike five_s_test_benchmarks (Speed, not wired into scoring yet), this
-- one is read by computeFiveSScores for coach/parent/centre_admin score
-- displays, so any signed-in user needs select — only super_admin edits.
create policy "authenticated can view five_s_stamina_benchmarks" on public.five_s_stamina_benchmarks
  for select using (auth.uid() is not null);

create policy "super_admin manages five_s_stamina_benchmarks" on public.five_s_stamina_benchmarks
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

grant select, insert, update, delete on public.five_s_stamina_benchmarks to authenticated, service_role;

insert into public.five_s_age_bands (category, label, min_age, max_age, display_order) values
  ('stamina', '<10', 4, 10, 1),
  ('stamina', '10-13', 11, 13, 2),
  ('stamina', '13-15', 14, 15, 3),
  ('stamina', '15-18', 16, 18, 4),
  ('stamina', '>18', 19, null, 5);
