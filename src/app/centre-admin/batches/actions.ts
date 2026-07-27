"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const PATH = "/centre-admin/batches";

const BatchSchema = z.object({
  name: z.string().min(1, { error: "Batch name is required." }),
  headCoachId: z.uuid({ error: "Select a head coach." }),
  playerTypeId: z.string().optional(),
  ageCategoryId: z.uuid({ error: "Select an age category." }),
  startTime: z.string().min(1, { error: "Start time is required." }),
  endTime: z.string().min(1, { error: "End time is required." }),
});

export type BatchFormState = { error?: string } | undefined;

function parseBatch(formData: FormData) {
  return BatchSchema.safeParse({
    name: formData.get("name"),
    headCoachId: formData.get("headCoachId"),
    playerTypeId:
      (formData.get("playerTypeId") as string | null) || undefined,
    ageCategoryId: formData.get("ageCategoryId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
}

export async function createBatch(
  _prev: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parseBatch(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("batches").insert({
    centre_id: centreAdmin.centre_id!,
    name: parsed.data.name,
    head_coach_id: parsed.data.headCoachId,
    player_type_id: parsed.data.playerTypeId ?? null,
    age_category_id: parsed.data.ageCategoryId,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });

  if (error) {
    return { error: "Failed to create batch." };
  }

  revalidatePath(PATH);
  return undefined;
}

export async function updateBatch(
  id: string,
  _prev: BatchFormState,
  formData: FormData
): Promise<BatchFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parseBatch(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({
      name: parsed.data.name,
      head_coach_id: parsed.data.headCoachId,
      player_type_id: parsed.data.playerTypeId ?? null,
      age_category_id: parsed.data.ageCategoryId,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
    })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    return { error: "Failed to save batch." };
  }

  revalidatePath(PATH);
  return undefined;
}

export async function setBatchActive(id: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  await supabase
    .from("batches")
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  revalidatePath(PATH);
}
