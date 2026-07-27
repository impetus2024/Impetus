"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/storage/r2";
import { provisionUser } from "@/lib/auth/provision-user";
import { absoluteUrl } from "@/lib/url";

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
  await requireRole("super_admin");

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
    return { error: "Failed to create centre." };
  }

  const warnings: string[] = [];

  try {
    const logoKey = await uploadFile(logo, `centre-logos/${centre.id}`);
    await supabase
      .from("centres")
      .update({ logo_path: logoKey })
      .eq("id", centre.id);
  } catch {
    warnings.push(
      "logo upload failed (storage isn't configured yet) — add it later"
    );
  }

  // Independent of the logo: the centre still needs an admin even if the
  // logo didn't make it, so this always runs regardless of the step above.
  try {
    await provisionUser({
      email: parsed.data.adminEmail,
      fullName: parsed.data.adminName,
      role: "centre_admin",
      centreId: centre.id,
      loginUrl: absoluteUrl("/login"),
    });
  } catch {
    warnings.push("failed to create the Centre Admin account — add one from the centre's row instead");
  }

  revalidatePath("/super-admin/centres");

  if (warnings.length > 0) {
    return { error: `Centre created, but ${warnings.join("; ")}.` };
  }
  return undefined;
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

  try {
    await provisionUser({
      email: parsed.data.adminEmail,
      fullName: parsed.data.adminName,
      role: "centre_admin",
      centreId,
      loginUrl: absoluteUrl("/login"),
    });
  } catch {
    return { error: "Failed to create the Centre Admin account." };
  }

  revalidatePath("/super-admin/centres");
  return undefined;
}
