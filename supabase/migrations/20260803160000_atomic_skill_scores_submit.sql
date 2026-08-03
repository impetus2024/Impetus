-- submitSkillScores (src/app/coach/5s-model/actions.ts) previously wrote to
-- five_s_results, five_s_group_notes, and five_s_category_notes as three
-- separate .upsert() calls — a failure on the second or third left the
-- first already committed, with no way to undo it. Unlike deleteCentre
-- (which calls the GoTrue admin REST API and can't be wrapped in a SQL
-- transaction), all three writes here are plain SQL against tables in the
-- same database, so a single function call gives them real atomicity:
-- Postgres runs the whole function body as one transaction, and any
-- exception (e.g. an RLS violation on one of the three tables) rolls back
-- everything, not just the failed statement.
--
-- Not `security definer`, matching toggle_gate_pass and every other RPC in
-- this app that's meant to run as the caller — RLS's existing "coach
-- manages ... for own batch players" policies on all three tables still
-- apply exactly as they did to the three separate upserts, since a coach
-- calling this still runs it under their own role.
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

  insert into public.five_s_category_notes (player_id, category, centre_id, remarks, recorded_by)
  values (
    (p_category_note->>'player_id')::uuid,
    (p_category_note->>'category')::public.five_s_category,
    (p_category_note->>'centre_id')::uuid,
    p_category_note->>'remarks',
    (p_category_note->>'recorded_by')::uuid
  )
  on conflict (player_id, category) do update set
    remarks = excluded.remarks,
    centre_id = excluded.centre_id,
    recorded_by = excluded.recorded_by,
    updated_at = now();
end;
$$;

grant execute on function public.submit_skill_scores(jsonb, jsonb, jsonb) to authenticated;
