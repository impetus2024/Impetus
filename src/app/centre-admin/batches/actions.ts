"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

const PATH = "/centre-admin/batches";

const BatchSchema = z
  .object({
    name: z.string().min(1, { error: "Batch name is required." }),
    // Optional here on purpose: Edit Batch must be able to clear the head
    // coach slot (the column is nullable, so the batch survives with a
    // "no head coach" state until a replacement is assigned). createBatch
    // re-requires it below, where an empty slot is still invalid.
    headCoachId: z.uuid({ error: "Select a head coach." }).optional(),
    assistantCoachId: z.uuid().optional(),
    playerTypeId: z.string().optional(),
    ageCategoryId: z.uuid({ error: "Select an age category." }),
    startTime: z.string().min(1, { error: "Start time is required." }),
    endTime: z.string().min(1, { error: "End time is required." }),
  })
  // Only a real clash: two empty slots are not duplicates, and an assistant
  // coach with no head coach assigned is allowed (the DB CHECK permits it).
  .refine((d) => !d.assistantCoachId || d.assistantCoachId !== d.headCoachId, {
    error: "Assistant coach must be different from the head coach.",
    path: ["assistantCoachId"],
  });

export type BatchFormState = { error?: string } | undefined;

function parseBatch(formData: FormData) {
  return BatchSchema.safeParse({
    name: formData.get("name"),
    // An empty slot arrives as "" because the Select submits a null value
    // that way — that means "no coach", not a malformed uuid.
    headCoachId: (formData.get("headCoachId") as string | null) || undefined,
    assistantCoachId:
      (formData.get("assistantCoachId") as string | null) || undefined,
    playerTypeId:
      (formData.get("playerTypeId") as string | null) || undefined,
    ageCategoryId: formData.get("ageCategoryId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
}

// The Select only offers active coaches of this centre with role "coach", but
// coach ids are ordinary form fields, so nothing stops a hand-crafted submit
// from naming a parent, a member of staff from another centre, or the centre
// admin's own profile. Re-check both slots server-side before any write.
//
// RLS already hides other centres' profiles from this client (the centre-staff
// policy is scoped to user_centre_id and role), so forged ids fail the lookup;
// the explicit role/centre comparison keeps that guarantee even if those
// policies change. Head and assistant are reported separately so the message
// points at the field the admin actually controls.
async function validateCoaches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  centreId: string,
  headCoachId?: string,
  assistantCoachId?: string
): Promise<string | undefined> {
  const ids = [...new Set([headCoachId, assistantCoachId].filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return undefined;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, centre_id")
    .in("id", ids);

  if (error) {
    logError(`Failed to validate coaches for centre ${centreId}:`, error);
    return "Failed to validate coaches.";
  }

  const validIds = new Set(
    (data ?? [])
      .filter((p) => p.role === "coach" && p.centre_id === centreId)
      .map((p) => p.id)
  );

  if (headCoachId && !validIds.has(headCoachId)) {
    return "Head coach must be a coach from your centre.";
  }
  if (assistantCoachId && !validIds.has(assistantCoachId)) {
    return "Assistant coach must be a coach from your centre.";
  }
  return undefined;
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

  const { headCoachId } = parsed.data;
  if (!headCoachId) return { error: "Select a head coach." };

  const supabase = await createClient();
  const invalidCoach = await validateCoaches(
    supabase,
    centreAdmin.centre_id!,
    headCoachId,
    parsed.data.assistantCoachId
  );
  if (invalidCoach) return { error: invalidCoach };

  const { error } = await supabase.from("batches").insert({
    centre_id: centreAdmin.centre_id!,
    name: parsed.data.name,
    head_coach_id: headCoachId,
    assistant_coach_id: parsed.data.assistantCoachId ?? null,
    player_type_id: parsed.data.playerTypeId ?? null,
    age_category_id: parsed.data.ageCategoryId,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });

  if (error) {
    logError(`Failed to create batch for centre ${centreAdmin.centre_id}:`, error);
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
  const invalidCoach = await validateCoaches(
    supabase,
    centreAdmin.centre_id!,
    parsed.data.headCoachId,
    parsed.data.assistantCoachId
  );
  if (invalidCoach) return { error: invalidCoach };

  const { error } = await supabase
    .from("batches")
    .update({
      name: parsed.data.name,
      // null clears the slot. Clearing the head coach is allowed on update
      // only — head_coach_id is nullable, so a batch outlives its coach and
      // shows as unassigned in the list until someone is picked again.
      head_coach_id: parsed.data.headCoachId ?? null,
      assistant_coach_id: parsed.data.assistantCoachId ?? null,
      player_type_id: parsed.data.playerTypeId ?? null,
      age_category_id: parsed.data.ageCategoryId,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
    })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to save batch ${id}:`, error);
    return { error: "Failed to save batch." };
  }

  revalidatePath(PATH);
  return undefined;
}

export async function setBatchActive(id: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("batches")
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "activate" : "deactivate"} batch ${id}:`, error);
    throw new Error("Failed to save.");
  }

  revalidatePath(PATH);
}
