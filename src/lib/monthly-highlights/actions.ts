"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { uploadFile, deleteFile, UploadValidationError } from "@/lib/storage/r2";
import { resolveTargetCentreIds } from "@/lib/publishable-content/centres";
import { deleteViaServiceRole } from "@/lib/publishable-content/delete-with-cascade";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/publishable-content/roles";
import { logError } from "@/lib/logger";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MonthlyHighlightSchema = z.object({
  title: z.string().min(1, { error: "Title is required." }),
  description: z.string().optional(),
});

export type MonthlyHighlightFormState = { error?: string } | undefined;

function revalidateMonthlyHighlights() {
  revalidatePath("/centre-admin/monthly-highlights");
  revalidatePath("/super-admin/monthly-highlights");
}

// Centre Admin always auto-publishes to their own (session-resolved) centre
// and never sees a centre picker; Super Admin selects one or more centres
// from the "centreIds" checkboxes. The client never gets to say which
// centre a Centre Admin's highlight belongs to — see the RLS policies in
// 20260805030000_monthly_highlights.sql, which independently enforce the
// same restriction if this ever gets bypassed.
export async function createMonthlyHighlight(
  _prev: MonthlyHighlightFormState,
  formData: FormData
): Promise<MonthlyHighlightFormState> {
  const actor = await requireRole("centre_admin", "super_admin");

  const parsed = MonthlyHighlightSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return { error: "Image is required." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return { error: "Image must be a JPG, PNG, or WebP file." };
  }

  const centreIds = resolveTargetCentreIds(actor, formData);

  if (centreIds.length === 0) {
    return { error: "Select at least one centre." };
  }

  let imagePath: string;
  try {
    imagePath = await uploadFile(image, "monthly-highlights", "public", actor.id);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return { error: err.message };
    }
    logError("Failed to upload monthly highlight image:", err);
    return { error: "Image upload failed — try again." };
  }

  const supabase = await createClient();

  const { data: highlight, error } = await supabase
    .from("monthly_highlights")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      image_path: imagePath,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !highlight) {
    logError("Failed to create monthly highlight:", error);
    deleteFile(imagePath).catch((err) =>
      logError("Failed to clean up orphaned highlight image:", err)
    );
    return { error: "Failed to create highlight." };
  }

  const { error: linkError } = await supabase.from("monthly_highlight_centres").insert(
    centreIds.map((centreId) => ({
      highlight_id: highlight.id,
      centre_id: centreId,
      created_by: actor.id,
    }))
  );

  if (linkError) {
    logError(`Failed to publish highlight ${highlight.id} to selected centres:`, linkError);
    return {
      error: "Highlight was created but publishing it to the selected centres failed.",
    };
  }

  revalidateMonthlyHighlights();
  return undefined;
}

// Edits are limited to the highlight's own content (image/title/description)
// — retargeting which centres see it isn't part of this form. RLS's "own or
// centre-published" policy (see the migration) is what actually decides
// which highlightId a Centre Admin can reach here; a Super Admin's own
// full-access policy covers every highlight.
export async function updateMonthlyHighlight(
  highlightId: string,
  _prev: MonthlyHighlightFormState,
  formData: FormData
): Promise<MonthlyHighlightFormState> {
  const actor = await requireRole("centre_admin", "super_admin");

  const parsed = MonthlyHighlightSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("monthly_highlights")
    .select("image_path")
    .eq("id", highlightId)
    .maybeSingle();

  if (!existing) {
    return { error: "Highlight not found." };
  }

  const update: { title: string; description: string | null; image_path?: string } = {
    title: parsed.data.title,
    description: parsed.data.description || null,
  };

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
      return { error: "Image must be a JPG, PNG, or WebP file." };
    }
    try {
      update.image_path = await uploadFile(image, "monthly-highlights", "public", actor.id);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return { error: err.message };
      }
      logError(`Image upload failed for highlight ${highlightId}:`, err);
      return { error: "Image upload failed — try again." };
    }
  }

  const { error } = await supabase.from("monthly_highlights").update(update).eq("id", highlightId);

  if (error) {
    logError(`Failed to update monthly highlight ${highlightId}:`, error);
    return { error: "Failed to save highlight." };
  }

  if (update.image_path && existing.image_path && existing.image_path !== update.image_path) {
    deleteFile(existing.image_path).catch((err) =>
      logError(`Failed to delete replaced image for highlight ${highlightId}:`, err)
    );
  }

  revalidateMonthlyHighlights();
  return undefined;
}

// Deleting a highlight cascades to its monthly_highlight_centres rows across
// every centre it's published to — for a Centre Admin managing a highlight
// a Super Admin also published elsewhere, that cascade touches other
// centres' link rows, which they have no RLS DELETE rights on (see the
// migration comment on why that table never subqueries monthly_highlights
// back). The existence check below is what actually gates access here,
// using the same RLS "own or centre-published" policy a regular client
// would hit; the service-role client only bypasses the cascade's own RLS
// check once that's already established, same pattern as deleteCentre.
export async function deleteMonthlyHighlight(
  highlightId: string,
  _prev: MonthlyHighlightFormState,
  _formData: FormData
): Promise<MonthlyHighlightFormState> {
  await requireRole("centre_admin", "super_admin");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("monthly_highlights")
    .select("image_path")
    .eq("id", highlightId)
    .maybeSingle();

  if (!existing) {
    return { error: "Highlight not found." };
  }

  const deleted = await deleteViaServiceRole("monthly_highlights", highlightId);

  if (!deleted) {
    logError(`Failed to delete monthly highlight ${highlightId}`, undefined);
    return { error: "Failed to delete highlight." };
  }

  if (existing.image_path) {
    deleteFile(existing.image_path).catch((err) =>
      logError(`Failed to delete image for deleted highlight ${highlightId}:`, err)
    );
  }

  revalidateMonthlyHighlights();
  return undefined;
}

// Per-user "hide from my dashboard feed" — unlike create/update/delete this
// never touches the highlight itself, so any role that can see it on a
// dashboard (not just centre_admin/super_admin) may dismiss it for their
// own account. See 20260805050000_dashboard_item_dismissals.sql.
export async function dismissMonthlyHighlight(
  highlightId: string
): Promise<MonthlyHighlightFormState> {
  const actor = await requireRole(...DASHBOARD_VIEWER_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("monthly_highlight_dismissals").upsert(
    { monthly_highlight_id: highlightId, user_id: actor.id },
    { onConflict: "monthly_highlight_id,user_id" }
  );

  if (error) {
    logError(`Failed to dismiss monthly highlight ${highlightId} for user ${actor.id}:`, error);
    return { error: "Failed to dismiss." };
  }

  revalidatePath("/centre-admin");
  revalidatePath("/super-admin");
  return undefined;
}
