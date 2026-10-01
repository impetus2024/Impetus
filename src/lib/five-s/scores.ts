import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/age";
import { getFiveSTests, getFiveSQuestions } from "./catalog";
import { computeStaminaCategoryScore, groupStaminaBenchmarks, type StaminaBenchmark } from "./stamina-benchmarks";
import { computeSpeedCategoryScore, groupSpeedBenchmarks, type SpeedBenchmark } from "./speed-benchmarks";
import { computeStrengthCategoryScore, groupStrengthBenchmarks, type StrengthBenchmark } from "./strength-benchmarks";

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
  // Which axisKeys actually have a recorded assessment for this player, as
  // opposed to merely having a `current[key]` entry — a test-based category
  // (speed/strength) gets a `current` value of 0 as soon as the catalog has
  // tests defined for it, even with zero results recorded for this specific
  // player. Consumers that need to know "has this category really been
  // assessed" (e.g. the overall player rating below) must check this map,
  // not just whether `current[key]` is set.
  assessed: Record<string, boolean>;
};

export type StaminaBenchmarkContext = {
  playerAge: number;
  playerGender: string | null;
  ageBands: { id: string; min_age: number; max_age: number | null; gender: string | null }[];
  benchmarksByTest: Map<string, Map<string, StaminaBenchmark>>;
};

export type SpeedBenchmarkContext = {
  playerAge: number;
  playerGender: string | null;
  ageBands: { id: string; min_age: number; max_age: number | null; gender: string | null }[];
  benchmarksByTest: Map<string, Map<string, SpeedBenchmark>>;
};

export type StrengthBenchmarkContext = {
  playerAge: number;
  playerGender: string | null;
  ageBands: { id: string; min_age: number; max_age: number | null; gender: string | null }[];
  benchmarksByTest: Map<string, Map<string, StrengthBenchmark>>;
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
    supabase.from("players").select("date_of_birth, gender").eq("id", playerId).maybeSingle(),
    supabase
      .from("five_s_age_bands")
      .select("id, min_age, max_age, gender")
      .eq("category", "stamina")
      .order("display_order"),
    staminaTestIds.length > 0
      ? supabase
          .from("five_s_stamina_benchmarks")
          .select("test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary")
          .in("test_id", staminaTestIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (!player) return null;

  return {
    playerAge: calculateAge(player.date_of_birth),
    playerGender: player.gender ?? null,
    ageBands: ageBands ?? [],
    benchmarksByTest: groupStaminaBenchmarks(benchmarkRows ?? []),
  };
}

// Fetches everything computeFiveSScores needs to score Speed against its
// 5-band benchmarks: the player's age and gender (from date_of_birth /
// gender, not the centre-customizable age_categories — "U-17 Girls" needs
// gender), the fixed 'speed' age bands, and whatever super_admin has
// configured for the given tests. Mirrors getStaminaBenchmarkContext.
export async function getSpeedBenchmarkContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  speedTestIds: string[]
): Promise<SpeedBenchmarkContext | null> {
  const [{ data: player }, { data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("players").select("date_of_birth, gender").eq("id", playerId).maybeSingle(),
    supabase
      .from("five_s_age_bands")
      .select("id, min_age, max_age, gender")
      .eq("category", "speed")
      .order("display_order"),
    speedTestIds.length > 0
      ? supabase
          .from("five_s_test_benchmarks")
          .select("test_id, age_band_id, score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling")
          .in("test_id", speedTestIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (!player) return null;

  return {
    playerAge: calculateAge(player.date_of_birth),
    playerGender: player.gender ?? null,
    ageBands: ageBands ?? [],
    benchmarksByTest: groupSpeedBenchmarks(benchmarkRows ?? []),
  };
}

// Fetches everything computeFiveSScores needs to score Strength against its
// 5-band benchmarks: the player's age and gender (from date_of_birth /
// gender, not the centre-customizable age_categories — "U-17 Girls" needs
// gender), the fixed 'strength' age bands, and whatever super_admin has
// configured for the given tests. Mirrors getStaminaBenchmarkContext.
export async function getStrengthBenchmarkContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  strengthTestIds: string[]
): Promise<StrengthBenchmarkContext | null> {
  const [{ data: player }, { data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("players").select("date_of_birth, gender").eq("id", playerId).maybeSingle(),
    supabase
      .from("five_s_age_bands")
      .select("id, min_age, max_age, gender")
      .eq("category", "strength")
      .order("display_order"),
    strengthTestIds.length > 0
      ? supabase
          .from("five_s_strength_benchmarks")
          .select("test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary")
          .in("test_id", strengthTestIds)
      : Promise.resolve({ data: [] }),
  ]);

  if (!player) return null;

  return {
    playerAge: calculateAge(player.date_of_birth),
    playerGender: player.gender ?? null,
    ageBands: ageBands ?? [],
    benchmarksByTest: groupStrengthBenchmarks(benchmarkRows ?? []),
  };
}

// Completion-based score (0-5 per category, no performance benchmarks) — %
// of that category's required tests/questions that have a recorded value.
// "Previous" only counts tests actually rescored (previous_score set by the
// DB trigger); hasPrevious tells callers whether that's true anywhere, so a
// player with a single assessment can skip rendering a "Previous" series.
//
// Stamina is the exception: when staminaContext is supplied, its score
// comes from computeStaminaCategoryScore (Kickstart 1-5 performance bands
// per age) instead of completion %. There's no benchmark-based "previous" yet —
// stamina simply doesn't appear in `previous`/hasPrevious, same as a
// category with no data at all.
//
// Strength is also an exception: when strengthContext is supplied, its score
// comes from computeStrengthCategoryScore (Kickstart 1-5 performance bands
// per age) instead of completion %. No benchmark-based "previous" for strength.
//
// Skill and Spirit are also exceptions: their per-test/per-question entry
// only ever tracked completion (was something filled in), never the actual
// value entered, so a coach's real assessment never affected the graph. The
// coach-entered overall rating (five_s_category_notes.rating, 1-5 in
// half-star steps) is the real score for these two now — the detailed
// sub-test/question entry still happens and is still shown/exported, it
// just no longer drives the number. No "previous" tracking for these two
// (same as a category with no data at all) — there's no history mechanism
// for a single rating value the way five_s_results.previous_score snapshots
// a rescored test.
export function computeFiveSScores(
  axisKeys: string[],
  tests: TestLike[],
  questions: QuestionLike[],
  resultByTest: Map<string, ResultLike>,
  responseByQuestion: Map<string, unknown>,
  staminaContext?: StaminaBenchmarkContext | null,
  ratingByCategory: Map<string, number> = new Map(),
  speedContext?: SpeedBenchmarkContext | null,
  strengthContext?: StrengthBenchmarkContext | null
): FiveSScores {
  const current: Record<string, number> = {};
  const previous: Record<string, number> = {};
  const assessed: Record<string, boolean> = {};
  let hasPrevious = false;

  for (const key of axisKeys) {
    if (key === "stamina" && staminaContext) {
      const staminaTests = tests.filter((t) => t.category === "stamina");
      const score = computeStaminaCategoryScore(
        staminaContext.playerAge,
        staminaContext.playerGender,
        staminaTests,
        resultByTest,
        staminaContext.ageBands,
        staminaContext.benchmarksByTest
      );
      if (score != null) {
        current[key] = score;
        assessed[key] = true;
      }
      continue;
    }

    if (key === "speed" && speedContext) {
      const speedTests = tests.filter((t) => t.category === "speed");
      const score = computeSpeedCategoryScore(
        speedContext.playerAge,
        speedContext.playerGender,
        speedTests,
        resultByTest,
        speedContext.ageBands,
        speedContext.benchmarksByTest
      );
      if (score != null) {
        current[key] = score;
        assessed[key] = true;
      }
      continue;
    }

    if (key === "strength" && strengthContext) {
      const strengthTests = tests.filter((t) => t.category === "strength");
      const score = computeStrengthCategoryScore(
        strengthContext.playerAge,
        strengthContext.playerGender,
        strengthTests,
        resultByTest,
        strengthContext.ageBands,
        strengthContext.benchmarksByTest
      );
      if (score != null) {
        current[key] = score;
        assessed[key] = true;
      }
      continue;
    }

    if (key === "skill" || key === "spirit") {
      const rating = ratingByCategory.get(key);
      if (rating != null) {
        current[key] = rating;
        assessed[key] = true;
      }
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
      assessed[key] = currentCount > 0;
      continue;
    }

    const categoryQuestions = questions.filter((q) => q.category === key);
    if (categoryQuestions.length > 0) {
      const answeredCount = categoryQuestions.filter((q) => responseByQuestion.has(q.id)).length;
      current[key] = (answeredCount / categoryQuestions.length) * 5;
      previous[key] = 0;
      assessed[key] = answeredCount > 0;
    }
  }

  return { current, previous, hasPrevious, assessed };
}

const OVERALL_RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Poor",
  2: "Satisfactory",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export type OverallPlayerRating = { rating: 1 | 2 | 3 | 4 | 5; label: string };

// Combines whichever of the 5 axes actually have a recorded assessment
// (see `assessed` above) into one 1-5 rating — a simple average of the
// assessed categories' current scores, rounded to the nearest whole number.
// null when nothing has been assessed yet at all (no badge to show).
export function computeOverallPlayerRating(scores: FiveSScores): OverallPlayerRating | null {
  const assessedKeys = Object.keys(scores.assessed).filter((k) => scores.assessed[k]);
  if (assessedKeys.length === 0) return null;

  const sum = assessedKeys.reduce((total, key) => total + scores.current[key], 0);
  const average = sum / assessedKeys.length;
  const rating = Math.min(5, Math.max(1, Math.round(average))) as 1 | 2 | 3 | 4 | 5;

  return { rating, label: OVERALL_RATING_LABELS[rating] };
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

  const [tests, questions, { data: results }, { data: responses }, { data: categoryNotes }] = await Promise.all([
    getFiveSTests(),
    getFiveSQuestions(),
    // level/shuttle are retained for legacy Beep Test / Cooper Test historical results.
    // New Stamina tests (Yo-Yo, RSA) store null for these fields.
    supabase.from("five_s_results").select("test_id, previous_score, score, level, shuttle").eq("player_id", playerId),
    supabase.from("five_s_question_responses").select("question_id, answer").eq("player_id", playerId),
    supabase.from("five_s_category_notes").select("category, rating").eq("player_id", playerId),
  ]);

  const resultByTest = new Map((results ?? []).map((r) => [r.test_id, r]));
  const responseByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));
  const ratingByCategory = new Map(
    (categoryNotes ?? []).flatMap((n) => (n.rating != null ? [[n.category, n.rating] as const] : []))
  );

  const staminaTestIds = tests.filter((t) => t.category === "stamina").map((t) => t.id);
  const speedTestIds = tests.filter((t) => t.category === "speed").map((t) => t.id);
  const strengthTestIds = tests.filter((t) => t.category === "strength").map((t) => t.id);
  const [staminaContext, speedContext, strengthContext] = await Promise.all([
    getStaminaBenchmarkContext(supabase, playerId, staminaTestIds),
    getSpeedBenchmarkContext(supabase, playerId, speedTestIds),
    getStrengthBenchmarkContext(supabase, playerId, strengthTestIds),
  ]);

  return computeFiveSScores(
    axisKeys,
    tests,
    questions,
    resultByTest,
    responseByQuestion,
    staminaContext,
    ratingByCategory,
    speedContext,
    strengthContext
  ).current;
}

function groupByPlayer<T extends { player_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const existing = map.get(row.player_id);
    if (existing) existing.push(row);
    else map.set(row.player_id, [row]);
  }
  return map;
}

// Batch version of the overall rating (see computeOverallPlayerRating) for
// a whole list of players — e.g. a roster table — without the N-queries-
// per-row problem calling getFiveSCurrentScores/computeFiveSScores once per
// player in a loop would cause. Everything that's shared across players
// (the test/question catalog, stamina age bands and benchmarks) is fetched
// once; everything per-player (results, responses, category ratings, age)
// is fetched in one IN(...) query each and grouped in memory, then
// computeFiveSScores — the single source of truth for the scoring math —
// runs per player against that pre-grouped data. No publish gating here;
// callers that need "only published players" (e.g. anything centre-admin/
// parent-facing) filter the returned map themselves against whatever
// five_s_reports rows they already have.
export async function getOverallPlayerRatings(
  playerIds: string[],
  axisKeys: string[]
): Promise<Map<string, OverallPlayerRating | null>> {
  const ratings = new Map<string, OverallPlayerRating | null>();
  if (playerIds.length === 0) return ratings;

  const supabase = await createClient();

  const [tests, questions, { data: players }, { data: results }, { data: responses }, { data: categoryNotes }, { data: ageBands }, { data: speedAgeBands }, { data: strengthAgeBands }] =
    await Promise.all([
      getFiveSTests(),
      getFiveSQuestions(),
      supabase.from("players").select("id, date_of_birth, gender").in("id", playerIds),
      supabase
        .from("five_s_results")
        // level/shuttle are retained for legacy Beep Test / Cooper Test historical results.
        // New Stamina tests (Yo-Yo, RSA) store null for these fields.
        .select("player_id, test_id, previous_score, score, level, shuttle")
        .in("player_id", playerIds),
      supabase.from("five_s_question_responses").select("player_id, question_id, answer").in("player_id", playerIds),
      supabase.from("five_s_category_notes").select("player_id, category, rating").in("player_id", playerIds),
      supabase.from("five_s_age_bands").select("id, min_age, max_age, gender").eq("category", "stamina").order("display_order"),
      supabase.from("five_s_age_bands").select("id, min_age, max_age, gender").eq("category", "speed").order("display_order"),
      supabase.from("five_s_age_bands").select("id, min_age, max_age, gender").eq("category", "strength").order("display_order"),
    ]);

  const staminaTestIds = tests.filter((t) => t.category === "stamina").map((t) => t.id);
  const { data: benchmarkRows } =
    staminaTestIds.length > 0
      ? await supabase
          .from("five_s_stamina_benchmarks")
          .select("test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary")
          .in("test_id", staminaTestIds)
      : { data: [] };
  const benchmarksByTest = groupStaminaBenchmarks(benchmarkRows ?? []);

  const speedTestIds = tests.filter((t) => t.category === "speed").map((t) => t.id);
  const { data: speedBenchmarkRows } =
    speedTestIds.length > 0
      ? await supabase
          .from("five_s_test_benchmarks")
          .select("test_id, age_band_id, score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling")
          .in("test_id", speedTestIds)
      : { data: [] };
  const speedBenchmarksByTest = groupSpeedBenchmarks(speedBenchmarkRows ?? []);

  const strengthTestIds = tests.filter((t) => t.category === "strength").map((t) => t.id);
  const { data: strengthBenchmarkRows } =
    strengthTestIds.length > 0
      ? await supabase
          .from("five_s_strength_benchmarks")
          .select("test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary")
          .in("test_id", strengthTestIds)
      : { data: [] };
  const strengthBenchmarksByTest = groupStrengthBenchmarks(strengthBenchmarkRows ?? []);

  const resultsByPlayer = groupByPlayer(results ?? []);
  const responsesByPlayer = groupByPlayer(responses ?? []);
  const categoryNotesByPlayer = groupByPlayer(categoryNotes ?? []);
  const ageByPlayer = new Map((players ?? []).map((p) => [p.id, p.date_of_birth ? calculateAge(p.date_of_birth) : null]));
  const genderByPlayer = new Map((players ?? []).map((p) => [p.id, p.gender ?? null]));

  for (const playerId of playerIds) {
    const resultByTest = new Map((resultsByPlayer.get(playerId) ?? []).map((r) => [r.test_id, r]));
    const responseByQuestion = new Map((responsesByPlayer.get(playerId) ?? []).map((r) => [r.question_id, r.answer]));
    const ratingByCategory = new Map(
      (categoryNotesByPlayer.get(playerId) ?? []).flatMap((n) => (n.rating != null ? [[n.category, n.rating] as const] : []))
    );
    const playerAge = ageByPlayer.get(playerId);
    const playerGender = genderByPlayer.get(playerId) ?? null;
    const staminaContext =
      playerAge != null ? { playerAge, playerGender, ageBands: ageBands ?? [], benchmarksByTest } : null;
    const speedContext =
      playerAge != null
        ? { playerAge, playerGender, ageBands: speedAgeBands ?? [], benchmarksByTest: speedBenchmarksByTest }
        : null;
    const strengthContext =
      playerAge != null
        ? { playerAge, playerGender, ageBands: strengthAgeBands ?? [], benchmarksByTest: strengthBenchmarksByTest }
        : null;

    const scores = computeFiveSScores(
      axisKeys,
      tests,
      questions,
      resultByTest,
      responseByQuestion,
      staminaContext,
      ratingByCategory,
      speedContext,
      strengthContext
    );
    ratings.set(playerId, computeOverallPlayerRating(scores));
  }

  return ratings;
}
