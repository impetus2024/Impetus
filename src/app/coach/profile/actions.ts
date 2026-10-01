"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  uploadDocFields,
  deleteReplacedDocs,
  discardUploadedDocs,
  guardDocColumns,
  DOCUMENT_CHANGED_MESSAGE,
} from "@/lib/storage/upload-doc-fields";
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

  const discardAndFail = async (error: string): Promise<CoachProfileState> => {
    await discardUploadedDocs(uploads.values);
    return { error };
  };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.name })
    .eq("id", coach.id);

  if (profileError) {
    logError(`Failed to save own profile for coach ${coach.id}:`, profileError);
    return discardAndFail("Failed to save changes.");
  }

  // Same conflict rules as updateAdministrator: staff_profiles has no
  // updated_at, so an existing row is updated with a compare-and-swap on the
  // profile picture being replaced, and a missing row is inserted (losing
  // cleanly to a concurrent insert) rather than upserted over.
  const staffValues = { ...staffDetailsColumns(parsed.data), ...uploads.values };
  let staffError: { code?: string } | null;
  let staffSaved = true;
  if (existing) {
    const result = await guardDocColumns(
      admin.from("staff_profiles").update(staffValues).eq("profile_id", coach.id),
      existing,
      uploads.values
    ).select("profile_id");
    staffError = result.error;
    staffSaved = (result.data?.length ?? 0) > 0;
  } else {
    staffError = (await admin.from("staff_profiles").insert({ profile_id: coach.id, ...staffValues })).error;
  }

  if (
    staffError?.code === "23505" ||
    (!staffError && !staffSaved && Object.keys(uploads.values).length > 0)
  ) {
    return discardAndFail(DOCUMENT_CHANGED_MESSAGE);
  }
  if (staffError) {
    logError(`Failed to save own staff_profiles for coach ${coach.id}:`, staffError);
    if (staffError.code) await discardUploadedDocs(uploads.values);
    return { error: "Failed to save changes." };
  }

  if (existing) {
    deleteReplacedDocs(existing, uploads.values, {
      entityType: "staff_profile",
      entityId: coach.id,
      centreId: coach.centre_id,
      actorId: coach.id,
    });
  }

  // Name and avatar also show in the coach shell (topbar/greeting).
  revalidatePath("/coach", "layout");
  return undefined;
}
