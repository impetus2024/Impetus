"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

const PATH = "/centre-admin/payments";

const PaymentSchema = z.object({
  playerId: z.uuid({ error: "Select a player." }),
  packageId: z.string().optional(),
  amount: z.coerce.number().positive({ error: "Enter a valid amount." }),
  paymentDate: z.string().min(1, { error: "Payment date is required." }),
  notes: z.string().optional(),
});

export type PaymentFormState = { error?: string } | undefined;

export async function createPayment(
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = PaymentSchema.safeParse({
    playerId: formData.get("playerId"),
    packageId: (formData.get("packageId") as string | null) || undefined,
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    notes: (formData.get("notes") as string | null) || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  // Penetration test finding: playerId was only validated as a well-formed
  // UUID, never checked against the acting centre_admin's centre — a
  // centre_admin could record a payment against any player_id, including one
  // belonging to a different centre. Same check createGatePassEntry already
  // does before its write.
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", parsed.data.playerId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!player) {
    return { error: "Player not found." };
  }

  const { error } = await supabase.from("payments").insert({
    centre_id: centreAdmin.centre_id!,
    player_id: player.id,
    package_id: parsed.data.packageId ?? null,
    amount: parsed.data.amount,
    payment_date: parsed.data.paymentDate,
    notes: parsed.data.notes ?? null,
    recorded_by: centreAdmin.id,
  });

  if (error) {
    logError(`Failed to record payment for player ${player.id}:`, error);
    return { error: "Failed to record payment." };
  }

  revalidatePath(PATH);
  return undefined;
}
