import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests } from "@/lib/five-s/catalog";
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
  const [{ data: ageBands }, { data: benchmarks }] = await Promise.all([
    supabase
      .from("five_s_age_bands")
      .select("id, label")
      .eq("category", "speed")
      .order("display_order"),
    testIds.length > 0
      ? supabase
          .from("five_s_test_benchmarks")
          .select("test_id, age_band_id, min_value, max_value, avg_value")
          .in("test_id", testIds)
      : Promise.resolve({ data: [] as { test_id: string; age_band_id: string; min_value: number; max_value: number; avg_value: number }[] }),
  ]);

  const bands = ageBands ?? [];
  const benchmarksByTest = new Map<string, Map<string, { min: number; max: number; avg: number }>>();
  for (const b of benchmarks ?? []) {
    if (!benchmarksByTest.has(b.test_id)) benchmarksByTest.set(b.test_id, new Map());
    benchmarksByTest.get(b.test_id)!.set(b.age_band_id, { min: b.min_value, max: b.max_value, avg: b.avg_value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Speed Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Set the Min/Max/Avg score each age group needs to hit on every Speed test.
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
