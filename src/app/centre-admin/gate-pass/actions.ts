"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

const PATH = "/centre-admin/gate-pass";

const GatePassSchema = z.object({
  playerId: z.uuid({ error: "Select a player." }),
  reason: z.string().min(1, { error: "Reason is required." }),
});

export type GatePassFormState = { error?: string } | undefined;

export async function createGatePassEntry(
  _prev: GatePassFormState,
  formData: FormData
): Promise<GatePassFormState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = GatePassSchema.safeParse({
    playerId: formData.get("playerId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", parsed.data.playerId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!player) {
    return { error: "Player not found." };
  }

  // Penetration test finding: this used to read is_checked_in, compute the
  // opposite action from that read, then write the log and the flipped
  // boolean as separate round trips — a TOCTOU race confirmed exploitable
  // by two near-simultaneous submissions (a double-click is enough).
  // toggle_gate_pass does the read-toggle-log sequence inside one Postgres
  // function call, serialized by the row lock the UPDATE takes — see its
  // migration.
  const { error } = await supabase.rpc("toggle_gate_pass", {
    p_player_id: player.id,
    p_centre_id: centreAdmin.centre_id!,
    p_reason: parsed.data.reason,
    p_performed_by: centreAdmin.id,
  });

  if (error) {
    logError(`Failed to record gate pass for player ${player.id}:`, error);
    return { error: "Failed to record gate pass." };
  }

  revalidatePath(PATH);
  return undefined;
}
