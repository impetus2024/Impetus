import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests, getFiveSQuestions } from "./catalog";

type TestLike = { id: string; category: string; is_required: boolean };
type QuestionLike = { id: string; category: string };
type ResultLike = { previous_score: number | null };

export type FiveSScores = {
  current: Record<string, number>;
  previous: Record<string, number>;
  hasPrevious: boolean;
};

// Completion-based score (0-5 per category, no performance benchmarks) — %
// of that category's required tests/questions that have a recorded value.
// "Previous" only counts tests actually rescored (previous_score set by the
// DB trigger); hasPrevious tells callers whether that's true anywhere, so a
// player with a single assessment can skip rendering a "Previous" series.
export function computeFiveSScores(
  axisKeys: string[],
  tests: TestLike[],
  questions: QuestionLike[],
  resultByTest: Map<string, ResultLike>,
  responseByQuestion: Map<string, unknown>
): FiveSScores {
  const current: Record<string, number> = {};
  const previous: Record<string, number> = {};
  let hasPrevious = false;

  for (const key of axisKeys) {
    const categoryTests = tests.filter((t) => t.category === key && t.is_required);
    if (categoryTests.length > 0) {
      let currentCount = 0;
      let previousCount = 0;
      for (const test of categoryTests) {
        const result = resultByTest.get(test.id);
        if (result) currentCount++;
        if (result?.previous_score != null) {
          previousCount++;
          hasPrevious = true;
        }
      }
      current[key] = (currentCount / categoryTests.length) * 5;
      previous[key] = (previousCount / categoryTests.length) * 5;
      continue;
    }

    const categoryQuestions = questions.filter((q) => q.category === key);
    if (categoryQuestions.length > 0) {
      const answeredCount = categoryQuestions.filter((q) => responseByQuestion.has(q.id)).length;
      current[key] = (answeredCount / categoryQuestions.length) * 5;
      previous[key] = 0;
    }
  }

  return { current, previous, hasPrevious };
}

// Lightweight "current scores only" fetch for dashboard widgets that just
// need the radar graph, not the full results breakdown. Scores are
// coach-private until published (same rule FiveSResultsView's
// gateUntilPublished enforces) — so an unpublished/nonexistent report
// returns all-zero scores rather than querying five_s_results at all.
export async function getFiveSCurrentScores(
  playerId: string,
  axisKeys: string[]
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const zero = Object.fromEntries(axisKeys.map((k) => [k, 0]));

  const { data: report } = await supabase
    .from("five_s_reports")
    .select("id")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!report) return zero;

  const [tests, questions, { data: results }, { data: responses }] = await Promise.all([
    getFiveSTests(),
    getFiveSQuestions(),
    supabase.from("five_s_results").select("test_id, previous_score").eq("player_id", playerId),
    supabase.from("five_s_question_responses").select("question_id, answer").eq("player_id", playerId),
  ]);

  const resultByTest = new Map((results ?? []).map((r) => [r.test_id, r]));
  const responseByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));

  return computeFiveSScores(axisKeys, tests, questions, resultByTest, responseByQuestion).current;
}
