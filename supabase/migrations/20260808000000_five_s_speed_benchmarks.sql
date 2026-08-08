-- Speed benchmark scoring: super_admin sets Min/Max/Avg per test per age
-- band (e.g. "10m Sprint" at U13 = 2.3s-3.2s, avg 2.75s). category is on
-- the band itself (not a separate join) so Stamina/Strength/Skill can
-- define their own bands later without redesigning this table; only
-- 'speed' is seeded for now per product decision to go category-by-category.

create table public.five_s_age_bands (
  id uuid primary key default gen_random_uuid(),
  category public.five_s_category not null,
  label text not null,
  min_age smallint not null,
  max_age smallint,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category, label),
  constraint five_s_age_bands_range check (
    min_age >= 4 and (max_age is null or max_age >= min_age)
  )
);

create table public.five_s_test_benchmarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  age_band_id uuid not null references public.five_s_age_bands (id) on delete cascade,
  min_value numeric(6, 2) not null,
  max_value numeric(6, 2) not null,
  avg_value numeric(6, 2) not null,
  updated_at timestamptz not null default now(),
  unique (test_id, age_band_id),
  constraint five_s_test_benchmarks_range check (
    min_value <= max_value and avg_value between min_value and max_value
  )
);

create index five_s_age_bands_category_idx on public.five_s_age_bands (category);
create index five_s_test_benchmarks_test_id_idx on public.five_s_test_benchmarks (test_id);

create trigger set_updated_at before update on public.five_s_test_benchmarks
  for each row execute function public.set_updated_at();

alter table public.five_s_age_bands enable row level security;
alter table public.five_s_test_benchmarks enable row level security;

-- Reference data, same visibility as five_s_tests: any signed-in user may
-- eventually need band labels, only super_admin edits them.
create policy "authenticated can view five_s_age_bands" on public.five_s_age_bands
  for select using (auth.uid() is not null);

create policy "super_admin manages five_s_age_bands" on public.five_s_age_bands
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

-- Benchmarks aren't consumed anywhere yet (scoring wiring is a later step),
-- so keep them super_admin-only until a reader role actually needs them.
create policy "super_admin full access to five_s_test_benchmarks" on public.five_s_test_benchmarks
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

grant select, insert, update, delete on public.five_s_age_bands, public.five_s_test_benchmarks
  to authenticated, service_role;

insert into public.five_s_age_bands (category, label, min_age, max_age, display_order) values
  ('speed', 'U10', 4, 10, 1),
  ('speed', 'U13', 11, 13, 2),
  ('speed', 'U15', 14, 15, 3),
  ('speed', 'U18', 16, 18, 4),
  ('speed', '>18', 19, null, 5);
