"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

const WindowSchema = z.object({
  startDate: z.string().min(1, { error: "Start date is required." }),
  endDate: z.string().min(1, { error: "End date is required." }),
});

export type TestingWindowFormState = { error?: string } | undefined;

export async function setFiveSTestingWindow(
  _prev: TestingWindowFormState,
  formData: FormData
): Promise<TestingWindowFormState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = WindowSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Select a start and end date." };
  }
  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: "End date must be on or after the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("centres")
    .update({
      five_s_window_start: parsed.data.startDate,
      five_s_window_end: parsed.data.endDate,
    })
    .eq("id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to save 5S testing window for centre ${centreAdmin.centre_id}:`, error);
    return { error: "Failed to save the testing window." };
  }

  revalidatePath("/centre-admin/5s-model");
  return undefined;
}
