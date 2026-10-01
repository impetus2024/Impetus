"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { insertInjuryWithReport } from "@/lib/injuries/report-document";

const InjurySchema = z.object({
  dateOfInjury: z.string().min(1, { error: "Date is required." }),
  activityType: z.string().optional(),
  bodyRegion: z.string().optional(),
  nature: z.string().optional(),
  cause: z.string().optional(),
  treatingPerson: z.string().optional(),
  initialTreatment: z.string().optional(),
  description: z.string().optional(),
});

export type InjuryFormState = { error?: string } | undefined;

function optionalStr(v: FormDataEntryValue | null) {
  const s = v?.toString().trim();
  return s ? s : undefined;
}

// Shared by both Coach and Medical — RLS on the injuries table already
// scopes each role to the players they're allowed to report on (own-batch
// players for a coach, own-centre players for medical), so a single action
// covers both without re-deriving that logic here.
export async function createInjury(
  playerId: string,
  revalidatePathTarget: string,
  _prev: InjuryFormState,
  formData: FormData
): Promise<InjuryFormState> {
  const reporter = await requireRole("coach", "medical");

  const parsed = InjurySchema.safeParse({
    dateOfInjury: formData.get("dateOfInjury"),
    activityType: optionalStr(formData.get("activityType")),
    bodyRegion: optionalStr(formData.get("bodyRegion")),
    nature: optionalStr(formData.get("nature")),
    cause: optionalStr(formData.get("cause")),
    treatingPerson: optionalStr(formData.get("treatingPerson")),
    initialTreatment: optionalStr(formData.get("initialTreatment")),
    description: optionalStr(formData.get("description")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await insertInjuryWithReport(
    supabase,
    formData,
    {
      player_id: playerId,
      centre_id: reporter.centre_id!,
      date_of_injury: parsed.data.dateOfInjury,
      activity_type: parsed.data.activityType ?? null,
      body_region: parsed.data.bodyRegion ?? null,
      nature: parsed.data.nature ?? null,
      cause: parsed.data.cause ?? null,
      treating_person: parsed.data.treatingPerson ?? null,
      initial_treatment: parsed.data.initialTreatment ?? null,
      description: parsed.data.description ?? null,
      reported_by: reporter.id,
    },
    reporter.id
  );
  if (error) return { error };

  revalidatePath(revalidatePathTarget);
  return undefined;
}
