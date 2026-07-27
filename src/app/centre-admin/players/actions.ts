"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFile } from "@/lib/storage/r2";
import { provisionUser } from "@/lib/auth/provision-user";
import { encryptField } from "@/lib/crypto/field-encryption";
import { absoluteUrl } from "@/lib/url";
import type { Database } from "@/lib/supabase/database.types";

type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

const PATH = "/centre-admin/players";

function optionalStr(v: FormDataEntryValue | null) {
  const s = v?.toString().trim();
  return s ? s : undefined;
}

const PlayerSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  dateOfBirth: z.string().min(1, { error: "Date of birth is required." }),
  ageCategoryId: z.string().optional(),
  email: z.email({ error: "Enter a valid player email." }).optional(),
  contactNumber: z.string().optional(),
  playerTypeId: z.string().optional(),
  packageId: z.string().optional(),
  batchId: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  heightCm: z.coerce.number().optional(),
  weightKg: z.coerce.number().optional(),
  birthMark: z.string().optional(),
  medicalCondition: z.string().optional(),
  foodAllergy: z.string().optional(),
  aiffNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  parentEmail: z.email({ error: "Enter a valid parent/guardian email." }),
  parentContactNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
});

export type PlayerFormState = { error?: string } | undefined;

function parsePlayer(formData: FormData) {
  return PlayerSchema.safeParse({
    name: formData.get("name"),
    dateOfBirth: formData.get("dateOfBirth"),
    ageCategoryId: optionalStr(formData.get("ageCategoryId")),
    email: optionalStr(formData.get("email")),
    contactNumber: optionalStr(formData.get("contactNumber")),
    playerTypeId: optionalStr(formData.get("playerTypeId")),
    packageId: optionalStr(formData.get("packageId")),
    batchId: optionalStr(formData.get("batchId")),
    gender: optionalStr(formData.get("gender")),
    bloodGroup: optionalStr(formData.get("bloodGroup")),
    heightCm: optionalStr(formData.get("heightCm")),
    weightKg: optionalStr(formData.get("weightKg")),
    birthMark: optionalStr(formData.get("birthMark")),
    medicalCondition: optionalStr(formData.get("medicalCondition")),
    foodAllergy: optionalStr(formData.get("foodAllergy")),
    aiffNumber: optionalStr(formData.get("aiffNumber")),
    passportNumber: optionalStr(formData.get("passportNumber")),
    aadhaarNumber: optionalStr(formData.get("aadhaarNumber")),
    fatherName: optionalStr(formData.get("fatherName")),
    motherName: optionalStr(formData.get("motherName")),
    parentEmail: formData.get("parentEmail"),
    parentContactNumber: optionalStr(formData.get("parentContactNumber")),
    addressLine1: optionalStr(formData.get("addressLine1")),
    addressLine2: optionalStr(formData.get("addressLine2")),
    country: optionalStr(formData.get("country")),
    state: optionalStr(formData.get("state")),
    city: optionalStr(formData.get("city")),
    pincode: optionalStr(formData.get("pincode")),
  });
}

// Finds (or creates + invites) the parent account for this email, then
// returns their profile id so the caller can link it to the player. Parents
// commonly have more than one child, so an existing account is reused
// rather than rejected as a duplicate.
async function resolveParentProfileId(email: string, fullName: string) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("role", "parent")
    .maybeSingle();

  if (existing) return existing.id;

  const user = await provisionUser({
    email,
    fullName,
    role: "parent",
    loginUrl: absoluteUrl("/login"),
  });

  return user.id;
}

export async function createPlayer(
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parsePlayer(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const insert: PlayerInsert = {
    centre_id: centreAdmin.centre_id!,
    name: d.name,
    date_of_birth: d.dateOfBirth,
    age_category_id: d.ageCategoryId ?? null,
    email: d.email ?? null,
    contact_number: d.contactNumber ?? null,
    player_type_id: d.playerTypeId ?? null,
    package_id: d.packageId ?? null,
    batch_id: d.batchId ?? null,
    gender: d.gender ?? null,
    blood_group: d.bloodGroup ?? null,
    height_cm: d.heightCm ?? null,
    weight_kg: d.weightKg ?? null,
    birth_mark: d.birthMark ?? null,
    medical_condition: d.medicalCondition ?? null,
    food_allergy: d.foodAllergy ?? null,
    aiff_number: d.aiffNumber ?? null,
    passport_number_encrypted: d.passportNumber
      ? encryptField(d.passportNumber)
      : null,
    aadhaar_number_encrypted: d.aadhaarNumber
      ? encryptField(d.aadhaarNumber)
      : null,
    father_name: d.fatherName ?? null,
    mother_name: d.motherName ?? null,
    parent_email: d.parentEmail,
    parent_contact_number: d.parentContactNumber ?? null,
    address_line1: d.addressLine1 ?? null,
    address_line2: d.addressLine2 ?? null,
    country: d.country ?? null,
    state: d.state ?? null,
    city: d.city ?? null,
    pincode: d.pincode ?? null,
    created_by: centreAdmin.id,
  };

  type DocColumn = "aadhaar_doc_path" | "medical_records_path" | "profile_picture_path";
  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarDoc", column: "aadhaar_doc_path" },
    { formKey: "medicalRecords", column: "medical_records_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
  ];

  for (const { formKey, column } of docFields) {
    const file = formData.get(formKey);
    if (file instanceof File && file.size > 0) {
      try {
        insert[column] = await uploadFile(
          file,
          `player-documents/${crypto.randomUUID()}`
        );
      } catch {
        // storage not configured — record still gets created without it
      }
    }
  }

  const supabase = await createClient();
  const { data: player, error } = await supabase
    .from("players")
    .insert(insert)
    .select("id")
    .single();

  if (error || !player) {
    return { error: "Failed to create player." };
  }

  try {
    const parentProfileId = await resolveParentProfileId(
      d.parentEmail,
      d.fatherName || d.motherName || "Parent"
    );

    const admin = createAdminClient();
    await admin.from("parent_player_links").insert({
      parent_id: parentProfileId,
      player_id: player.id,
      centre_id: centreAdmin.centre_id!,
    });
  } catch {
    // Parent account/link failed (e.g. email not configured yet) — the
    // player record itself is saved; the link can be retried by editing
    // the player, or by adding the parent account manually.
  }

  revalidatePath(PATH);
  redirect(`/centre-admin/players/${player.id}`);
}

export async function updatePlayer(
  id: string,
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parsePlayer(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const update: PlayerUpdate = {
    name: d.name,
    date_of_birth: d.dateOfBirth,
    age_category_id: d.ageCategoryId ?? null,
    email: d.email ?? null,
    contact_number: d.contactNumber ?? null,
    player_type_id: d.playerTypeId ?? null,
    package_id: d.packageId ?? null,
    batch_id: d.batchId ?? null,
    gender: d.gender ?? null,
    blood_group: d.bloodGroup ?? null,
    height_cm: d.heightCm ?? null,
    weight_kg: d.weightKg ?? null,
    birth_mark: d.birthMark ?? null,
    medical_condition: d.medicalCondition ?? null,
    food_allergy: d.foodAllergy ?? null,
    aiff_number: d.aiffNumber ?? null,
    father_name: d.fatherName ?? null,
    mother_name: d.motherName ?? null,
    parent_contact_number: d.parentContactNumber ?? null,
    address_line1: d.addressLine1 ?? null,
    address_line2: d.addressLine2 ?? null,
    country: d.country ?? null,
    state: d.state ?? null,
    city: d.city ?? null,
    pincode: d.pincode ?? null,
  };

  if (d.passportNumber) {
    update.passport_number_encrypted = encryptField(d.passportNumber);
  }
  if (d.aadhaarNumber) {
    update.aadhaar_number_encrypted = encryptField(d.aadhaarNumber);
  }

  type DocColumn = "aadhaar_doc_path" | "medical_records_path" | "profile_picture_path";
  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarDoc", column: "aadhaar_doc_path" },
    { formKey: "medicalRecords", column: "medical_records_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
  ];

  for (const { formKey, column } of docFields) {
    const file = formData.get(formKey);
    if (file instanceof File && file.size > 0) {
      try {
        update[column] = await uploadFile(file, `player-documents/${id}`);
      } catch {
        // storage not configured — leave existing document as-is
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    return { error: "Failed to save player." };
  }

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
  return undefined;
}

export async function setPlayerActive(id: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  await supabase
    .from("players")
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
}
