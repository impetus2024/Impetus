"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import {
  STAMINA_BENCHMARK_BOUNDARIES,
} from "@/lib/five-s/stamina-benchmarks";

export type BenchmarkFormState = { error?: string } | undefined;

const PATH = "/super-admin/5s-model/stamina";

// One test's five Score 5..1 band boundaries across every age band are
// submitted as a single form/dialog, so this saves all of them (or none)
// in one round trip. higherIsBetter decides the label direction and the
// monotonicity check (Yo-Yo floors decrease, RSA ceilings increase).
export async function saveStaminaBenchmarks(
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
    score_5_boundary: number;
    score_4_boundary: number;
    score_3_boundary: number;
    score_2_boundary: number;
  }[] = [];

  for (const ageBandId of ageBandIds) {
    const values = STAMINA_BENCHMARK_BOUNDARIES.map((boundary) => Number(formData.get(`${ageBandId}_${boundary}`)));
    if (!values.every((n) => Number.isFinite(n) && n >= 0)) {
      return { error: "Every Score 5–2 boundary is required and must be 0 or greater." };
    }
    const [score_5_boundary, score_4_boundary, score_3_boundary, score_2_boundary] = values;

    const monotonic = higherIsBetter
      ? score_5_boundary > score_4_boundary && score_4_boundary > score_3_boundary && score_3_boundary > score_2_boundary
      : score_5_boundary < score_4_boundary && score_4_boundary < score_3_boundary && score_3_boundary < score_2_boundary;
    if (!monotonic) {
      return {
        error: higherIsBetter
          ? "Boundaries must decrease: Score 5 > Score 4 > Score 3 > Score 2."
          : "Boundaries must increase: Score 5 < Score 4 < Score 3 < Score 2.",
      };
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
    .from("five_s_stamina_benchmarks")
    .upsert(rows, { onConflict: "test_id,age_band_id" });

  if (error) {
    logError(`Failed to save stamina benchmarks for test ${testId}:`, error);
    return { error: "Failed to save." };
  }

  revalidatePath(PATH);
  return undefined;
}
