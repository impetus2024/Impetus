"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import {
  STAMINA_BENCHMARK_TIERS,
  comparePoints,
  type BenchmarkPoint,
  type StaminaBenchmarkTier,
} from "@/lib/five-s/stamina-benchmarks";

export type BenchmarkFormState = { error?: string } | undefined;

const PATH = "/super-admin/5s-model/stamina";

// One test's Poor/Average/Elite thresholds across every age band are
// submitted as a single form/dialog, so this saves all of them (or none)
// in one round trip. isBeepTest picks which field names to read per cell —
// Level+Shuttle for Beep Test, a plain value for Cooper Test.
export async function saveStaminaBenchmarks(
  testId: string,
  isBeepTest: boolean,
  ageBandIds: string[],
  _prev: BenchmarkFormState,
  formData: FormData
): Promise<BenchmarkFormState> {
  await requireRole("super_admin");

  const rows: {
    test_id: string;
    age_band_id: string;
    tier: StaminaBenchmarkTier;
    value: number | null;
    level: number | null;
    shuttle: number | null;
  }[] = [];

  for (const ageBandId of ageBandIds) {
    const points: BenchmarkPoint[] = [];

    for (const tier of STAMINA_BENCHMARK_TIERS) {
      if (isBeepTest) {
        const level = Number(formData.get(`${ageBandId}_${tier}_level`));
        const shuttle = Number(formData.get(`${ageBandId}_${tier}_shuttle`));
        if (!Number.isInteger(level) || level < 0 || !Number.isInteger(shuttle) || shuttle < 0) {
          return { error: "Every Level/Shuttle value is required and must be 0 or greater." };
        }
        rows.push({ test_id: testId, age_band_id: ageBandId, tier, value: null, level, shuttle });
        points.push({ value: null, level, shuttle });
      } else {
        const value = Number(formData.get(`${ageBandId}_${tier}_value`));
        if (!Number.isFinite(value) || value < 0) {
          return { error: "Every value is required and must be 0 or greater." };
        }
        rows.push({ test_id: testId, age_band_id: ageBandId, tier, value, level: null, shuttle: null });
        points.push({ value, level: null, shuttle: null });
      }
    }

    for (let i = 1; i < points.length; i++) {
      if (comparePoints(points[i], points[i - 1]) < 0) {
        return { error: "For every age, Poor ≤ Average-low ≤ Average-high ≤ Elite must hold." };
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("five_s_stamina_benchmarks")
    .upsert(rows, { onConflict: "test_id,age_band_id,tier" });

  if (error) {
    logError(`Failed to save stamina benchmarks for test ${testId}:`, error);
    return { error: "Failed to save." };
  }

  revalidatePath(PATH);
  return undefined;
}
