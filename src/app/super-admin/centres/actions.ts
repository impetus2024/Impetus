"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { uploadFile, deleteFile, UploadValidationError } from "@/lib/storage/r2";
import { provisionUser } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";
import { logError } from "@/lib/logger";

const CentreSchema = z.object({
  name: z.string().min(1, { error: "Centre name is required." }),
  contactNumber: z.string().min(1, { error: "Contact number is required." }),
  email: z.email({ error: "Enter a valid centre email." }),
  country: z.string().min(1, { error: "Country is required." }),
  adminName: z.string().min(1, { error: "Initial admin name is required." }),
  adminEmail: z.email({ error: "Enter a valid admin email." }),
});

export type CentreFormState = { error?: string } | undefined;

// The Centre Creation form in the FRD only captures centre details, but a
// new centre needs a first Centre Admin to actually manage it — so this
// also provisions that account (see the "initial Centre Admin" assumption
// flagged during planning).
export async function createCentre(
  _prev: CentreFormState,
  formData: FormData
): Promise<CentreFormState> {
  const superAdmin = await requireRole("super_admin");

  const parsed = CentreSchema.safeParse({
    name: formData.get("name"),
    contactNumber: formData.get("contactNumber"),
    email: formData.get("email"),
    country: formData.get("country"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) {
    return { error: "Centre logo is required." };
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(logo.type)) {
    return { error: "Logo must be a JPG, PNG, or WebP image." };
  }

  const supabase = await createClient();
  const { data: centre, error } = await supabase
    .from("centres")
    .insert({
      name: parsed.data.name,
      contact_number: parsed.data.contactNumber,
      email: parsed.data.email,
      country: parsed.data.country,
    })
    .select("id")
    .single();

  if (error || !centre) {
    logError(`Failed to create centre "${parsed.data.name}":`, error);
    return { error: "Failed to create centre." };
  }

  const warnings: string[] = [];

  try {
    const logoKey = await uploadFile(logo, `centre-logos/${centre.id}`, "public", superAdmin.id);
    await supabase
      .from("centres")
      .update({ logo_path: logoKey })
      .eq("id", centre.id);
  } catch (err) {
    logError(`Logo upload failed for centre ${centre.id}:`, err);
    warnings.push(
      err instanceof UploadValidationError
        ? err.message
        : "logo upload failed (storage isn't configured yet) — add it later"
    );
  }

  // Independent of the logo: the centre still needs an admin even if the
  // logo didn't make it, so this always runs regardless of the step above.
  try {
    const { emailSent } = await provisionUser({
      email: parsed.data.adminEmail,
      fullName: parsed.data.adminName,
      role: "centre_admin",
      centreId: centre.id,
      loginUrl: absoluteUrl("/login"),
    });
    if (!emailSent) {
      warnings.push(
        "the Centre Admin's invite email couldn't be sent — they can set their own password via \"Forgot password?\" on the login page"
      );
    }
  } catch (err) {
    logError(`Failed to provision first admin for centre ${centre.id}:`, err);
    warnings.push("failed to create the Centre Admin account — add one from the centre's row instead");
  }

  revalidatePath("/super-admin/centres");

  if (warnings.length > 0) {
    return { error: `Centre created, but ${warnings.join("; ")}.` };
  }
  return undefined;
}

const UpdateCentreSchema = z.object({
  name: z.string().min(1, { error: "Centre name is required." }),
  contactNumber: z.string().min(1, { error: "Contact number is required." }),
  email: z.email({ error: "Enter a valid centre email." }),
  country: z.string().min(1, { error: "Country is required." }),
});

// Same fields the "restrict_centre_admin_centre_update" trigger locks to
// super_admin-only (see supabase/migrations/20260731050000_...): a
// centre_admin already can't change these at the RLS layer, so this action
// is what actually exposes editing them, for the one role allowed to.
export async function updateCentre(
  centreId: string,
  _prev: CentreFormState,
  formData: FormData
): Promise<CentreFormState> {
  const superAdmin = await requireRole("super_admin");

  const parsed = UpdateCentreSchema.safeParse({
    name: formData.get("name"),
    contactNumber: formData.get("contactNumber"),
    email: formData.get("email"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("centres")
    .select("logo_path")
    .eq("id", centreId)
    .maybeSingle();

  if (!existing) {
    return { error: "Centre not found." };
  }

  const update: {
    name: string;
    contact_number: string;
    email: string;
    country: string;
    logo_path?: string;
  } = {
    name: parsed.data.name,
    contact_number: parsed.data.contactNumber,
    email: parsed.data.email,
    country: parsed.data.country,
  };

  // Replacing the logo is optional on edit (unlike creation, where it's
  // required) — only touch it if a new file was actually chosen.
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      update.logo_path = await uploadFile(logo, `centre-logos/${centreId}`, "public", superAdmin.id);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { error: err.message };
      }
      logError(`Logo upload failed for centre ${centreId}:`, err);
      return { error: "Logo upload failed — try again." };
    }
  }

  const { error } = await supabase.from("centres").update(update).eq("id", centreId);

  if (error) {
    logError(`Failed to update centre ${centreId}:`, error);
    return { error: "Failed to save centre." };
  }

  if (update.logo_path && existing.logo_path && existing.logo_path !== update.logo_path) {
    deleteFile(existing.logo_path).catch((err) =>
      logError(`Failed to delete replaced logo for centre ${centreId}:`, err)
    );
  }

  revalidatePath("/super-admin/centres");
  return undefined;
}

export async function setCentreActive(centreId: string, active: boolean) {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("centres")
    .update({ is_active: active })
    .eq("id", centreId);

  if (error) {
    logError(`Failed to ${active ? "enable" : "disable"} centre ${centreId}:`, error);
    throw error;
  }

  revalidatePath("/super-admin/centres");
}

export async function inviteCentreAdmin(
  centreId: string,
  _prev: CentreFormState,
  formData: FormData
): Promise<CentreFormState> {
  await requireRole("super_admin");

  const parsed = z
    .object({
      adminName: z.string().min(1, { error: "Name is required." }),
      adminEmail: z.email({ error: "Enter a valid email." }),
    })
    .safeParse({
      adminName: formData.get("adminName"),
      adminEmail: formData.get("adminEmail"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let emailSent: boolean;
  try {
    const result = await provisionUser({
      email: parsed.data.adminEmail,
      fullName: parsed.data.adminName,
      role: "centre_admin",
      centreId,
      loginUrl: absoluteUrl("/login"),
    });
    emailSent = result.emailSent;
  } catch (err) {
    logError(`Failed to invite centre admin for centre ${centreId}:`, err);
    return { error: "Failed to create the Centre Admin account." };
  }

  revalidatePath("/super-admin/centres");

  if (!emailSent) {
    return {
      error:
        "Account created, but the invite email couldn't be sent — they can set their own password via \"Forgot password?\" on the login page.",
    };
  }
  return undefined;
}
