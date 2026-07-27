"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/storage/r2";

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

  let reportDocPath: string | null = null;
  const file = formData.get("reportDocument");
  if (file instanceof File && file.size > 0) {
    try {
      reportDocPath = await uploadFile(file, `injury-reports/${playerId}`);
    } catch {
      // storage not configured — record still gets created without it
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("injuries").insert({
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
    report_doc_path: reportDocPath,
    reported_by: reporter.id,
  });

  if (error) {
    return { error: "Failed to save injury report." };
  }

  revalidatePath(revalidatePathTarget);
  return undefined;
}
