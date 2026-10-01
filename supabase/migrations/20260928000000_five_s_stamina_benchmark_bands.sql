-- Stamina benchmark scoring: replace the Poor/Average/Elite tier model with
-- the Kickstart five performance bands (Score 5..1) from BENCH MARK.xlsx.
-- Yo-Yo Intermittent is higher-is-better (completed level), Repeated Sprint
-- Ability (RSA) is lower-is-better (mean time), so each (test, age band)
-- stores four band boundaries plus an explicit direction flag. Score 5 is
-- always the highest-performance band.
--
-- The old tests (Beep Test, Cooper Test) are soft-deactivated rather than
-- deleted, preserving their historical five_s_results rows.

-- 1. Deactivate old Stamina tests, insert the two new ones.
update public.five_s_tests set is_active = false where category = 'stamina';

insert into public.five_s_tests (category, name, unit, display_order, is_active) values
  ('stamina', 'Yo-Yo Intermittent', 'level', 1, true),
  ('stamina', 'Repeated Sprint Ability (RSA)', 'sec', 2, true);

-- 2. Replace Stamina's age bands with the same five benchmark age groups
-- as Speed (U-17 Girls is Female-only).
delete from public.five_s_stamina_benchmarks;

delete from public.five_s_age_bands where category = 'stamina';

insert into public.five_s_age_bands (category, label, min_age, max_age, gender, display_order) values
  ('stamina', 'U-13', 11, 13, null, 1),
  ('stamina', 'U-15', 14, 15, null, 2),
  ('stamina', 'U-17', 16, 17, null, 3),
  ('stamina', 'U-19+', 18, null, null, 4),
  ('stamina', 'U-17 Girls', 16, 17, 'Female', 5);

-- 3. five_s_stamina_benchmarks changes from tier rows (value / level+shuttle)
-- to one row per (test, age band) with four band boundaries plus direction.
alter table public.five_s_stamina_benchmarks
  drop constraint if exists five_s_stamina_benchmarks_shape,
  drop constraint if exists five_s_stamina_benchmarks_test_id_age_band_id_tier_key,
  drop column if exists tier,
  drop column if exists value,
  drop column if exists level,
  drop column if exists shuttle,
  add column higher_is_better boolean not null,
  add column score_5_boundary numeric(6, 2) not null,
  add column score_4_boundary numeric(6, 2) not null,
  add column score_3_boundary numeric(6, 2) not null,
  add column score_2_boundary numeric(6, 2) not null,
  add unique (test_id, age_band_id),
  add constraint five_s_stamina_benchmarks_order check (
    (higher_is_better and score_5_boundary > score_4_boundary and score_4_boundary > score_3_boundary and score_3_boundary > score_2_boundary)
    or
    (not higher_is_better and score_5_boundary < score_4_boundary and score_4_boundary < score_3_boundary and score_3_boundary < score_2_boundary)
  );

drop type if exists public.five_s_benchmark_tier;

-- 4. Seed the Kickstart benchmark bands (values exactly as in BENCH MARK.xlsx).
-- For higher_is_better rows the boundaries are the band minimums (floors):
--   score 5 >= score_5, score 4 >= score_4, score 3 >= score_3,
--   score 2 >= score_2, score 1 = below score_2.
-- For lower-is-better rows they are the band maximums (ceilings):
--   score 5 <= score_5, score 4 <= score_4, score 3 <= score_3,
--   score 2 <= score_2, score 1 = above score_2.
with bands (test_name, band_label, higher_is_better, score_5, score_4, score_3, score_2) as (
  values
    ('Yo-Yo Intermittent', 'U-13', true, 18.5, 17.1, 15.6, 14.1),
    ('Yo-Yo Intermittent', 'U-15', true, 19.0, 17.5, 16.0, 14.5),
    ('Yo-Yo Intermittent', 'U-17', true, 20.4, 19.0, 17.5, 16.0),
    ('Yo-Yo Intermittent', 'U-19+', true, 21.0, 20.0, 18.5, 17.0),
    ('Yo-Yo Intermittent', 'U-17 Girls', true, 18.0, 17.0, 15.5, 14.0),
    ('Repeated Sprint Ability (RSA)', 'U-13', false, 3.30, 3.40, 3.50, 3.65),
    ('Repeated Sprint Ability (RSA)', 'U-15', false, 3.20, 3.30, 3.40, 3.55),
    ('Repeated Sprint Ability (RSA)', 'U-17', false, 4.10, 4.20, 4.30, 4.45),
    ('Repeated Sprint Ability (RSA)', 'U-19+', false, 4.00, 4.10, 4.20, 4.35),
    ('Repeated Sprint Ability (RSA)', 'U-17 Girls', false, 4.00, 4.10, 4.20, 4.35)
)
insert into public.five_s_stamina_benchmarks
  (test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary)
select t.id, b.id, bm.higher_is_better, bm.score_5, bm.score_4, bm.score_3, bm.score_2
from bands bm
join public.five_s_tests t on t.category = 'stamina' and t.name = bm.test_name and t.is_active
join public.five_s_age_bands b on b.category = 'stamina' and b.label = bm.band_label;
