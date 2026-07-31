"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

const PATH = "/centre-admin/packages";

const PackageSchema = z.object({
  name: z.string().min(1, { error: "Package name is required." }),
  playerTypeId: z.string().optional(),
  price: z.coerce.number().positive({ error: "Enter a valid price." }),
  duration: z.string().min(1, { error: "Duration is required." }),
});

export type PackageFormState = { error?: string } | undefined;

function parsePackage(formData: FormData) {
  return PackageSchema.safeParse({
    name: formData.get("name"),
    playerTypeId: (formData.get("playerTypeId") as string | null) || undefined,
    price: formData.get("price"),
    duration: formData.get("duration"),
  });
}

export async function createPackage(
  _prev: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parsePackage(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("packages").insert({
    centre_id: centreAdmin.centre_id!,
    name: parsed.data.name,
    player_type_id: parsed.data.playerTypeId ?? null,
    price: parsed.data.price,
    duration: parsed.data.duration,
  });

  if (error) {
    logError(`Failed to create package for centre ${centreAdmin.centre_id}:`, error);
    return { error: "Failed to create package." };
  }

  revalidatePath(PATH);
  return undefined;
}

export async function updatePackage(
  id: string,
  _prev: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const parsed = parsePackage(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .update({
      name: parsed.data.name,
      player_type_id: parsed.data.playerTypeId ?? null,
      price: parsed.data.price,
      duration: parsed.data.duration,
    })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to save package ${id}:`, error);
    return { error: "Failed to save package." };
  }

  revalidatePath(PATH);
  return undefined;
}

export async function setPackageActive(id: string, active: boolean) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("packages")
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "activate" : "deactivate"} package ${id}:`, error);
    throw new Error("Failed to save.");
  }

  revalidatePath(PATH);
}
