"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, is_checked_in")
    .eq("id", parsed.data.playerId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!player) {
    return { error: "Player not found." };
  }

  const action = player.is_checked_in ? "check_out" : "check_in";

  const { error: logError } = await supabase.from("gate_pass_logs").insert({
    player_id: player.id,
    centre_id: centreAdmin.centre_id!,
    action,
    reason: parsed.data.reason,
    performed_by: centreAdmin.id,
  });

  if (logError) {
    return { error: "Failed to record gate pass." };
  }

  await supabase
    .from("players")
    .update({ is_checked_in: !player.is_checked_in })
    .eq("id", player.id);

  revalidatePath(PATH);
  return undefined;
}
