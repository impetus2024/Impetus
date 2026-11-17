import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests, getFiveSQuestions } from "./catalog";
import { FIVE_S_CATEGORIES } from "./categories";

const PAGE_SIZE = 1000; // supabase max_rows

// PostgREST caps every response at max_rows, so wide `.in(...)` reads must
// be paged or they silently truncate.
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/**
 * Player ids whose 5S assessment is fully done for the current window:
 * every category has all required tests scored (or, for question-only
 * categories like spirit, every question answered), with entries saved on
 * or after `sinceDate` (window start) so a previous window's data doesn't
 * count.
 */
export async function getFiveSCompletePlayerIds(
  playerIds: string[],
  sinceDate: string | null
): Promise<Set<string>> {
  const complete = new Set<string>();
  if (playerIds.length === 0) return complete;

  const supabase = await createClient();
  const since = sinceDate ? `${sinceDate}T00:00:00` : null;

  const [tests, questions, results, responses] = await Promise.all([
    getFiveSTests(),
    getFiveSQuestions(),
    fetchAllRows<{ player_id: string; test_id: string }>((from, to) => {
      let q = supabase.from("five_s_results").select("player_id, test_id").in("player_id", playerIds);
      if (since) q = q.gte("updated_at", since);
      return q.order("id").range(from, to);
    }),
    fetchAllRows<{ player_id: string; question_id: string }>((from, to) => {
      let q = supabase.from("five_s_question_responses").select("player_id, question_id").in("player_id", playerIds);
      if (since) q = q.gte("updated_at", since);
      return q.order("id").range(from, to);
    }),
  ]);

  const done = new Map<string, Set<string>>();
  for (const r of results) {
    if (!done.has(r.player_id)) done.set(r.player_id, new Set());
    done.get(r.player_id)!.add(r.test_id);
  }
  for (const r of responses) {
    if (!done.has(r.player_id)) done.set(r.player_id, new Set());
    done.get(r.player_id)!.add(r.question_id);
  }

  // Item ids that must be present per category, same rule as
  // computeFiveSScores: required tests, else every question.
  const required = FIVE_S_CATEGORIES.map((category) => {
    const testIds = tests.filter((t) => t.category === category && t.is_required).map((t) => t.id);
    if (testIds.length > 0) return testIds;
    return questions.filter((q) => q.category === category).map((q) => q.id);
  }).filter((ids) => ids.length > 0);

  for (const id of playerIds) {
    const have = done.get(id);
    if (have && required.every((ids) => ids.every((i) => have.has(i)))) complete.add(id);
  }
  return complete;
}
