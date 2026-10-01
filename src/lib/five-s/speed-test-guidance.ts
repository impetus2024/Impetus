// How far each age group runs the Speed tests whose course length changes
// with age. Keyed by the five_s_age_bands.label values seeded in
// 20260927000000_five_s_speed_benchmark_bands.sql, and by test name the same
// way that migration joins benchmarks to tests — the seeded reference data
// stays the single source of truth for which group a player falls into, this
// only maps an already-resolved band to the distance the coach has to set up.
// Tests that use one course for every age group (10 m Sprint) have no entry
// here and so show no distance line. Arrowhead Agility (R/L) has age-specific
// guidance per KICKSTART INTERPRETATION but not a simple meter value for all
// bands.
const SPEED_TEST_DISTANCE_GUIDANCE: Record<string, Record<string, string>> = {
  "Flying Start": {
    "U-13": "Distance: 20 m",
    "U-15": "Distance: 20 m",
    "U-17": "Distance: 30 m",
    "U-19+": "Distance: 30 m",
    "U-17 Girls": "Distance: 30 m",
  },
  "Curve Sprint (R/L)": {
    "U-13": "Distance: 15 m",
    "U-15": "Distance: 15 m",
    "U-17": "Distance: 20 m",
    "U-19+": "Distance: 20 m",
    "U-17 Girls": "Distance: 20 m",
  },
  "Arrowhead Agility (R/L)": {
    "U-13": "Distance: 8×4×4 m R/L",
    "U-15": "Distance: 8×4×4 m R/L",
    "U-17": "R/L",
    "U-19+": "R/L",
    "U-17 Girls": "R/L",
  },
};

// Coach-facing line for the score form, or null when the test has no
// age-specific distance — or when the player has no band (e.g. no date of
// birth), in which case the form falls back to showing nothing extra. The
// wording lives here rather than in the form so the client component only
// ever renders a string it was handed.
export function speedTestDistanceGuidance(testName: string, ageBandLabel: string | null): string | null {
  if (ageBandLabel == null) return null;
  return SPEED_TEST_DISTANCE_GUIDANCE[testName]?.[ageBandLabel] ?? null;
}
