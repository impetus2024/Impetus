import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { groupStrengthBenchmarks } from "@/lib/five-s/strength-benchmarks";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StrengthBenchmarkDialog } from "./benchmark-dialog";

export default async function SuperAdminStrengthBenchmarksPage() {
  await requireRole("super_admin");

  const tests = (await getFiveSTests()).filter((t) => t.category === "strength");
  const testIds = tests.map((t) => t.id);

  const supabase = await createClient();
  const [{ data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase
      .from("five_s_age_bands")
      .select("id, label")
      .eq("category", "strength")
      .order("display_order"),
    testIds.length > 0
      ? supabase
          .from("five_s_strength_benchmarks")
          .select("test_id, age_band_id, higher_is_better, score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary")
          .in("test_id", testIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bands = ageBands ?? [];
  const benchmarksByTest = groupStrengthBenchmarks(benchmarkRows ?? []);

  // Each Strength test has a single direction across all age bands.
  // Extract it from the first benchmark row for the test.
  const higherIsBetterByTest = new Map<string, boolean>();
  for (const test of tests) {
    const testBenchmarks = benchmarksByTest.get(test.id);
    if (testBenchmarks && testBenchmarks.size > 0) {
      const firstBenchmark = testBenchmarks.values().next().value;
      if (firstBenchmark) {
        higherIsBetterByTest.set(test.id, firstBenchmark.higher_is_better);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Strength Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Set the five Kickstart performance bands (Score 5–1) each age group needs to hit on every
          Strength test. All current Strength tests are higher-is-better.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Test</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Age Bands Set</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((test) => {
            const existing = benchmarksByTest.get(test.id) ?? new Map();
            const completeBands = bands.filter((band) => existing.has(band.id)).length;
            const higherIsBetter = higherIsBetterByTest.get(test.id) ?? true;

            return (
              <TableRow key={test.id}>
                <TableCell>{test.name}</TableCell>
                <TableCell>{test.unit || "—"}</TableCell>
                <TableCell>
                  {completeBands} / {bands.length}
                </TableCell>
                <TableCell className="text-right">
                  <StrengthBenchmarkDialog
                    testId={test.id}
                    testName={test.name}
                    higherIsBetter={higherIsBetter}
                    unit={test.unit}
                    ageBands={bands}
                    existingBenchmarks={existing}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {tests.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState icon={Sparkles} title="No tests in this category yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}