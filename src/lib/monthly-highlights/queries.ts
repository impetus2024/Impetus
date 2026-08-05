import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/pagination";

export type MonthlyHighlightListItem = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  created_at: string;
  expires_at: string;
  centres: { id: string; name: string }[];
};

// Shared by /centre-admin/monthly-highlights, /super-admin/monthly-highlights,
// and both dashboards' Monthly Highlights feed — RLS on
// monthly_highlights/monthly_highlight_centres (see the 20260805030000
// migration) is what actually scopes the result for a Centre Admin, who
// only ever gets rows published to their own centre regardless of what's
// passed here. Active only ("expires_at" is a generated column, see the
// migration), newest published first.
//
// centreId narrows further, to one specific centre — needed for the Super
// Admin dashboard, whose "full access" RLS would otherwise return every
// centre's highlights at once instead of just the one selected via
// CentreSelect. `!inner` is required for a filter on an embedded resource
// to actually restrict the parent rows (a plain `.eq` on an embed only
// filters which children come back, not which highlights do) — harmless
// when centreId is omitted, since every highlight is expected to always
// have at least one centre link.
//
// dismissedFor: only MonthlyHighlightsFeed (the dashboard widget) passes
// this — the management table always shows every item regardless of what
// the viewing admin has personally dismissed from their own dashboard. See
// getNewsEvents's sister implementation for why this filters client-side
// after the page is fetched instead of via the main query.
export async function getMonthlyHighlights(
  page: number,
  centreId?: string,
  dismissedFor?: string
): Promise<{ highlights: MonthlyHighlightListItem[]; count: number | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(page);

  let query = supabase
    .from("monthly_highlights")
    .select(
      "id, title, description, image_path, created_at, expires_at, monthly_highlight_centres!inner(centres(id, name))",
      { count: "exact" }
    )
    .gt("expires_at", new Date().toISOString());

  if (centreId) {
    query = query.eq("monthly_highlight_centres.centre_id", centreId);
  }

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  let highlights: MonthlyHighlightListItem[] = (data ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    image_path: h.image_path,
    created_at: h.created_at,
    expires_at: h.expires_at,
    centres: h.monthly_highlight_centres.map((link) => link.centres),
  }));

  if (dismissedFor) {
    const { data: dismissals } = await supabase
      .from("monthly_highlight_dismissals")
      .select("monthly_highlight_id")
      .eq("user_id", dismissedFor);
    const dismissedIds = new Set((dismissals ?? []).map((d) => d.monthly_highlight_id));
    highlights = highlights.filter((h) => !dismissedIds.has(h.id));
  }

  return { highlights, count };
}
