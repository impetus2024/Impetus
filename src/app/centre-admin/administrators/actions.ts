"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocFields } from "@/lib/storage/upload-doc-fields";
import { provisionUser, resetUserPassword } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfileInsert = Database["public"]["Tables"]["staff_profiles"]["Insert"];

const StaffRole = z.enum(["centre_admin", "coach", "medical"]);

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
    // duplicate email.
    logError(`Failed to provision administrator account for ${parsed.data.email}:`, err);
    return { error: "Failed to create the account — that email may already be in use." };
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

// Email and role are intentionally not editable here: email is the login
// identifier and role drives RLS scope — changing either is a re-provision,
// not an edit.
export async function updateAdministrator(
  profileId: string,
  _prev: UpdateAdministratorState,
  formData: FormData
): Promise<UpdateAdministratorState> {
  const centreAdmin = await requireRole("centre_admin");

  const parsed = UpdateAdministratorSchema.safeParse({
    name: formData.get("name"),
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
    .select("id")
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!target) {
    return { error: "Administrator not found." };
  }

  await supabase
    .from("profiles")
    .update({ full_name: parsed.data.name })
    .eq("id", profileId);

  const { error } = await supabase
    .from("staff_profiles")
    .update({
      contact_number: parsed.data.contactNumber,
      date_of_birth: parsed.data.dateOfBirth ?? null,
      address_line1: parsed.data.addressLine1 ?? null,
      address_line2: parsed.data.addressLine2 ?? null,
      country: parsed.data.country ?? null,
      state: parsed.data.state ?? null,
      city: parsed.data.city ?? null,
      pincode: parsed.data.pincode ?? null,
      date_of_joining: parsed.data.dateOfJoining ?? null,
    })
    .eq("profile_id", profileId);

  if (error) {
    logError(`Failed to save staff_profiles for administrator ${profileId}:`, error);
    return { error: "Failed to save changes." };
  }

  revalidatePath(`/centre-admin/administrators/${profileId}`);
  revalidatePath("/centre-admin/administrators");
  return undefined;
}

export async function setAdministratorActive(profileId: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
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
    .in("role", ["centre_admin", "coach", "medical"])
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
    });
    return result;
  } catch (err) {
    logError(`Failed to reset password for ${staff.email}:`, err);
    return { error: "Failed to reset password." };
  }
}
