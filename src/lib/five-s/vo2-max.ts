// Pure formulas, no server-only dependency — imported by both the coach's
// stamina-score-form.tsx (live preview as the coach types) and
// submitStaminaScores (authoritative value actually saved). The server
// always recomputes from the submitted raw score rather than trusting
// whatever the client displayed, so there's one source of truth even
// though the formula itself lives in one shared place.

// Ramsbottom Equation (British Journal of Sports Medicine) — standard
// Beep/Bleep Test VO2 Max estimate from final level (L) and shuttle (S).
export function vo2MaxFromBeepTest(level: number, shuttle: number): number {
  return 3.46 * (level + shuttle / (level * 0.4325 + 7.0048)) + 12.2;
}

// Cooper (1968) 12-minute run regression equation — the original, most
// widely cited Cooper Test VO2 Max estimate from distance covered.
export function vo2MaxFromCooperTest(distanceMeters: number): number {
  return (distanceMeters - 504.9) / 44.73;
}
