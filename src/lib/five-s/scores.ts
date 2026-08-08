import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/age";
import { getFiveSTests, getFiveSQuestions } from "./catalog";
import { computeStaminaCategoryScore, groupStaminaBenchmarks, type TestBenchmark } from "./stamina-benchmarks";

type TestLike = { id: string; category: string; is_required: boolean; unit: string };
type QuestionLike = { id: string; category: string };
type ResultLike = {
  previous_score: number | null;
  score: number | null;
  level: number | null;
  shuttle: number | null;
};

export type FiveSScores = {
  current: Record<string, number>;
  previous: Record<string, number>;
  hasPrevious: boolean;
};

export type StaminaBenchmarkContext = {
  playerAge: number;
  ageBands: { id: string; min_age: number; max_age: number | null }[];
  benchmarksByTest: Map<string, Map<string, TestBenchmark>>;
};

// Fetches everything computeFiveSScores needs to score Stamina against
// benchmarks instead of completion: the player's age (from date_of_birth,
// not the centre-customizable age_categories), the fixed 'stamina' age
// bands, and whatever benchmarks super_admin has configured for the given
// tests. Shared by both callers below so the fetch-and-group shape lives
// in one place.
export async function getStaminaBenchmarkContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  staminaTestIds: string[]
): Promise<StaminaBenchmarkContext | null> {
  const [{ data: player }, { data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("players").select("date_of_birth").eq("id", playerId).maybeSingle(),
    supabase
      .from("five_s_age_bands")
      .select("id, min_age, max_age")
      .eq("category", "stamina")
      .order("display_order"),
    staminaTestIds.length > 0
      ? supabase
          .from("five_s_stamina_benchmarks")
          .select("test_id, age_band_id, tier, value, level, shuttle")
          .in("test_id", staminaTestIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (!player) return null;

  return {
    playerAge: calculateAge(player.date_of_birth),
    ageBands: ageBands ?? [],
    benchmarksByTest: groupStaminaBenchmarks(benchmarkRows ?? []),
  };
}

// Completion-based score (0-5 per category, no performance benchmarks) — %
// of that category's required tests/questions that have a recorded value.
// "Previous" only counts tests actually rescored (previous_score set by the
// DB trigger); hasPrevious tells callers whether that's true anywhere, so a
// player with a single assessment can skip rendering a "Previous" series.
//
// Stamina is the exception: when staminaContext is supplied, its score
// comes from computeStaminaCategoryScore (Poor/Average/Elite benchmarks per
// age) instead of completion %. There's no benchmark-based "previous" yet —
// stamina simply doesn't appear in `previous`/hasPrevious, same as a
// category with no data at all.
export function computeFiveSScores(
  axisKeys: string[],
  tests: TestLike[],
  questions: QuestionLike[],
  resultByTest: Map<string, ResultLike>,
  responseByQuestion: Map<string, unknown>,
  staminaContext?: StaminaBenchmarkContext | null
): FiveSScores {
  const current: Record<string, number> = {};
  const previous: Record<string, number> = {};
  let hasPrevious = false;

  for (const key of axisKeys) {
    if (key === "stamina" && staminaContext) {
      const staminaTests = tests.filter((t) => t.category === "stamina");
      const score = computeStaminaCategoryScore(
        staminaContext.playerAge,
        staminaTests,
        resultByTest,
        staminaContext.ageBands,
        staminaContext.benchmarksByTest
      );
      if (score != null) current[key] = score;
      continue;
    }

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
    supabase.from("five_s_results").select("test_id, previous_score, score, level, shuttle").eq("player_id", playerId),
    supabase.from("five_s_question_responses").select("question_id, answer").eq("player_id", playerId),
  ]);

  const resultByTest = new Map((results ?? []).map((r) => [r.test_id, r]));
  const responseByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));

  const staminaTestIds = tests.filter((t) => t.category === "stamina").map((t) => t.id);
  const staminaContext = await getStaminaBenchmarkContext(supabase, playerId, staminaTestIds);

  return computeFiveSScores(axisKeys, tests, questions, resultByTest, responseByQuestion, staminaContext).current;
}
