"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFile } from "@/lib/storage/r2";
import { provisionUser } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";
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
  try {
    const user = await provisionUser({
      email: parsed.data.email,
      fullName: parsed.data.name,
      role: parsed.data.role,
      centreId: centreAdmin.centre_id!,
      loginUrl: absoluteUrl("/login"),
    });
    userId = user.id;
  } catch {
    return {
      error:
        "Failed to create the account. Check that email is configured (RESEND_API_KEY / EMAIL_FROM).",
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

  for (const { formKey, column } of docFields) {
    const file = formData.get(formKey);
    if (file instanceof File && file.size > 0) {
      try {
        staffProfile[column] = await uploadFile(
          file,
          `staff-documents/${userId}`
        );
      } catch {
        // Storage not configured yet — account still gets created without
        // this document; it can be attached later once R2 is wired up.
      }
    }
  }

  const { error: staffError } = await admin
    .from("staff_profiles")
    .insert(staffProfile);

  if (staffError) {
    return { error: "Account created, but saving staff details failed." };
  }

  revalidatePath("/centre-admin/administrators");
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
    return { error: "Failed to save changes." };
  }

  revalidatePath(`/centre-admin/administrators/${profileId}`);
  revalidatePath("/centre-admin/administrators");
  return undefined;
}

export async function setAdministratorActive(profileId: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", profileId)
    .eq("centre_id", centreAdmin.centre_id!);

  revalidatePath("/centre-admin/administrators");
}
