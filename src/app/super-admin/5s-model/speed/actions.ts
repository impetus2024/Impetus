"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export type BenchmarkFormState = { error?: string } | undefined;

const PATH = "/super-admin/5s-model/speed";

// One test's benchmarks across every age band are submitted as a single
// form/dialog, so this saves all of them (or none) in one round trip.
export async function saveSpeedBenchmarks(
  testId: string,
  ageBandIds: string[],
  _prev: BenchmarkFormState,
  formData: FormData
): Promise<BenchmarkFormState> {
  await requireRole("super_admin");

  const rows: {
    test_id: string;
    age_band_id: string;
    min_value: number;
    max_value: number;
    avg_value: number;
  }[] = [];

  for (const ageBandId of ageBandIds) {
    const min = Number(formData.get(`min_${ageBandId}`));
    const max = Number(formData.get(`max_${ageBandId}`));
    const avg = Number(formData.get(`avg_${ageBandId}`));

    if (![min, max, avg].every((n) => Number.isFinite(n) && n >= 0)) {
      return { error: "Min, Max, and Avg are required and must be 0 or greater." };
    }
    if (min > max) {
      return { error: "Min cannot be greater than Max." };
    }
    if (avg < min || avg > max) {
      return { error: "Avg must be between Min and Max." };
    }

    rows.push({ test_id: testId, age_band_id: ageBandId, min_value: min, max_value: max, avg_value: avg });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("five_s_test_benchmarks")
    .upsert(rows, { onConflict: "test_id,age_band_id" });

  if (error) {
    logError(`Failed to save speed benchmarks for test ${testId}:`, error);
    return { error: "Failed to save." };
  }

  revalidatePath(PATH);
  return undefined;
}
