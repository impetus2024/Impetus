"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocFields, deleteReplacedDocs } from "@/lib/storage/upload-doc-fields";
import { StaffDetailsSchema, readStaffDetails, staffDetailsColumns } from "@/lib/staff/profile";
import { logError } from "@/lib/logger";

export type CoachProfileState = { error?: string } | undefined;

// The coach editing their own personal details. The profile being written is
// always the verified session's own (requireRole -> verifySession) — no id is
// read from the form. Role, centre, email and admin-managed fields (date of
// joining, identity documents) are not part of StaffDetailsSchema and so can't
// be touched from here.
//
// Written on the service-role client because RLS gives coaches read-only
// access to their own profiles/staff_profiles rows; scoping every write to
// coach.id is what stands in for that policy.
export async function updateOwnCoachProfile(
  _prev: CoachProfileState,
  formData: FormData
): Promise<CoachProfileState> {
  const coach = await requireRole("coach");

  const parsed = StaffDetailsSchema.safeParse(readStaffDetails(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("staff_profiles")
    .select("profile_picture_path")
    .eq("profile_id", coach.id)
    .maybeSingle();

  const uploads = await uploadDocFields(
    formData,
    [{ formKey: "profilePicture", column: "profile_picture_path" as const }],
    `staff-documents/${coach.id}`,
    coach.id
  );
  if (uploads.error) {
    return { error: uploads.error };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.name })
    .eq("id", coach.id);

  if (profileError) {
    logError(`Failed to save own profile for coach ${coach.id}:`, profileError);
    return { error: "Failed to save changes." };
  }

  // upsert for the same reason as updateAdministrator: a coach provisioned
  // outside the Administrator form may have no staff_profiles row yet.
  const { error } = await admin
    .from("staff_profiles")
    .upsert(
      { profile_id: coach.id, ...staffDetailsColumns(parsed.data), ...uploads.values },
      { onConflict: "profile_id" }
    );

  if (error) {
    logError(`Failed to save own staff_profiles for coach ${coach.id}:`, error);
    return { error: "Failed to save changes." };
  }

  if (existing) deleteReplacedDocs(existing, uploads.values);

  // Name and avatar also show in the coach shell (topbar/greeting).
  revalidatePath("/coach", "layout");
  return undefined;
}
