// How far each age group runs the Stamina tests whose protocol changes with
// age. Keyed by the five_s_age_bands.label values seeded in
// 20260928000000_five_s_stamina_benchmark_bands.sql, and by test name the
// same way that migration joins benchmarks to tests — the seeded reference
// data stays the single source of truth for which group a player falls into,
// this only maps an already-resolved band to the protocol the coach has to
// set up.
const STAMINA_TEST_GUIDANCE: Record<string, Record<string, string>> = {
  "Yo-Yo Intermittent": {
    "U-13": "Yo-Yo IR1 adapted 17 m",
    "U-15": "Yo-Yo IR1 20 m",
    "U-17": "Yo-Yo IR1",
    "U-19+": "Yo-Yo IR1",
    "U-17 Girls": "Yo-Yo IR1",
  },
  "Repeated Sprint Ability (RSA)": {
    "U-13": "RSA 6 × 20 m — mean (s)",
    "U-15": "RSA 6 × 20 m — mean (s)",
    "U-17": "RSA 6 × 30 m — mean (s)",
    "U-19+": "RSA 6 × 30 m — mean (s)",
    "U-17 Girls": "RSA 6 × 30 m — mean (s)",
  },
};

// Coach-facing line for the score form, or null when the test has no
// age-specific protocol — or when the player has no band (e.g. no date of
// birth), in which case the form falls back to showing nothing extra.
export function staminaTestGuidance(testName: string, ageBandLabel: string | null): string | null {
  if (ageBandLabel == null) return null;
  return STAMINA_TEST_GUIDANCE[testName]?.[ageBandLabel] ?? null;
}
