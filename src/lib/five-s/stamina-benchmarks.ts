// Stamina scoring: each (test, age band) has four band boundaries that
// divide a raw result into the five Kickstart performance bands (Score 5..1).
// Direction is per test and stored on the benchmark row:
//   - Yo-Yo Intermittent is higher-is-better (completed level). The four
//     boundaries are the band minimums (floors): score 5 >= score_5_boundary,
//     score 4 >= score_4_boundary, score 3 >= score_3_boundary,
//     score 2 >= score_2_boundary, and score 1 is anything below
//     score_2_boundary.
//   - Repeated Sprint Ability (RSA) is lower-is-better (mean time). The four
//     boundaries are the band maximums (ceilings): score 5 <= score_5_boundary,
//     score 4 <= score_4_boundary, score 3 <= score_3_boundary,
//     score 2 <= score_2_boundary, and score 1 is anything above
//     score_2_boundary.
//
// SOURCE-BOUNDARY NOTE: the Kickstart source prints its bands as ranges and
// leaves a few one-decimal gaps (e.g. U-13 Yo-Yo: 16.9 and 17.0 sit between
// Score 3's "15.6-16.8" and Score 4's "17.1-18.4"; 14.0 sits between Score
// 1's "<14.0" and Score 2's "14.1-15.5"). The four-boundary representation
// is contiguous by design, so those gap values resolve to the lower band:
// for higher-is-better a value below score_4_boundary but at/above
// score_3_boundary rates 3, and a value below score_2_boundary rates 1.
// The source values themselves are stored unmodified — nothing is rounded or
// "corrected" — this resolution rule is the deterministic interpretation
// required by the contiguous 5-band scoring shape.

export type StaminaBenchmark = {
  higher_is_better: boolean;
  score_5_boundary: number;
  score_4_boundary: number;
  score_3_boundary: number;
  score_2_boundary: number;
};

// The four boundaries, in ascending score order (score_5 first), for the
// super_admin benchmark editor to iterate.
export const STAMINA_BENCHMARK_BOUNDARIES = [
  "score_5_boundary",
  "score_4_boundary",
  "score_3_boundary",
  "score_2_boundary",
] as const;
export type StaminaBenchmarkBoundary = (typeof STAMINA_BENCHMARK_BOUNDARIES)[number];

// Direction is a fixed property of each Stamina test (seeded reference
// data): Yo-Yo Intermittent records a completed level (higher is better);
// RSA records a mean time (lower is better). The direction is stored
// explicitly on each benchmark row (higher_is_better column), not inferred
// from the unit string. This function is kept for reference but should not
// be used for scoring — scoring uses the benchmark row's higher_is_better.
export function isHigherIsBetter(unit: string): boolean {
  return unit === "level";
}

export function rateStaminaTest(value: number, benchmark: StaminaBenchmark): number {
  if (benchmark.higher_is_better) {
    if (value >= benchmark.score_5_boundary) return 5;
    if (value >= benchmark.score_4_boundary) return 4;
    if (value >= benchmark.score_3_boundary) return 3;
    if (value >= benchmark.score_2_boundary) return 2;
    return 1;
  }
  if (value <= benchmark.score_5_boundary) return 5;
  if (value <= benchmark.score_4_boundary) return 4;
  if (value <= benchmark.score_3_boundary) return 3;
  if (value <= benchmark.score_2_boundary) return 2;
  return 1;
}

type StaminaAgeBand = {
  id: string;
  label?: string;
  min_age: number;
  max_age: number | null;
  gender: string | null;
};

function inRange(age: number, band: StaminaAgeBand): boolean {
  return age >= band.min_age && (band.max_age == null || age <= band.max_age);
}

// Gender-aware age-band lookup: "U-17 Girls" (gender = 'Female') overlaps
// "U-17" by age, so a gender-specific band that matches both age and gender
// wins; otherwise the gender-agnostic band for the age range applies.
export function findStaminaAgeBand(
  age: number,
  gender: string | null,
  bands: StaminaAgeBand[]
): StaminaAgeBand | undefined {
  const gendered = bands.find((b) => b.gender != null && b.gender === gender && inRange(age, b));
  if (gendered) return gendered;
  return bands.find((b) => b.gender == null && inRange(age, b));
}

type BenchmarkRow = {
  test_id: string;
  age_band_id: string;
  higher_is_better: boolean;
  score_5_boundary: number;
  score_4_boundary: number;
  score_3_boundary: number;
  score_2_boundary: number;
};

// Shared by every reader of five_s_stamina_benchmarks (scores.ts, the
// super_admin stamina page) so the row -> nested-Map shape lives in one place.
export function groupStaminaBenchmarks(rows: BenchmarkRow[]): Map<string, Map<string, StaminaBenchmark>> {
  const byTest = new Map<string, Map<string, StaminaBenchmark>>();
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

type StaminaTestLike = { id: string; unit: string };
type StaminaResultLike = { score: number | null };
type StaminaAgeBandLike = { id: string; min_age: number; max_age: number | null; gender: string | null };

// Averages both Stamina tests' 1-5 ratings; returns null unless every test
// has both a recorded result and a configured benchmark for the player's
// age band (both tests are required for a valid Stamina category score).
export function computeStaminaCategoryScore(
  playerAge: number,
  playerGender: string | null,
  staminaTests: StaminaTestLike[],
  resultByTest: Map<string, StaminaResultLike>,
  ageBands: StaminaAgeBandLike[],
  benchmarksByTest: Map<string, Map<string, StaminaBenchmark>>
): number | null {
  if (staminaTests.length === 0) return null;

  const band = findStaminaAgeBand(playerAge, playerGender, ageBands);
  if (!band) return null;

  const ratings: number[] = [];
  for (const test of staminaTests) {
    const result = resultByTest.get(test.id);
    if (!result || result.score == null) return null;

    const benchmark = benchmarksByTest.get(test.id)?.get(band.id);
    if (!benchmark) return null;

    ratings.push(rateStaminaTest(result.score, benchmark));
  }

  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
