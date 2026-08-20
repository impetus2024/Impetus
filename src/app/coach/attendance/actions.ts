"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { logError } from "@/lib/logger";

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
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "Batch not found." };
  }

  const submitted: { playerId: string; status: "present" | "absent" }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("status_") && (value === "present" || value === "absent")) {
      submitted.push({ playerId: key.slice("status_".length), status: value });
    }
  }

  if (submitted.length === 0) {
    return { error: "No players to mark." };
  }

  // player_id comes straight from form field names, which are
  // client-supplied — without this, a coach could submit a player_id for
  // any player in the system (not just this batch) alongside their own
  // legitimately-owned batch_id, since nothing else here ties the two
  // together. RLS enforces the same rule now too (see the migration), but
  // checking here first gives a clear error instead of a bulk upsert
  // silently dropping the disallowed rows.
  const { data: batchPlayers } = await supabase
    .from("player_batches")
    .select("player_id")
    .eq("batch_id", batchId)
    .in(
      "player_id",
      submitted.map((s) => s.playerId)
    );
  const validPlayerIds = new Set((batchPlayers ?? []).map((p) => p.player_id));
  if (submitted.some((s) => !validPlayerIds.has(s.playerId))) {
    return { error: "One or more players are not in this batch." };
  }

  const rows = submitted.map((s) => ({
    batch_id: batchId,
    player_id: s.playerId,
    attendance_date: date,
    status: s.status,
    marked_by: coach.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "batch_id,player_id,attendance_date" });

  if (error) {
    logError(`Failed to save attendance for batch ${batchId} on ${date}:`, error);
    return { error: "Failed to save attendance." };
  }

  revalidatePath(`/coach/attendance/${batchId}`);
  return undefined;
}
