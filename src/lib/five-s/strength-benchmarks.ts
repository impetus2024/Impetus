// Strength scoring: each (test, age band) has four band boundaries that
// divide a raw result into the five Kickstart performance bands (Score 5..1).
// Direction is per test and stored on the benchmark row:
//   - All current Strength tests are higher-is-better (cm, s, reps).
//     The four boundaries are the band minimums (floors):
//     score 5 >= score_5_boundary, score 4 >= score_4_boundary,
//     score 3 >= score_3_boundary, score 2 >= score_2_boundary,
//     and score 1 is anything below score_2_boundary.
//
// SOURCE-BOUNDARY NOTE: the Kickstart source prints its bands as ranges and
// leaves a few gaps. The four-boundary representation is contiguous by design,
// so gap values resolve to the lower band: for higher-is-better a value below
// score_4_boundary but at/above score_3_boundary rates 3, and a value below
// score_2_boundary rates 1. The source values themselves are stored unmodified
// — nothing is rounded or "corrected" — this resolution rule is the
// deterministic interpretation required by the contiguous 5-band scoring shape.
//
// AMBIGUITIES FROM SOURCE (BENCH MARK.xlsx):
// 1. Push-Up Test U-13 Score 5 boundary marked as "nbb" (unclear meaning).
//    Stored as NULL in benchmark row — requires manual review by super_admin.
// 2. Push-Up Test has no U-17 Girls row in source. No benchmark row inserted.

export type StrengthBenchmark = {
  higher_is_better: boolean;
  score_5_boundary: number | null;
  score_4_boundary: number;
  score_3_boundary: number;
  score_2_boundary: number;
};

export const STRENGTH_BENCHMARK_BOUNDARIES = [
  "score_5_boundary",
  "score_4_boundary",
  "score_3_boundary",
  "score_2_boundary",
] as const;
export type StrengthBenchmarkBoundary = (typeof STRENGTH_BENCHMARK_BOUNDARIES)[number];

// Direction is a fixed property of each Strength test (seeded reference
// data): all current tests record cm, s, or reps (higher is better).
// The direction is stored explicitly on each benchmark row (higher_is_better
// column), not inferred from the unit string. This function is kept for
// reference but should not be used for scoring — scoring uses the benchmark
// row's higher_is_better.
export function isHigherIsBetter(_unit: string): boolean {
  return true;
}

export function rateStrengthTest(value: number, benchmark: StrengthBenchmark): number | null {
  if (!benchmark.higher_is_better) {
    // Not used by current tests, but kept for completeness
    if (benchmark.score_5_boundary != null && value <= benchmark.score_5_boundary) return 5;
    if (value <= benchmark.score_4_boundary) return 4;
    if (value <= benchmark.score_3_boundary) return 3;
    if (value <= benchmark.score_2_boundary) return 2;
    return 1;
  }

  if (benchmark.score_5_boundary != null && value >= benchmark.score_5_boundary) return 5;
  if (value >= benchmark.score_4_boundary) return 4;
  if (value >= benchmark.score_3_boundary) return 3;
  if (value >= benchmark.score_2_boundary) return 2;
  return 1;
}

type StrengthAgeBand = {
  id: string;
  label?: string;
  min_age: number;
  max_age: number | null;
  gender: string | null;
};

function inRange(age: number, band: StrengthAgeBand): boolean {
  return age >= band.min_age && (band.max_age == null || age <= band.max_age);
}

export function findStrengthAgeBand(
  age: number,
  gender: string | null,
  bands: StrengthAgeBand[]
): StrengthAgeBand | undefined {
  const gendered = bands.find((b) => b.gender != null && b.gender === gender && inRange(age, b));
  if (gendered) return gendered;
  return bands.find((b) => b.gender == null && inRange(age, b));
}

type BenchmarkRow = {
  test_id: string;
  age_band_id: string;
  higher_is_better: boolean;
  score_5_boundary: number | null;
  score_4_boundary: number;
  score_3_boundary: number;
  score_2_boundary: number;
};

export function groupStrengthBenchmarks(rows: BenchmarkRow[]): Map<string, Map<string, StrengthBenchmark>> {
  const byTest = new Map<string, Map<string, StrengthBenchmark>>();
  for (const row of rows) {
    if (!byTest.has(row.test_id)) byTest.set(row.test_id, new Map());
    byTest.get(row.test_id)!.set(row.age_band_id, {
      higher_is_better: row.higher_is_better,
      score_5_boundary: row.score_5_boundary,
      score_4_boundary: row.score_4_boundary,
      score_3_boundary: row.score_3_boundary,
      score_2_boundary: row.score_2_boundary,
    });
  }
  return byTest;
}

type StrengthTestLike = { id: string; unit: string };
type StrengthResultLike = { score: number | null };
type StrengthAgeBandLike = { id: string; min_age: number; max_age: number | null; gender: string | null };

export function computeStrengthCategoryScore(
  playerAge: number,
  playerGender: string | null,
  strengthTests: StrengthTestLike[],
  resultByTest: Map<string, StrengthResultLike>,
  ageBands: StrengthAgeBandLike[],
  benchmarksByTest: Map<string, Map<string, StrengthBenchmark>>
): number | null {
  if (strengthTests.length === 0) return null;

  const band = findStrengthAgeBand(playerAge, playerGender, ageBands);
  if (!band) return null;

  const ratings: number[] = [];
  for (const test of strengthTests) {
    const result = resultByTest.get(test.id);
    if (!result || result.score == null) return null;

    const benchmark = benchmarksByTest.get(test.id)?.get(band.id);
    if (!benchmark) return null;

    const rating = rateStrengthTest(result.score, benchmark);
    if (rating == null) return null;
    ratings.push(rating);
  }

  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}