-- Beep Test scores are Level/Shuttle pairs (e.g. "4/1"), not a single
-- decimal — both numbers are independently meaningful and must be compared
-- lexicographically (level first, shuttle as tiebreaker), so they can't be
-- squeezed into the existing single `score` column. score becomes optional
-- so Beep Test rows can leave it null and use level/shuttle instead; every
-- other test (Cooper, Speed, Strength, Skill) keeps using score as before.

alter table public.five_s_results
  alter column score drop not null,
  add column level smallint,
  add column shuttle smallint,
  add constraint five_s_results_score_or_level_shuttle check (
    score is not null or (level is not null and shuttle is not null)
  );
