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

  try {
    const logoKey = await uploadFile(logo, `centre-logos/${centre.id}`);
    await supabase
      .from("centres")
      .update({ logo_path: logoKey })
      .eq("id", centre.id);
  } catch {
    revalidatePath("/super-admin/centres");
    return {
      error:
        "Centre created, but the logo upload failed (storage isn't configured yet). Add R2 credentials and try again.",
    };
  }

  try {
    await provisionUser({
      email: parsed.data.adminEmail,
      fullName: parsed.data.adminName,
      role: "centre_admin",
      centreId: centre.id,
      loginUrl: absoluteUrl("/login"),
    });
  } catch {
    revalidatePath("/super-admin/centres");
    return {
      error:
        "Centre created, but inviting the Centre Admin failed (email isn't configured yet). Add the administrator from Administrator Management once email is set up.",
    };
  }

  revalidatePath("/super-admin/centres");
  return undefined;
}
