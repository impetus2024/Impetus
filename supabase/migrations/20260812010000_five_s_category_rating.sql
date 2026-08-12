-- Coach-entered overall 1-5 (half-star) rating per category, alongside the
-- existing free-text remarks on five_s_category_notes. Skill and Spirit's
-- existing per-test/per-question entry only ever tracked *completion* (was
-- something filled in), never the actual value entered -- this rating
-- becomes the real radar-graph score for those two categories (see
-- computeFiveSScores in src/lib/five-s/scores.ts), while the detailed
-- sub-test/question entry is unchanged and stays for notes/detail/the PDF
-- report. Speed/Stamina/Strength are untouched by this.
alter table public.five_s_category_notes
  add column rating numeric(3, 1);

alter table public.five_s_category_notes
  add constraint five_s_category_notes_rating_range check (
    rating is null or (rating >= 1 and rating <= 5 and round(rating * 2) = rating * 2)
  );

-- submit_skill_scores (see 20260803160000_atomic_skill_scores_submit.sql)
-- needs to carry the new rating through its p_category_note upsert too --
-- same function, same signature, just one more field written atomically
-- alongside remarks.
create or replace function public.submit_skill_scores(
  p_results jsonb,
  p_group_notes jsonb,
  p_category_note jsonb
) returns void
language plpgsql
as $$
begin
  if jsonb_array_length(p_results) > 0 then
    insert into public.five_s_results (player_id, test_id, centre_id, score, recorded_by)
    select
      (r->>'player_id')::uuid,
      (r->>'test_id')::uuid,
      (r->>'centre_id')::uuid,
      (r->>'score')::numeric,
      (r->>'recorded_by')::uuid
    from jsonb_array_elements(p_results) as r
    on conflict (player_id, test_id) do update set
      score = excluded.score,
      centre_id = excluded.centre_id,
      recorded_by = excluded.recorded_by;
  end if;

  insert into public.five_s_group_notes (player_id, category, group_name, centre_id, remarks, recorded_by)
  select
    (g->>'player_id')::uuid,
    (g->>'category')::public.five_s_category,
    g->>'group_name',
    (g->>'centre_id')::uuid,
    g->>'remarks',
    (g->>'recorded_by')::uuid
  from jsonb_array_elements(p_group_notes) as g
  on conflict (player_id, category, group_name) do update set
    remarks = excluded.remarks,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();

  insert into public.five_s_category_notes (player_id, category, centre_id, remarks, rating, recorded_by)
  values (
    (p_category_note->>'player_id')::uuid,
    (p_category_note->>'category')::public.five_s_category,
    (p_category_note->>'centre_id')::uuid,
    p_category_note->>'remarks',
    (p_category_note->>'rating')::numeric,
    (p_category_note->>'recorded_by')::uuid
  )
  on conflict (player_id, category) do update set
    remarks = excluded.remarks,
    rating = excluded.rating,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();
end;
$$;
