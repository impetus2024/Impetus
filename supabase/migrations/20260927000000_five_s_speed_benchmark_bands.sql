-- Speed benchmark scoring: replace the single Min/Max/Avg benchmark with
-- five performance bands (Score 5..1) per test per age band, sourced from
-- the Kickstart interpretation in BENCH MARK.xlsx. Time-based tests score
-- faster = higher: a result at or below score_5_ceiling earns 5, at or
-- below score_4_ceiling earns 4, at or below score_3_ceiling earns 3, at or
-- below score_2_ceiling earns 2, and anything above score_2_ceiling earns 1.
--
-- The four new Speed tests replace the five old ones (10m Sprint, 20m
-- Shuttle, Flying 30m, Curve Sprint, Illinois Agility Test). The old tests
-- are soft-deactivated rather than deleted so their historical
-- five_s_results rows are preserved.

-- 1. Age bands gain an optional gender so "U-17 Girls" can be a distinct
-- band from "U-17" (same age range, girls only).
alter table public.five_s_age_bands add column gender text;

-- 2. Tests gain a soft-delete flag so obsolete Speed tests leave the
-- catalog without deleting their historical results.
alter table public.five_s_tests add column is_active boolean not null default true;

-- 3. Deactivate the old Speed tests, insert the four new ones.
update public.five_s_tests set is_active = false where category = 'speed';

insert into public.five_s_tests (category, name, unit, display_order, is_active) values
  ('speed', '10 m Sprint', 'sec', 1, true),
  ('speed', 'Flying Start', 'sec', 2, true),
  ('speed', 'Arrowhead Agility (R/L)', 'sec', 3, true),
  ('speed', 'Curve Sprint (R/L)', 'sec', 4, true);

-- 4. Replace Speed's age bands with the five benchmark age groups.
delete from public.five_s_test_benchmarks;

delete from public.five_s_age_bands where category = 'speed';

insert into public.five_s_age_bands (category, label, min_age, max_age, gender, display_order) values
  ('speed', 'U-13', 11, 13, null, 1),
  ('speed', 'U-15', 14, 15, null, 2),
  ('speed', 'U-17', 16, 17, null, 3),
  ('speed', 'U-19+', 18, null, null, 4),
  ('speed', 'U-17 Girls', 16, 17, 'Female', 5);

-- 5. five_s_test_benchmarks changes from Min/Max/Avg to the four band
-- ceilings (score_5..score_2); score 1 is anything above score_2_ceiling.
alter table public.five_s_test_benchmarks
  drop constraint if exists five_s_test_benchmarks_range,
  drop column if exists min_value,
  drop column if exists max_value,
  drop column if exists avg_value,
  add column score_5_ceiling numeric(6, 2),
  add column score_4_ceiling numeric(6, 2),
  add column score_3_ceiling numeric(6, 2),
  add column score_2_ceiling numeric(6, 2);

alter table public.five_s_test_benchmarks
  alter column score_5_ceiling set not null,
  alter column score_4_ceiling set not null,
  alter column score_3_ceiling set not null,
  alter column score_2_ceiling set not null,
  add constraint five_s_test_benchmarks_bands_order check (
    score_5_ceiling < score_4_ceiling
    and score_4_ceiling < score_3_ceiling
    and score_3_ceiling < score_2_ceiling
  );

-- 6. Seed the Kickstart benchmark bands (values exactly as in BENCH MARK.xlsx).
with bands (test_name, band_label, score_5, score_4, score_3, score_2) as (
  values
    ('10 m Sprint', 'U-13', 2.00, 2.10, 2.20, 2.30),
    ('10 m Sprint', 'U-15', 1.90, 2.00, 2.10, 2.20),
    ('10 m Sprint', 'U-17', 1.85, 1.95, 2.10, 2.25),
    ('10 m Sprint', 'U-19+', 1.80, 1.90, 2.05, 2.20),
    ('10 m Sprint', 'U-17 Girls', 2.02, 2.12, 2.27, 2.42),
    ('Flying Start', 'U-13', 2.80, 2.90, 3.00, 3.10),
    ('Flying Start', 'U-15', 2.60, 2.70, 2.80, 2.90),
    ('Flying Start', 'U-17', 3.25, 3.40, 3.55, 3.70),
    ('Flying Start', 'U-19+', 3.15, 3.30, 3.45, 3.60),
    ('Flying Start', 'U-17 Girls', 3.50, 3.65, 3.80, 3.98),
    ('Arrowhead Agility (R/L)', 'U-13', 7.00, 7.20, 7.40, 7.60),
    ('Arrowhead Agility (R/L)', 'U-15', 6.70, 6.90, 7.10, 7.30),
    ('Arrowhead Agility (R/L)', 'U-17', 7.70, 8.00, 8.30, 8.60),
    ('Arrowhead Agility (R/L)', 'U-19+', 7.50, 7.80, 8.10, 8.40),
    ('Arrowhead Agility (R/L)', 'U-17 Girls', 8.15, 8.45, 8.75, 9.05),
    ('Curve Sprint (R/L)', 'U-13', 2.80, 2.95, 3.10, 3.25),
    ('Curve Sprint (R/L)', 'U-15', 2.65, 2.80, 2.95, 3.10),
    ('Curve Sprint (R/L)', 'U-17', 3.00, 3.15, 3.30, 3.45),
    ('Curve Sprint (R/L)', 'U-19+', 2.90, 3.05, 3.20, 3.35),
    ('Curve Sprint (R/L)', 'U-17 Girls', 3.25, 3.40, 3.55, 3.72)
)
insert into public.five_s_test_benchmarks
  (test_id, age_band_id, score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling)
select t.id, b.id, bm.score_5, bm.score_4, bm.score_3, bm.score_2
from bands bm
join public.five_s_tests t on t.category = 'speed' and t.name = bm.test_name and t.is_active
join public.five_s_age_bands b on b.category = 'speed' and b.label = bm.band_label;

-- 7. Scoring now reads these benchmarks (see speed-benchmarks.ts), so any
-- signed-in user needs select — only super_admin edits.
create policy "authenticated can view five_s_test_benchmarks" on public.five_s_test_benchmarks
  for select using (auth.uid() is not null);
