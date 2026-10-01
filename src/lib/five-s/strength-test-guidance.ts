// Protocol guidance for Strength tests. The BENCH MARK.xlsx workbook
// does not provide protocol/guidance text — only test names, units,
// and benchmark values. This resolver returns null so the coach UI
// displays no invented guidance.
//
// If future Strength tests gain official protocol guidance, add entries
// here keyed by test name and age band label.
export function strengthTestGuidance(_testName: string, _ageBandLabel: string | null): string | null {
  return null;
}