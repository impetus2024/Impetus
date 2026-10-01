// Speed scoring: each (test, age band) has four ceiling points —
// score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling —
// dividing a raw time into 5 bands for a 1-5 rating. Speed is always
// time-based (lower is better), so the fastest times earn the highest
// score: at or below score_5_ceiling = 5 ... above score_2_ceiling = 1.
//
// Unlike Stamina (higher is better), there is no Level/Shuttle shape here —
// every Speed result is a plain seconds value, so a benchmark point is just
// a number.

export type SpeedBenchmark = {
  score_5_ceiling: number;
  score_4_ceiling: number;
  score_3_ceiling: number;
  score_2_ceiling: number;
};

// The four ceilings, in ascending score order (score_5 first), for the
// super_admin benchmark editor to iterate.
export const SPEED_BENCHMARK_CEILINGS = [
  "score_5_ceiling",
  "score_4_ceiling",
  "score_3_ceiling",
  "score_2_ceiling",
] as const;
export type SpeedBenchmarkCeiling = (typeof SPEED_BENCHMARK_CEILINGS)[number];

export function rateSpeedTest(value: number, benchmark: SpeedBenchmark): number | null {
  if (value <= benchmark.score_5_ceiling) return 5;
  if (value <= benchmark.score_4_ceiling) return 4;
  if (value <= benchmark.score_3_ceiling) return 3;
  if (value <= benchmark.score_2_ceiling) return 2;
  return 1;
}

type SpeedAgeBand = {
  id: string;
  // Only present when the caller selects it — the coach score form reads the
  // label to pick that age group's test distance. Scoring itself never needs
  // it, so it stays optional (callers that pass id/range/gender only, e.g.
  // SpeedBenchmarkContext.ageBands, are still valid bands).
  label?: string;
  min_age: number;
  max_age: number | null;
  gender: string | null;
};

function inRange(age: number, band: SpeedAgeBand): boolean {
  return age >= band.min_age && (band.max_age == null || age <= band.max_age);
}

// Gender-aware age-band lookup: "U-17 Girls" (gender = 'Female') overlaps
// "U-17" by age, so a gender-specific band that matches both age and gender
// wins; otherwise the gender-agnostic band for the age range applies.
export function findSpeedAgeBand(
  age: number,
  gender: string | null,
  bands: SpeedAgeBand[]
): SpeedAgeBand | undefined {
  const gendered = bands.find((b) => b.gender != null && b.gender === gender && inRange(age, b));
  if (gendered) return gendered;
  return bands.find((b) => b.gender == null && inRange(age, b));
}

type BenchmarkRow = {
  test_id: string;
  age_band_id: string;
  score_5_ceiling: number;
  score_4_ceiling: number;
  score_3_ceiling: number;
  score_2_ceiling: number;
};

// Shared by every reader of five_s_test_benchmarks (scores.ts, the
// super_admin speed page) so the row -> nested-Map shape lives in one place.
export function groupSpeedBenchmarks(rows: BenchmarkRow[]): Map<string, Map<string, SpeedBenchmark>> {
  const byTest = new Map<string, Map<string, SpeedBenchmark>>();
  for (const row of rows) {
    if (!byTest.has(row.test_id)) byTest.set(row.test_id, new Map());
    byTest.get(row.test_id)!.set(row.age_band_id, {
      score_5_ceiling: row.score_5_ceiling,
      score_4_ceiling: row.score_4_ceiling,
      score_3_ceiling: row.score_3_ceiling,
      score_2_ceiling: row.score_2_ceiling,
    });
  }
  return byTest;
}

type SpeedTestLike = { id: string; unit: string };
type SpeedResultLike = { score: number | null };
type SpeedAgeBandLike = { id: string; min_age: number; max_age: number | null; gender: string | null };

// Averages every Speed test's 1-5 rating; returns null unless every test
// has both a recorded result and a configured benchmark for the player's
// age band (same "no partial score" rule as Stamina). Time-based, so
// faster results rate higher.
export function computeSpeedCategoryScore(
  playerAge: number,
  playerGender: string | null,
  speedTests: SpeedTestLike[],
  resultByTest: Map<string, SpeedResultLike>,
  ageBands: SpeedAgeBandLike[],
  benchmarksByTest: Map<string, Map<string, SpeedBenchmark>>
): number | null {
  if (speedTests.length === 0) return null;

  const band = findSpeedAgeBand(playerAge, playerGender, ageBands);
  if (!band) return null;

  const ratings: number[] = [];
  for (const test of speedTests) {
    const result = resultByTest.get(test.id);
    if (!result || result.score == null) return null;

    const benchmark = benchmarksByTest.get(test.id)?.get(band.id);
    if (!benchmark) return null;

    const rating = rateSpeedTest(result.score, benchmark);
    if (rating == null) return null;
    ratings.push(rating);
  }

  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
