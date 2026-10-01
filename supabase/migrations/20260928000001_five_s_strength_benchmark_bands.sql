-- Strength benchmark scoring: replace completion-based scoring with
-- Kickstart five performance bands (Score 5..1) from BENCH MARK.xlsx.
-- All Strength tests are higher-is-better (completed cm, seconds, reps).
-- Each (test, age band) stores four band boundaries plus an explicit
-- direction flag. Score 5 is always the highest-performance band.
--
-- The old tests (Sit & Reach Test, Groin Flexibility Test, AKE Hamstring Test,
-- Dorsiflexion Lunge Test, APFT 2-min Pushup Test, The Plank Test,
-- Vertical Jump Test, Broad Jump Test) are soft-deactivated rather than
-- deleted, preserving their historical five_s_results rows.

-- 1. Deactivate old Strength tests, insert the four new ones.
update public.five_s_tests set is_active = false where category = 'strength';

insert into public.five_s_tests (category, name, unit, display_order, is_active) values
  ('strength', 'Sit and Reach', 'cm', 1, true),
  ('strength', 'Plank', 's', 2, true),
  ('strength', 'Vertical Jump R or L', 'cm', 3, true),
  ('strength', 'Push-Up Test', 'reps', 4, true);

-- 2. Replace Strength's age bands with the five benchmark age groups
-- (U-17 Girls is Female-only).
delete from public.five_s_age_bands where category = 'strength';

insert into public.five_s_age_bands (category, label, min_age, max_age, gender, display_order) values
  ('strength', 'U-13', 11, 13, null, 1),
  ('strength', 'U-15', 14, 15, null, 2),
  ('strength', 'U-17', 16, 17, null, 3),
  ('strength', 'U-19+', 18, null, null, 4),
  ('strength', 'U-17 Girls', 16, 17, 'Female', 5);

-- 3. Create strength benchmarks table if it doesn't exist, or repurpose existing.
-- We'll use a similar structure to stamina benchmarks.
create table if not exists public.five_s_strength_benchmarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.five_s_tests (id) on delete cascade,
  age_band_id uuid not null references public.five_s_age_bands (id) on delete cascade,
  higher_is_better boolean not null,
  score_5_boundary numeric(6, 2),
  score_4_boundary numeric(6, 2) not null,
  score_3_boundary numeric(6, 2) not null,
  score_2_boundary numeric(6, 2) not null,
  updated_at timestamptz not null default now(),
  unique (test_id, age_band_id)
);

-- Clear any rows left over from an earlier shape/seed. This must run after
-- the create above: on a fresh database (e.g. after `supabase db reset`) the
-- table did not exist yet, so deleting before creating failed the migration.
delete from public.five_s_strength_benchmarks;

-- Add check constraint for boundary ordering (higher_is_better = true means boundaries decrease)
alter table public.five_s_strength_benchmarks
  add constraint five_s_strength_benchmarks_order check (
    (higher_is_better and score_5_boundary > score_4_boundary and score_4_boundary > score_3_boundary and score_3_boundary > score_2_boundary)
    or
    (not higher_is_better and score_5_boundary < score_4_boundary and score_4_boundary < score_3_boundary and score_3_boundary < score_2_boundary)
  );

create index if not exists five_s_strength_benchmarks_test_id_idx on public.five_s_strength_benchmarks (test_id);

create trigger set_updated_at before update on public.five_s_strength_benchmarks
  for each row execute function public.set_updated_at();

alter table public.five_s_strength_benchmarks enable row level security;

-- Any signed-in user needs select for scoring display; only super_admin edits.
create policy "authenticated can view five_s_strength_benchmarks" on public.five_s_strength_benchmarks
  for select using (auth.uid() is not null);

create policy "super_admin manages five_s_strength_benchmarks" on public.five_s_strength_benchmarks
  for all using (private.user_role() = 'super_admin')
  with check (private.user_role() = 'super_admin');

grant select, insert, update, delete on public.five_s_strength_benchmarks to authenticated, service_role;

-- 4. Seed the Kickstart benchmark bands (values exactly as in BENCH MARK.xlsx).
-- For higher_is_better rows the boundaries are the band minimums (floors):
--   score 5 >= score_5, score 4 >= score_4, score 3 >= score_3,
--   score 2 >= score_2, score 1 = below score_2.
with bands (test_name, band_label, higher_is_better, score_5, score_4, score_3, score_2) as (
  values
    -- Sit and Reach (cm)
    ('Sit and Reach', 'U-13', true, 42, 37, 32, 28),
    ('Sit and Reach', 'U-15', true, 45, 40, 35, 30),
    ('Sit and Reach', 'U-17', true, 50, 45, 40, 35),
    ('Sit and Reach', 'U-19+', true, 52, 47, 42, 37),
    ('Sit and Reach', 'U-17 Girls', true, 48, 44, 40, 36),
    -- Plank (s)
    ('Plank', 'U-13', true, 120, 100, 80, 60),
    ('Plank', 'U-15', true, 150, 120, 90, 60),
    ('Plank', 'U-17', true, 210, 180, 150, 120),
    ('Plank', 'U-19+', true, 225, 195, 165, 135),
    ('Plank', 'U-17 Girls', true, 175, 150, 125, 100),
    -- Vertical Jump R or L (cm)
    ('Vertical Jump R or L', 'U-13', true, 40, 36, 32, 27),
    ('Vertical Jump R or L', 'U-15', true, 45, 40, 35, 30),
    ('Vertical Jump R or L', 'U-17', true, 55, 50, 45, 43),
    ('Vertical Jump R or L', 'U-19+', true, 58, 53, 48, 44),
    ('Vertical Jump R or L', 'U-17 Girls', true, 47, 43, 39, 36),
    -- Push-Up Test (reps)
    -- NOTE: U-13 Score 5 boundary marked as "nbb" in source (ambiguous).
    -- Using NULL to flag for manual review; Score 4/3/2 boundaries from source.
    ('Push-Up Test', 'U-13', true, null, 20, 15, 10),
    ('Push-Up Test', 'U-15', true, 32, 27, 22, 18),
    ('Push-Up Test', 'U-17', true, 35, 30, 25, 20),
    ('Push-Up Test', 'U-19+', true, 40, 35, 30, 25)
    -- NOTE: U-17 Girls row not present in source for Push-Up Test (ambiguity).
)
insert into public.five_s_strength_benchmarks
  (test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary)
select t.id, b.id, bm.higher_is_better, bm.score_5, bm.score_4, bm.score_3, bm.score_2
from bands bm
join public.five_s_tests t on t.category = 'strength' and t.name = bm.test_name and t.is_active
join public.five_s_age_bands b on b.category = 'strength' and b.label = bm.band_label;