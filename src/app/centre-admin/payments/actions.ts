"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.from("payments").insert({
    centre_id: centreAdmin.centre_id!,
    player_id: parsed.data.playerId,
    package_id: parsed.data.packageId ?? null,
    amount: parsed.data.amount,
    payment_date: parsed.data.paymentDate,
    notes: parsed.data.notes ?? null,
    recorded_by: centreAdmin.id,
  });

  if (error) {
    return { error: "Failed to record payment." };
  }

  revalidatePath(PATH);
  return undefined;
}
