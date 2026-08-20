// Every coach-facing query scopes batches to ones this coach heads OR
// assists -- the assistant coach gets identical access to the head coach
// (see 20260820000000_batch_assistant_coach.sql, which widens the matching
// RLS policies the same way). Supabase's `.or()` takes a single
// comma-separated PostgREST filter string, not multiple `.eq()` calls.
export function coachBatchFilter(coachId: string) {
  return `head_coach_id.eq.${coachId},assistant_coach_id.eq.${coachId}`;
}
