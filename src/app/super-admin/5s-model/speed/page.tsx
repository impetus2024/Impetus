import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { groupSpeedBenchmarks } from "@/lib/five-s/speed-benchmarks";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SpeedBenchmarkDialog } from "./benchmark-dialog";

export default async function SuperAdminSpeedBenchmarksPage() {
  await requireRole("super_admin");

  const tests = (await getFiveSTests()).filter((t) => t.category === "speed");
  const testIds = tests.map((t) => t.id);

  const supabase = await createClient();
  const [{ data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase
      .from("five_s_age_bands")
      .select("id, label")
      .eq("category", "speed")
      .order("display_order"),
    testIds.length > 0
      ? supabase
          .from("five_s_test_benchmarks")
          .select("test_id, age_band_id, score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling")
          .in("test_id", testIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bands = ageBands ?? [];
  const benchmarksByTest = groupSpeedBenchmarks(benchmarkRows ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Speed Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Set the five performance bands (Score 5–1) each age group needs to hit on every Speed test.
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
            return (
              <TableRow key={test.id}>
                <TableCell>{test.name}</TableCell>
                <TableCell>{test.unit || "—"}</TableCell>
                <TableCell>
                  {existing.size} / {bands.length}
                </TableCell>
                <TableCell className="text-right">
                  <SpeedBenchmarkDialog
                    testId={test.id}
                    testName={test.name}
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
