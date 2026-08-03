"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocFields, deleteReplacedDocs } from "@/lib/storage/upload-doc-fields";
import { provisionUser } from "@/lib/auth/provision-user";
import { encryptField } from "@/lib/crypto/field-encryption";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type PlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

const PATH = "/centre-admin/players";

function optionalStr(v: FormDataEntryValue | null) {
  const s = v?.toString().trim();
  return s ? s : undefined;
}

// Every field is mandatory except the ones explicitly kept optional below
// (Birth Mark, Medical Condition, Food Allergy, AIFF Number, Passport
// Number, Upload Medical Records, Mother Name, Address Line 2) — mirrors
// the `required` attributes in player-form.tsx, so a request that bypasses
// the client can't skip the same validation.
const PlayerSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  dateOfBirth: z.string().min(1, { error: "Date of birth is required." }),
  ageCategoryId: z.string().min(1, { error: "Age category is required." }),
  email: z.email({ error: "Enter a valid player email." }),
  contactNumber: z.string().min(1, { error: "Player contact number is required." }),
  playerTypeId: z.string().min(1, { error: "Program type is required." }),
  packageId: z.string().min(1, { error: "Package is required." }),
  customPackageName: z.string().optional(),
  customAmount: z.coerce.number().optional(),
  customDiscount: z.coerce.number().optional(),
  batchId: z.string().min(1, { error: "Batch allotment is required." }),
  gender: z.string().min(1, { error: "Gender is required." }),
  bloodGroup: z.string().min(1, { error: "Blood group is required." }),
  heightCm: z.coerce.number({ error: "Height is required." }),
  weightKg: z.coerce.number({ error: "Weight is required." }),
  birthMark: z.string().optional(),
  medicalCondition: z.string().optional(),
  foodAllergy: z.string().optional(),
  aiffNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  aadhaarNumber: z.string().min(1, { error: "Aadhaar number is required." }),
  fatherName: z.string().min(1, { error: "Father / Guardian name is required." }),
  motherName: z.string().optional(),
  parentEmail: z.email({ error: "Enter a valid parent/guardian email." }),
  parentContactNumber: z.string().min(1, { error: "Parent/guardian contact number is required." }),
  addressLine1: z.string().min(1, { error: "Address line 1 is required." }),
  addressLine2: z.string().optional(),
  country: z.string().min(1, { error: "Country is required." }),
  state: z.string().min(1, { error: "State is required." }),
  city: z.string().min(1, { error: "City is required." }),
  pincode: z.string().min(1, { error: "Pincode is required." }),
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
    customPackageName: optionalStr(formData.get("customPackageName")),
    customAmount: optionalStr(formData.get("customAmount")),
    customDiscount: optionalStr(formData.get("customDiscount")),
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

  const { user } = await provisionUser({
    email,
    fullName,
    role: "parent",
    loginUrl: absoluteUrl("/login"),
  });

  return user.id;
}

const CUSTOM_PACKAGE_VALUE = "custom";

// "Custom" in the Package dropdown isn't a real package until this runs —
// it creates (or, when editing a player who already has a custom package,
// updates in place) a normal `packages` row flagged `is_custom`, so every
// existing consumer of players.package_id (payments, the profile view,
// dashboards) keeps working unchanged. currentPackageId is the player's
// package_id *before* this save, passed only from update flows, so editing
// an already-custom assignment adjusts that same row instead of leaving an
// orphaned one behind every time the admin re-saves the form.
async function resolvePackageId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  centreId: string,
  playerTypeId: string | null,
  packageId: string | undefined,
  custom: { name?: string; amount?: number; discount?: number },
  currentPackageId?: string | null
): Promise<{ packageId: string | null; error?: string }> {
  if (!packageId) return { packageId: null };
  if (packageId !== CUSTOM_PACKAGE_VALUE) return { packageId };

  if (!custom.name || custom.amount === undefined) {
    return { packageId: null, error: "Custom package name and amount are required." };
  }

  const discount = custom.discount ?? 0;
  const price = custom.amount - discount;

  if (currentPackageId) {
    const { data: currentPackage } = await supabase
      .from("packages")
      .select("id, is_custom")
      .eq("id", currentPackageId)
      .maybeSingle();

    if (currentPackage?.is_custom) {
      const { error } = await supabase
        .from("packages")
        .update({
          name: custom.name,
          player_type_id: playerTypeId,
          price,
          custom_amount: custom.amount,
          discount,
        })
        .eq("id", currentPackageId);

      if (error) {
        logError(`Failed to update custom package ${currentPackageId}:`, error);
        return { packageId: null, error: "Failed to save custom package." };
      }
      return { packageId: currentPackageId };
    }
  }

  const { data, error } = await supabase
    .from("packages")
    .insert({
      centre_id: centreId,
      name: custom.name,
      player_type_id: playerTypeId,
      price,
      duration: "Custom",
      is_custom: true,
      custom_amount: custom.amount,
      discount,
    })
    .select("id")
    .single();

  if (error || !data) {
    logError(`Failed to create custom package for centre ${centreId}:`, error);
    return { packageId: null, error: "Failed to create custom package." };
  }

  return { packageId: data.id };
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

  const supabase = await createClient();
  const { packageId, error: packageError } = await resolvePackageId(
    supabase,
    centreAdmin.centre_id!,
    d.playerTypeId ?? null,
    d.packageId,
    { name: d.customPackageName, amount: d.customAmount, discount: d.customDiscount }
  );
  if (packageError) {
    return { error: packageError };
  }

  const insert: PlayerInsert = {
    centre_id: centreAdmin.centre_id!,
    name: d.name,
    date_of_birth: d.dateOfBirth,
    age_category_id: d.ageCategoryId ?? null,
    email: d.email ?? null,
    contact_number: d.contactNumber ?? null,
    player_type_id: d.playerTypeId ?? null,
    package_id: packageId,
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

  const uploads = await uploadDocFields(formData, docFields, `player-documents/${crypto.randomUUID()}`, centreAdmin.id);
  if (uploads.error) {
    return { error: uploads.error };
  }
  // Client-side `required` on the file inputs can be bypassed by a direct
  // request — uploadDocFields only reports a key here when a file actually
  // came through, so this is the real, server-side check.
  if (!uploads.values.aadhaar_doc_path) {
    return { error: "Aadhaar document is required." };
  }
  if (!uploads.values.profile_picture_path) {
    return { error: "Profile picture is required." };
  }
  Object.assign(insert, uploads.values);

  const { data: player, error } = await supabase
    .from("players")
    .insert(insert)
    .select("id")
    .single();

  if (error || !player) {
    logError(`Failed to create player for centre ${centreAdmin.centre_id}:`, error);
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
  } catch (err) {
    // Parent account/link failed (e.g. email not configured yet) — the
    // player record itself is saved regardless. updateParentProfile
    // re-attempts this same resolve-and-link step (idempotently) on every
    // save of the Parent Profile tab, so saving that tab once is the actual
    // recovery path — not just editing player fields in general.
    logError(`Failed to link parent for player ${player.id} (${d.parentEmail}):`, err);
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

  type DocColumn = "aadhaar_doc_path" | "medical_records_path" | "profile_picture_path";

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("players")
    .select("aadhaar_doc_path, medical_records_path, profile_picture_path, package_id")
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  const { packageId, error: packageError } = await resolvePackageId(
    supabase,
    centreAdmin.centre_id!,
    d.playerTypeId ?? null,
    d.packageId,
    { name: d.customPackageName, amount: d.customAmount, discount: d.customDiscount },
    existing?.package_id
  );
  if (packageError) {
    return { error: packageError };
  }

  const update: PlayerUpdate = {
    name: d.name,
    date_of_birth: d.dateOfBirth,
    age_category_id: d.ageCategoryId ?? null,
    email: d.email ?? null,
    contact_number: d.contactNumber ?? null,
    player_type_id: d.playerTypeId ?? null,
    package_id: packageId,
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

  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarDoc", column: "aadhaar_doc_path" },
    { formKey: "medicalRecords", column: "medical_records_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
  ];

  const uploads = await uploadDocFields(formData, docFields, `player-documents/${id}`, centreAdmin.id);
  if (uploads.error) {
    return { error: uploads.error };
  }
  Object.assign(update, uploads.values);

  const { error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to save player ${id}:`, error);
    return { error: "Failed to save player." };
  }

  if (existing) deleteReplacedDocs<DocColumn>(existing, uploads.values);

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
  return undefined;
}

const PlayerProfileSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }),
  dateOfBirth: z.string().min(1, { error: "Date of birth is required." }),
  ageCategoryId: z.string().optional(),
  email: z.email({ error: "Enter a valid player email." }).optional(),
  contactNumber: z.string().optional(),
  playerTypeId: z.string().optional(),
  packageId: z.string().optional(),
  customPackageName: z.string().optional(),
  customAmount: z.coerce.number().optional(),
  customDiscount: z.coerce.number().optional(),
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
});

export async function updatePlayerProfile(
  id: string,
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = PlayerProfileSchema.safeParse({
    name: formData.get("name"),
    dateOfBirth: formData.get("dateOfBirth"),
    ageCategoryId: optionalStr(formData.get("ageCategoryId")),
    email: optionalStr(formData.get("email")),
    contactNumber: optionalStr(formData.get("contactNumber")),
    playerTypeId: optionalStr(formData.get("playerTypeId")),
    packageId: optionalStr(formData.get("packageId")),
    customPackageName: optionalStr(formData.get("customPackageName")),
    customAmount: optionalStr(formData.get("customAmount")),
    customDiscount: optionalStr(formData.get("customDiscount")),
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  type DocColumn = "aadhaar_doc_path" | "medical_records_path" | "profile_picture_path";

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("players")
    .select("aadhaar_doc_path, medical_records_path, profile_picture_path, package_id")
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  const { packageId, error: packageError } = await resolvePackageId(
    supabase,
    centreAdmin.centre_id!,
    d.playerTypeId ?? null,
    d.packageId,
    { name: d.customPackageName, amount: d.customAmount, discount: d.customDiscount },
    existing?.package_id
  );
  if (packageError) {
    return { error: packageError };
  }

  const update: PlayerUpdate = {
    name: d.name,
    date_of_birth: d.dateOfBirth,
    age_category_id: d.ageCategoryId ?? null,
    email: d.email ?? null,
    contact_number: d.contactNumber ?? null,
    player_type_id: d.playerTypeId ?? null,
    package_id: packageId,
    batch_id: d.batchId ?? null,
    gender: d.gender ?? null,
    blood_group: d.bloodGroup ?? null,
    height_cm: d.heightCm ?? null,
    weight_kg: d.weightKg ?? null,
    birth_mark: d.birthMark ?? null,
    medical_condition: d.medicalCondition ?? null,
    food_allergy: d.foodAllergy ?? null,
    aiff_number: d.aiffNumber ?? null,
  };

  if (d.passportNumber) {
    update.passport_number_encrypted = encryptField(d.passportNumber);
  }
  if (d.aadhaarNumber) {
    update.aadhaar_number_encrypted = encryptField(d.aadhaarNumber);
  }

  const docFields: { formKey: string; column: DocColumn }[] = [
    { formKey: "aadhaarDoc", column: "aadhaar_doc_path" },
    { formKey: "medicalRecords", column: "medical_records_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
  ];

  const uploads = await uploadDocFields(formData, docFields, `player-documents/${id}`, centreAdmin.id);
  if (uploads.error) {
    return { error: uploads.error };
  }
  Object.assign(update, uploads.values);

  const { error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to save player profile ${id}:`, error);
    return { error: "Failed to save player profile." };
  }

  if (existing) deleteReplacedDocs<DocColumn>(existing, uploads.values);

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
  return undefined;
}

const ParentProfileSchema = z.object({
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  parentContactNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
});

export async function updateParentProfile(
  id: string,
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = ParentProfileSchema.safeParse({
    fatherName: optionalStr(formData.get("fatherName")),
    motherName: optionalStr(formData.get("motherName")),
    parentContactNumber: optionalStr(formData.get("parentContactNumber")),
    addressLine1: optionalStr(formData.get("addressLine1")),
    addressLine2: optionalStr(formData.get("addressLine2")),
    country: optionalStr(formData.get("country")),
    state: optionalStr(formData.get("state")),
    city: optionalStr(formData.get("city")),
    pincode: optionalStr(formData.get("pincode")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const update: PlayerUpdate = {
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

  const supabase = await createClient();
  const { data: player, error } = await supabase
    .from("players")
    .update(update)
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .select("parent_email")
    .maybeSingle();

  if (error) {
    logError(`Failed to save parent profile for player ${id}:`, error);
    return { error: "Failed to save parent profile." };
  }

  // Heals a parent_player_links row that createPlayer's own parent
  // provisioning step (see its comment) failed to create — this is the
  // "retried by editing the player" path that comment refers to; without
  // this, that was never actually implemented anywhere, and a failed link
  // had no recovery path at all. Idempotent: parent_player_links' primary
  // key is (parent_id, player_id), so re-running this when the link
  // already exists is a harmless no-op.
  if (player?.parent_email) {
    try {
      const parentProfileId = await resolveParentProfileId(
        player.parent_email,
        d.fatherName || d.motherName || "Parent"
      );
      const admin = createAdminClient();
      await admin.from("parent_player_links").upsert(
        { parent_id: parentProfileId, player_id: id, centre_id: centreAdmin.centre_id! },
        { onConflict: "parent_id,player_id" }
      );
    } catch (err) {
      logError(`Failed to (re)link parent for player ${id}:`, err);
    }
  }

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
  return undefined;
}

export async function setPlayerActive(id: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("players")
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "activate" : "deactivate"} player ${id}:`, error);
    throw new Error("Failed to save.");
  }

  revalidatePath(PATH);
  revalidatePath(`/centre-admin/players/${id}`);
}
