"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { SPEED_BENCHMARK_CEILINGS } from "@/lib/five-s/speed-benchmarks";

export type BenchmarkFormState = { error?: string } | undefined;

const PATH = "/super-admin/5s-model/speed";

// One test's benchmarks across every age band are submitted as a single
// form/dialog, so this saves all of them (or none) in one round trip.
// The four Score 5..2 ceilings define five bands (Score 1 is anything above
// the Score 2 ceiling); faster = better, so the ceilings must increase.
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
    score_5_ceiling: number;
    score_4_ceiling: number;
    score_3_ceiling: number;
    score_2_ceiling: number;
  }[] = [];

  for (const ageBandId of ageBandIds) {
    const values = SPEED_BENCHMARK_CEILINGS.map((ceiling) => Number(formData.get(`${ageBandId}_${ceiling}`)));
    if (!values.every((n) => Number.isFinite(n) && n >= 0)) {
      return { error: "Every Score 5–2 ceiling is required and must be 0 or greater." };
    }
    const [score_5_ceiling, score_4_ceiling, score_3_ceiling, score_2_ceiling] = values;
    if (!(score_5_ceiling < score_4_ceiling && score_4_ceiling < score_3_ceiling && score_3_ceiling < score_2_ceiling)) {
      return { error: "Ceilings must increase: Score 5 < Score 4 < Score 3 < Score 2." };
    }

    rows.push({
      test_id: testId,
      age_band_id: ageBandId,
      score_5_ceiling,
      score_4_ceiling,
      score_3_ceiling,
      score_2_ceiling,
    });
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
