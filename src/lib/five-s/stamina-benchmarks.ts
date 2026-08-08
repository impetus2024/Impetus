// Stamina scoring: unlike Speed's single Min/Max/Avg, each (test, age band)
// has 4 threshold points — poor_ceiling, average_low, average_high,
// elite_floor — dividing a raw result into 5 zones for a 1-5 rating.
// A point is either a plain number (Cooper Test, metres) or a Level/Shuttle
// pair (Beep Test), compared lexicographically: level first, shuttle only
// breaks a tie within the same level (see five_s_stamina_benchmarks_shape
// check constraint — exactly one of the two shapes is ever set).

export const STAMINA_BENCHMARK_TIERS = [
  "poor_ceiling",
  "average_low",
  "average_high",
  "elite_floor",
] as const;
export type StaminaBenchmarkTier = (typeof STAMINA_BENCHMARK_TIERS)[number];

export type BenchmarkPoint = { value: number | null; level: number | null; shuttle: number | null };
export type TestBenchmark = Partial<Record<StaminaBenchmarkTier, BenchmarkPoint>>;

export type RawStaminaScore = { value: number } | { level: number; shuttle: number };

// Compares two benchmark points directly — used to sanity-check that a
// super_admin entered poor_ceiling <= average_low <= average_high <=
// elite_floor for a given age band, since nothing at the DB level enforces
// tier ordering.
export function comparePoints(a: BenchmarkPoint, b: BenchmarkPoint): number {
  if (a.value != null || b.value != null) return (a.value ?? 0) - (b.value ?? 0);
  const aLevel = a.level ?? 0;
  const bLevel = b.level ?? 0;
  if (aLevel !== bLevel) return aLevel - bLevel;
  return (a.shuttle ?? 0) - (b.shuttle ?? 0);
}

function comparePoint(raw: RawStaminaScore, point: BenchmarkPoint): number {
  const rawAsPoint: BenchmarkPoint =
    "value" in raw
      ? { value: raw.value, level: null, shuttle: null }
      : { value: null, level: raw.level, shuttle: raw.shuttle };
  return comparePoints(rawAsPoint, point);
}

// null when the benchmark for this test+age isn't fully configured yet
// (all 4 tiers required) — callers treat that the same as "not recorded".
export function rateStaminaTest(raw: RawStaminaScore, benchmark: TestBenchmark): number | null {
  const { poor_ceiling, average_low, average_high, elite_floor } = benchmark;
  if (!poor_ceiling || !average_low || !average_high || !elite_floor) return null;

  if (comparePoint(raw, poor_ceiling) < 0) return 1;
  if (comparePoint(raw, average_low) < 0) return 2;
  if (comparePoint(raw, average_high) <= 0) return 3;
  if (comparePoint(raw, elite_floor) <= 0) return 4;
  return 5;
}

export function findAgeBand<T extends { min_age: number; max_age: number | null }>(
  age: number,
  bands: T[]
): T | undefined {
  return bands.find((b) => age >= b.min_age && (b.max_age == null || age <= b.max_age));
}

type BenchmarkRow = {
  test_id: string;
  age_band_id: string;
  tier: StaminaBenchmarkTier;
  value: number | null;
  level: number | null;
  shuttle: number | null;
};

// Shared by every reader of five_s_stamina_benchmarks (scores.ts,
// FiveSResultsView, the coach's stamina page) so the row -> nested-Map
// shape lives in one place.
export function groupStaminaBenchmarks(rows: BenchmarkRow[]): Map<string, Map<string, TestBenchmark>> {
  const byTest = new Map<string, Map<string, TestBenchmark>>();
  for (const row of rows) {
    if (!byTest.has(row.test_id)) byTest.set(row.test_id, new Map());
    const byAgeBand = byTest.get(row.test_id)!;
    if (!byAgeBand.has(row.age_band_id)) byAgeBand.set(row.age_band_id, {});
    byAgeBand.get(row.age_band_id)![row.tier] = { value: row.value, level: row.level, shuttle: row.shuttle };
  }
  return byTest;
}

type StaminaTestLike = { id: string; unit: string };
type StaminaResultLike = { score: number | null; level: number | null; shuttle: number | null };
type AgeBandLike = { id: string; min_age: number; max_age: number | null };

// Averages both Stamina tests' 1-5 ratings; returns null unless every test
// has both a recorded result and a configured benchmark (product decision:
// no partial Stamina score until Beep Test and Cooper Test are both in).
export function computeStaminaCategoryScore(
  playerAge: number,
  staminaTests: StaminaTestLike[],
  resultByTest: Map<string, StaminaResultLike>,
  ageBands: AgeBandLike[],
  benchmarksByTest: Map<string, Map<string, TestBenchmark>>
): number | null {
  if (staminaTests.length === 0) return null;

  const band = findAgeBand(playerAge, ageBands);
  if (!band) return null;

  const ratings: number[] = [];
  for (const test of staminaTests) {
    const result = resultByTest.get(test.id);
    if (!result) return null;

    const raw: RawStaminaScore | null =
      test.unit === "level"
        ? result.level != null && result.shuttle != null
          ? { level: result.level, shuttle: result.shuttle }
          : null
        : result.score != null
          ? { value: result.score }
          : null;
    if (!raw) return null;

    const benchmark = benchmarksByTest.get(test.id)?.get(band.id);
    if (!benchmark) return null;

    const rating = rateStaminaTest(raw, benchmark);
    if (rating == null) return null;
    ratings.push(rating);
  }

  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
