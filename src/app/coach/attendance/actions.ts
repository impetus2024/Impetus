"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type AttendanceFormState = { error?: string } | undefined;

export async function markAttendance(
  batchId: string,
  _prev: AttendanceFormState,
  formData: FormData
): Promise<AttendanceFormState> {
  const coach = await requireRole("coach");
  const date = formData.get("date");

  if (typeof date !== "string" || !date) {
    return { error: "Date is required." };
  }

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id")
    .eq("id", batchId)
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "Batch not found." };
  }

  const rows: {
    batch_id: string;
    player_id: string;
    attendance_date: string;
    status: "present" | "absent";
    marked_by: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("status_") && (value === "present" || value === "absent")) {
      rows.push({
        batch_id: batchId,
        player_id: key.slice("status_".length),
        attendance_date: date,
        status: value,
        marked_by: coach.id,
      });
    }
  }

  if (rows.length === 0) {
    return { error: "No players to mark." };
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "batch_id,player_id,attendance_date" });

  if (error) {
    return { error: "Failed to save attendance." };
  }

  revalidatePath(`/coach/attendance/${batchId}`);
  return undefined;
}
