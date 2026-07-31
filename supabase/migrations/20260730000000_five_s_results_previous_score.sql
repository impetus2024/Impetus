-- Tracks the prior value of a 5S test result so the results page can show a
-- "Previous" comparison alongside "Current". five_s_results only ever holds
-- one row per (player_id, test_id) — a rescore overwrites it — so without
-- this there's no way to know what the score was before the latest edit.
-- Snapshotting happens in a trigger (not application code) so every write
-- path (coach score forms today, anything else later) gets it for free.

alter table public.five_s_results
  add column previous_score numeric(6, 2),
  add column previous_recorded_at timestamptz;

create or replace function public.five_s_results_snapshot_previous()
returns trigger
language plpgsql
as $$
begin
  if new.score is distinct from old.score then
    new.previous_score := old.score;
    new.previous_recorded_at := old.recorded_at;
    new.recorded_at := now();
  end if;
  return new;
end;
$$;

create trigger snapshot_previous_score before update on public.five_s_results
  for each row execute function public.five_s_results_snapshot_previous();
