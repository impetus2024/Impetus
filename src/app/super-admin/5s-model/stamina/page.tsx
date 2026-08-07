import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests } from "@/lib/five-s/catalog";
import { STAMINA_BENCHMARK_TIERS, groupStaminaBenchmarks } from "@/lib/five-s/stamina-benchmarks";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaminaBenchmarkDialog } from "./benchmark-dialog";

export default async function SuperAdminStaminaBenchmarksPage() {
  await requireRole("super_admin");

  const tests = (await getFiveSTests()).filter((t) => t.category === "stamina");
  const testIds = tests.map((t) => t.id);

  const supabase = await createClient();
  const [{ data: ageBands }, { data: benchmarkRows }] = await Promise.all([
    supabase
      .from("five_s_age_bands")
      .select("id, label")
      .eq("category", "stamina")
      .order("display_order"),
    testIds.length > 0
      ? supabase
          .from("five_s_stamina_benchmarks")
          .select("test_id, age_band_id, tier, value, level, shuttle")
          .in("test_id", testIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bands = ageBands ?? [];
  const benchmarksByTest = groupStaminaBenchmarks(benchmarkRows ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stamina Benchmarks</h1>
        <p className="text-sm text-muted-foreground">
          Set the Poor / Average / Elite thresholds each age needs to hit on every Stamina test.
          Beep Test uses Level/Shuttle pairs; Cooper Test uses distance. VO2 Max is auto-calculated
          from these when a coach records a score — never entered manually.
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
            const completeBands = bands.filter((band) => {
              const benchmark = existing.get(band.id);
              return benchmark && STAMINA_BENCHMARK_TIERS.every((tier) => benchmark[tier]);
            }).length;

            return (
              <TableRow key={test.id}>
                <TableCell>{test.name}</TableCell>
                <TableCell>{test.unit || "—"}</TableCell>
                <TableCell>
                  {completeBands} / {bands.length}
                </TableCell>
                <TableCell className="text-right">
                  <StaminaBenchmarkDialog
                    testId={test.id}
                    testName={test.name}
                    isBeepTest={test.unit === "level"}
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
