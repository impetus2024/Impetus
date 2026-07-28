-- Strength category: unlike Speed/Stamina, its tests are organized into
-- named subsections (Flexibility Test, Strength Test, Power Test) rather
-- than one flat list. group_name is nullable so Speed/Stamina (no
-- subsections) are unaffected.

alter table public.five_s_tests
  add column group_name text;

insert into public.five_s_tests (category, name, unit, group_name, display_order) values
  ('strength', 'Sit & Reach Test', 'Cm', 'Flexibility Test', 1),
  ('strength', 'Groin Flexibility Test', 'Cm', 'Flexibility Test', 2),
  ('strength', 'AKE Hamstring Test', 'Degree', 'Flexibility Test', 3),
  ('strength', 'Dorsiflexion Lunge Test', 'Cm', 'Flexibility Test', 4),
  ('strength', 'APFT 2-min Pushup Test', 'Count', 'Strength Test', 5),
  ('strength', 'The Plank Test', 'Sec', 'Strength Test', 6),
  ('strength', 'Vertical Jump Test', 'Cm', 'Power Test', 7),
  ('strength', 'Broad Jump Test', 'Cm', 'Power Test', 8);
