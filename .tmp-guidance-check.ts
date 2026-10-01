import { speedTestDistanceGuidance } from "./src/lib/five-s/speed-test-guidance";

const testCases = [
  { test: "Arrowhead Agility (R/L)", band: "U-13", expected: "Distance: 8×4×4 m R/L" },
  { test: "Arrowhead Agility (R/L)", band: "U-15", expected: "Distance: 8×4×4 m R/L" },
  { test: "Arrowhead Agility (R/L)", band: "U-17", expected: "R/L" },
  { test: "Arrowhead Agility (R/L)", band: "U-19+", expected: "R/L" },
  { test: "Arrowhead Agility (R/L)", band: "U-17 Girls", expected: "R/L" },
];

console.log("Testing Arrowhead Agility (R/L) guidance:");
let allPassed = true;
for (const tc of testCases) {
  const result = speedTestDistanceGuidance(tc.test, tc.band);
  const passed = result === tc.expected;
  console.log(`  ${tc.test} / ${tc.band}: "${result}" ${passed ? "✓" : "✗ EXPECTED: " + tc.expected}`);
  if (!passed) allPassed = false;
}

// Also verify existing tests still work
const existingTests = [
  { test: "Flying Start", band: "U-13", expected: "Distance: 20 m" },
  { test: "Flying Start", band: "U-17", expected: "Distance: 30 m" },
  { test: "Curve Sprint (R/L)", band: "U-13", expected: "Distance: 15 m" },
  { test: "Curve Sprint (R/L)", band: "U-17", expected: "Distance: 20 m" },
  { test: "10 m Sprint", band: "U-13", expected: null },
];

console.log("\nVerifying existing guidance unchanged:");
for (const tc of existingTests) {
  const result = speedTestDistanceGuidance(tc.test, tc.band);
  const passed = result === tc.expected;
  console.log(`  ${tc.test} / ${tc.band}: "${result}" ${passed ? "✓" : "✗ EXPECTED: " + tc.expected}`);
  if (!passed) allPassed = false;
}

console.log(allPassed ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
process.exit(allPassed ? 0 : 1);