import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

// player_types and age_categories are structurally identical: a per-centre
// name + is_active flag. Shared here so the two concrete Server Action
// modules (which Next.js requires as named top-level exports) stay thin.
export type LookupTable = "player_types" | "age_categories";
export type LookupFormState = { error?: string } | undefined;

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function createLookupItem(
  table: LookupTable,
  name: string,
  path: string
): Promise<LookupFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .insert({ centre_id: centreAdmin.centre_id!, name: trimmed });

  if (error) {
    if (!isUniqueViolation(error)) logError(`Failed to create ${table} "${trimmed}":`, error);
    return {
      error: isUniqueViolation(error)
        ? "That name already exists."
        : "Failed to create.",
    };
  }

  revalidatePath(path);
  return undefined;
}

export async function renameLookupItem(
  table: LookupTable,
  id: string,
  name: string,
  path: string
): Promise<LookupFormState> {
  const centreAdmin = await requireRole("centre_admin");
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ name: trimmed })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    if (!isUniqueViolation(error)) logError(`Failed to rename ${table} ${id}:`, error);
    return {
      error: isUniqueViolation(error)
        ? "That name already exists."
        : "Failed to save.",
    };
  }

  revalidatePath(path);
  return undefined;
}

export async function setLookupItemActive(
  table: LookupTable,
  id: string,
  active: boolean,
  path: string
) {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from(table)
    .update({ is_active: active })
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!);

  if (error) {
    logError(`Failed to ${active ? "activate" : "deactivate"} ${table} ${id}:`, error);
    throw new Error("Failed to save.");
  }

  revalidatePath(path);
}
