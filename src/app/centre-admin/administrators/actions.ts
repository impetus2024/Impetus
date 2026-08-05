"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocFields, deleteReplacedDocs } from "@/lib/storage/upload-doc-fields";
import { provisionUser, resetUserPassword, ProvisionUserError } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfileInsert = Database["public"]["Tables"]["staff_profiles"]["Insert"];

// Staff/Finance are read-only accounts (view the same data centre_admin
// sees, no mutation rights anywhere else in the app) — see the 20260803*
// migrations for the RLS side of that.
const StaffRole = z.enum(["centre_admin", "coach", "medical", "staff", "finance"]);

const AdministratorSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  email: z.email({ error: "Enter a valid email." }),
  contactNumber: z.string().min(1, { error: "Contact number is required." }),
  role: StaffRole,
  dateOfBirth: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

export type AdministratorFormState = { error?: string } | undefined;

function emptyToUndefined(v: FormDataEntryValue | null) {
  return v && v.toString().trim() !== "" ? v.toString() : undefined;
}

export async function createAdministrator(
  _prev: AdministratorFormState,
  formData: FormData
): Promise<AdministratorFormState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = AdministratorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    contactNumber: formData.get("contactNumber"),
    role: formData.get("role"),
    dateOfBirth: emptyToUndefined(formData.get("dateOfBirth")),
    addressLine1: emptyToUndefined(formData.get("addressLine1")),
    addressLine2: emptyToUndefined(formData.get("addressLine2")),
    country: emptyToUndefined(formData.get("country")),
    state: emptyToUndefined(formData.get("state")),
    city: emptyToUndefined(formData.get("city")),
    pincode: emptyToUndefined(formData.get("pincode")),
    dateOfJoining: emptyToUndefined(formData.get("dateOfJoining")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let userId: string;
  let emailSent: boolean;
  try {
    const result = await provisionUser({
      email: parsed.data.email,
      fullName: parsed.data.name,
      role: parsed.data.role,
      centreId: centreAdmin.centre_id!,
      loginUrl: absoluteUrl("/login"),
    });
    userId = result.user.id;
    emailSent = result.emailSent;
  } catch (err) {
    // provisionUser already tolerates email-delivery failures internally
    // (see its own catch around sendAccountInviteEmail) — reaching here
    // means the auth account itself failed to create, most commonly a
    // duplicate email (ProvisionUserError carries a specific message for
    // that case).
    logError(`Failed to provision administrator account for ${parsed.data.email}:`, err);
    return {
      error:
        err instanceof ProvisionUserError
          ? err.message
          : "Failed to create the account — please try again.",
    };
  }

  // profiles row for the new user only exists once the auth trigger runs
  // (see on_auth_user_created); staff_profiles/document uploads use the
  // service-role client since the caller isn't that user.
  const admin = createAdminClient();

  const staffProfile: StaffProfileInsert = {
    profile_id: userId,
    contact_number: parsed.data.contactNumber,
    date_of_birth: parsed.data.dateOfBirth ?? null,
    address_line1: parsed.data.addressLine1 ?? null,
    address_line2: parsed.data.addressLine2 ?? null,
    country: parsed.data.country ?? null,
    state: parsed.data.state ?? null,
    city: parsed.data.city ?? null,
    pincode: parsed.data.pincode ?? null,
    date_of_joining: parsed.data.dateOfJoining ?? null,
  };

  const docFields: { formKey: string; column: keyof StaffProfileInsert }[] = [
    { formKey: "aadhaarCard", column: "aadhaar_doc_path" },
    { formKey: "birthCertificate", column: "birth_certificate_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
    { formKey: "otherDocuments", column: "other_documents_path" },
  ];

  // The auth account already exists by this point (provisionUser above),
  // so a rejected/failed document here can't abort the whole action the
  // way it does in createPlayer — just skip it and log, the account still
  // needs to be usable. It can be attached later from the detail page.
  const uploads = await uploadDocFields(formData, docFields, `staff-documents/${userId}`, centreAdmin.id);
  if (uploads.error) {
    logError(`Document rejected while creating administrator ${userId}:`, uploads.error);
  }
  Object.assign(staffProfile, uploads.values);

  const { error: staffError } = await admin
    .from("staff_profiles")
    .insert(staffProfile);

  if (staffError) {
    logError(`Failed to save staff_profiles for new administrator ${userId}:`, staffError);
    return { error: "Account created, but saving staff details failed." };
  }

  revalidatePath("/centre-admin/administrators");

  if (!emailSent) {
    return {
      error:
        "Account created, but the invite email couldn't be sent — use \"Reset Password\" from this administrator's row to generate a temporary password you can share directly.",
    };
  }
  return undefined;
}

const UpdateAdministratorSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  role: StaffRole,
  contactNumber: z.string().min(1, { error: "Contact number is required." }),
  dateOfBirth: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

export type UpdateAdministratorState = { error?: string } | undefined;

// Email is intentionally not editable here: it's the login identifier,
// changing it is a re-provision, not an edit. Role is editable (relaxed by
// the 20260804000000 migration, which still keeps centre_admin from moving
// anyone to/from super_admin or across centres) but locked out for the
// caller's own row below to avoid a centre_admin locking themselves out.
export async function updateAdministrator(
  profileId: string,
  _prev: UpdateAdministratorState,
  formData: FormData
): Promise<UpdateAdministratorState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = UpdateAdministratorSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    contactNumber: formData.get("contactNumber"),
    dateOfBirth: emptyToUndefined(formData.get("dateOfBirth")),
    addressLine1: emptyToUndefined(formData.get("addressLine1")),
    addressLine2: emptyToUndefined(formData.get("addressLine2")),
    country: emptyToUndefined(formData.get("country")),
    state: emptyToUndefined(formData.get("state")),
    city: emptyToUndefined(formData.get("city")),
    pincode: emptyToUndefined(formData.get("pincode")),
    dateOfJoining: emptyToUndefined(formData.get("dateOfJoining")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!target) {
    return { error: "Administrator not found." };
  }

  if (profileId === centreAdmin.id && parsed.data.role !== target.role) {
    return { error: "You can't change your own role." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.name, role: parsed.data.role })
    .eq("id", profileId);

  if (profileError) {
    logError(`Failed to save profile for administrator ${profileId}:`, profileError);
    return { error: "Failed to save changes." };
  }

  type DocColumn =
    | "aadhaar_doc_path"
    | "birth_certificate_path"
    | "profile_picture_path"
    | "other_documents_path";
  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarCard", column: "aadhaar_doc_path" },
    { formKey: "birthCertificate", column: "birth_certificate_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
    { formKey: "otherDocuments", column: "other_documents_path" },
  ];

  const { data: existing } = await supabase
    .from("staff_profiles")
    .select("aadhaar_doc_path, birth_certificate_path, profile_picture_path, other_documents_path")
    .eq("profile_id", profileId)
    .maybeSingle();

  const uploads = await uploadDocFields(formData, docFields, `staff-documents/${profileId}`, centreAdmin.id);
  if (uploads.error) {
    return { error: uploads.error };
  }

  // upsert, not update: an administrator provisioned outside this form's own
  // "create" flow (the centre's first admin, auto-provisioned by
  // super-admin's createCentre; or a directly-seeded test account) never
  // gets a staff_profiles row in the first place. update() against a
  // profile_id with no matching row silently affects zero rows and returns
  // no error — every field on this form would appear to save while nothing
  // actually persisted. upsert creates the row the first time, updates it
  // after.
  const { error } = await supabase
    .from("staff_profiles")
    .upsert(
      {
        profile_id: profileId,
        contact_number: parsed.data.contactNumber,
        date_of_birth: parsed.data.dateOfBirth ?? null,
        address_line1: parsed.data.addressLine1 ?? null,
        address_line2: parsed.data.addressLine2 ?? null,
        country: parsed.data.country ?? null,
        state: parsed.data.state ?? null,
        city: parsed.data.city ?? null,
        pincode: parsed.data.pincode ?? null,
        date_of_joining: parsed.data.dateOfJoining ?? null,
        ...uploads.values,
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    logError(`Failed to save staff_profiles for administrator ${profileId}:`, error);
    return { error: "Failed to save changes." };
  }

  if (existing) deleteReplacedDocs<DocColumn>(existing, uploads.values);

  revalidatePath(`/centre-admin/administrators/${profileId}`);
  revalidatePath("/centre-admin/administrators");
  return undefined;
}

export async function setAdministratorActive(profileId: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");

  if (!active && profileId === centreAdmin.id) {
    throw new Error("You can't disable your own account.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "enable" : "disable"} administrator ${profileId}:`, error);
    throw error;
  }

  // Disabling only blocks *new* app requests (see verifySession's is_active
  // check) — an already-issued access token stays locally valid until it
  // expires. Revoking server-side closes the rest of that gap the same way
  // resetUserPassword does: same caveats, see that function's migration.
  if (!active) {
    const admin = createAdminClient();
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
      target_user_id: profileId,
    });
    if (revokeError) {
      logError(`Failed to revoke sessions for disabled administrator ${profileId}:`, revokeError);
    }
  }

  revalidatePath("/centre-admin/administrators");
}

export type ResetPasswordActionState =
  | { error: string }
  | { tempPassword: string; emailSent: boolean };

// Recovery path for staff who can't self-service "forgot password" (no
// working inbox, or the original invite email never arrived because
// Resend isn't configured) — see resetUserPassword's doc comment.
export async function resetAdministratorPassword(
  profileId: string
): Promise<ResetPasswordActionState> {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .in("role", ["centre_admin", "coach", "medical", "staff", "finance"])
    .maybeSingle();

  if (!staff) {
    return { error: "Administrator not found." };
  }

  try {
    const result = await resetUserPassword({
      userId: staff.id,
      email: staff.email,
      fullName: staff.full_name,
      loginUrl: absoluteUrl("/login"),
      centreId: centreAdmin.centre_id!,
    });
    return result;
  } catch (err) {
    logError(`Failed to reset password for ${staff.email}:`, err);
    return { error: "Failed to reset password." };
  }
}
