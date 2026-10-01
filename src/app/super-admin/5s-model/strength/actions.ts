"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import {
  STRENGTH_BENCHMARK_BOUNDARIES,
} from "@/lib/five-s/strength-benchmarks";

export type BenchmarkFormState = { error?: string } | undefined;

const PATH = "/super-admin/5s-model/strength";

export async function saveStrengthBenchmarks(
  testId: string,
  higherIsBetter: boolean,
  ageBandIds: string[],
  _prev: BenchmarkFormState,
  formData: FormData
): Promise<BenchmarkFormState> {
  await requireRole("super_admin");

  const rows: {
    test_id: string;
    age_band_id: string;
    higher_is_better: boolean;
    score_5_boundary: number | null;
    score_4_boundary: number;
    score_3_boundary: number;
    score_2_boundary: number;
  }[] = [];

  for (const ageBandId of ageBandIds) {
    const values = STRENGTH_BENCHMARK_BOUNDARIES.map((boundary) => {
      const raw = formData.get(`${ageBandId}_${boundary}`);
      if (raw === null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    });

    const [score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary] = values;

    // Score 5 boundary can be null (e.g., Push-Up Test U-13 "nbb" in source)
    // Score 4/3/2 boundaries are required
    if (score_4_boundary == null || score_3_boundary == null || score_2_boundary == null) {
      return { error: "Score 4, 3, and 2 boundaries are required and must be 0 or greater." };
    }
    if (!(score_4_boundary > score_3_boundary && score_3_boundary > score_2_boundary)) {
      return { error: "Boundaries must decrease: Score 4 > Score 3 > Score 2." };
    }
    if (score_5_boundary != null && !(score_5_boundary > score_4_boundary)) {
      return { error: "Score 5 boundary must be greater than Score 4 boundary." };
    }

    rows.push({
      test_id: testId,
      age_band_id: ageBandId,
      higher_is_better: higherIsBetter,
      score_5_boundary,
      score_4_boundary,
      score_3_boundary,
      score_2_boundary,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("five_s_strength_benchmarks")
    .upsert(rows, { onConflict: "test_id,age_band_id" });

  if (error) {
    logError(`Failed to save strength benchmarks for test ${testId}:`, error);
    return { error: "Failed to save." };
  }

  revalidatePath(PATH);
  return undefined;
}