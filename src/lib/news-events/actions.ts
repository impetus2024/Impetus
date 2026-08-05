"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveTargetCentreIds } from "@/lib/publishable-content/centres";
import { deleteViaServiceRole } from "@/lib/publishable-content/delete-with-cascade";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/publishable-content/roles";
import { logError } from "@/lib/logger";

const NewsEventSchema = z
  .object({
    type: z.enum(["upcoming_event", "news_announcement"], { error: "Select a type." }),
    title: z.string().min(1, { error: "Title is required." }),
    description: z.string().optional(),
    eventDate: z.string().optional(),
  })
  .refine((data) => data.type !== "upcoming_event" || Boolean(data.eventDate), {
    error: "Event date is required for upcoming events.",
    path: ["eventDate"],
  });

export type NewsEventFormState = { error?: string } | undefined;

function revalidateNewsEvents() {
  revalidatePath("/centre-admin/news-events");
  revalidatePath("/super-admin/news-events");
}

// Sister of createMonthlyHighlight (src/lib/monthly-highlights/actions.ts)
// — same centre-resolution and publish-mapping shape, no image step. Centre
// Admin always auto-publishes to their own (session-resolved) centre; Super
// Admin selects one or more centres from the "centreIds" checkboxes — see
// resolveTargetCentreIds. The client never gets to say which centre a
// Centre Admin's news/event belongs to — see the RLS policies in
// 20260805040000_news_events.sql, which independently enforce the same
// restriction if this ever gets bypassed.
export async function createNewsEvent(
  _prev: NewsEventFormState,
  formData: FormData
): Promise<NewsEventFormState> {
  const actor = await requireRole("centre_admin", "super_admin");

  const parsed = NewsEventSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    // Only rendered for "upcoming_event" (see AddNewsEventDialog) — absent
    // for "news_announcement", where FormData.get returns null, not
    // undefined, which z.string().optional() rejects.
    eventDate: formData.get("eventDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const centreIds = resolveTargetCentreIds(actor, formData);

  if (centreIds.length === 0) {
    return { error: "Select at least one centre." };
  }

  const supabase = await createClient();

  const { data: newsEvent, error } = await supabase
    .from("news_events")
    .insert({
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      event_date: parsed.data.type === "upcoming_event" ? parsed.data.eventDate : null,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !newsEvent) {
    logError("Failed to create news/event:", error);
    return { error: "Failed to create item." };
  }

  const { error: linkError } = await supabase.from("news_event_centres").insert(
    centreIds.map((centreId) => ({
      news_event_id: newsEvent.id,
      centre_id: centreId,
      created_by: actor.id,
    }))
  );

  if (linkError) {
    logError(`Failed to publish news/event ${newsEvent.id} to selected centres:`, linkError);
    return {
      error: "Item was created but publishing it to the selected centres failed.",
    };
  }

  revalidateNewsEvents();
  return undefined;
}

// Edits are limited to the item's own content (type/title/description/event
// date) — retargeting which centres see it isn't part of this form. RLS's
// "own or centre-published" policy (see the migration) is what actually
// decides which newsEventId a Centre Admin can reach here; a Super Admin's
// own full-access policy covers every item.
export async function updateNewsEvent(
  newsEventId: string,
  _prev: NewsEventFormState,
  formData: FormData
): Promise<NewsEventFormState> {
  await requireRole("centre_admin", "super_admin");

  const parsed = NewsEventSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    eventDate: formData.get("eventDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("news_events")
    .update({
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description || null,
      event_date: parsed.data.type === "upcoming_event" ? parsed.data.eventDate : null,
    })
    .eq("id", newsEventId)
    .select("id")
    .maybeSingle();

  if (error) {
    logError(`Failed to update news/event ${newsEventId}:`, error);
    return { error: "Failed to save changes." };
  }

  // RLS silently updates zero rows rather than erroring when the id is out
  // of the caller's "own or centre-published" scope (or doesn't exist) —
  // .select().maybeSingle() is what turns that into a visible error instead
  // of a false "saved" response.
  if (!data) {
    return { error: "Item not found." };
  }

  revalidateNewsEvents();
  return undefined;
}

// Per-user "hide from my dashboard feed" — unlike create/update/delete this
// never touches the item itself, so any role that can see it on a dashboard
// (not just centre_admin/super_admin) may dismiss it for their own account.
// See 20260805050000_dashboard_item_dismissals.sql.
export async function dismissNewsEvent(newsEventId: string): Promise<NewsEventFormState> {
  const actor = await requireRole(...DASHBOARD_VIEWER_ROLES);

  const supabase = await createClient();
  const { error } = await supabase
    .from("news_event_dismissals")
    .upsert({ news_event_id: newsEventId, user_id: actor.id }, { onConflict: "news_event_id,user_id" });

  if (error) {
    logError(`Failed to dismiss news/event ${newsEventId} for user ${actor.id}:`, error);
    return { error: "Failed to dismiss." };
  }

  revalidatePath("/centre-admin");
  revalidatePath("/super-admin");
  return undefined;
}

// Deleting cascades to news_event_centres rows across every centre it's
// published to — same cross-centre RLS cascade problem as
// deleteMonthlyHighlight, see deleteViaServiceRole's own comment.
export async function deleteNewsEvent(
  newsEventId: string,
  _prev: NewsEventFormState,
  _formData: FormData
): Promise<NewsEventFormState> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("news_events")
    .select("id")
    .eq("id", newsEventId)
    .maybeSingle();

  if (!existing) {
    return { error: "Item not found." };
  }

  const deleted = await deleteViaServiceRole("news_events", newsEventId);

  if (!deleted) {
    logError(`Failed to delete news/event ${newsEventId}`, undefined);
    return { error: "Failed to delete item." };
  }

  revalidateNewsEvents();
  return undefined;
}
