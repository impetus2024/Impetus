import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/pagination";

export type NewsEventListItem = {
  id: string;
  type: "upcoming_event" | "news_announcement";
  title: string;
  description: string | null;
  event_date: string | null;
  created_at: string;
  expires_at: string;
  centres: { id: string; name: string }[];
};

// Sister of getMonthlyHighlights (src/lib/monthly-highlights/queries.ts) —
// same shape, same reasoning: RLS on news_events/news_event_centres (see
// 20260805040000_news_events.sql) scopes a Centre Admin to their own centre
// regardless of what's passed here; centreId narrows further for the Super
// Admin dashboard, whose RLS is full-access across every centre. Active
// only, newest published first.
//
// dismissedFor: only NewsEventsFeed (the dashboard widget) passes this —
// the management table always shows every item regardless of what the
// viewing admin has personally dismissed from their own dashboard. Filtered
// client-side after the page is fetched (see 20260805050000_dashboard_item_
// dismissals.sql) rather than via a NOT IN on the main query, so a
// dismissed item just makes that page a few items shorter instead of
// needing exact pagination math — fine for a "latest items" feed that
// isn't paginated.
export async function getNewsEvents(
  page: number,
  centreId?: string,
  dismissedFor?: string
): Promise<{ newsEvents: NewsEventListItem[]; count: number | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(page);

  let query = supabase
    .from("news_events")
    .select(
      "id, type, title, description, event_date, created_at, expires_at, news_event_centres!inner(centres(id, name))",
      { count: "exact" }
    )
    .gt("expires_at", new Date().toISOString());

  if (centreId) {
    query = query.eq("news_event_centres.centre_id", centreId);
  }

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  let newsEvents: NewsEventListItem[] = (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.description,
    event_date: n.event_date,
    created_at: n.created_at,
    expires_at: n.expires_at,
    centres: n.news_event_centres.map((link) => link.centres),
  }));

  if (dismissedFor) {
    const { data: dismissals } = await supabase
      .from("news_event_dismissals")
      .select("news_event_id")
      .eq("user_id", dismissedFor);
    const dismissedIds = new Set((dismissals ?? []).map((d) => d.news_event_id));
    newsEvents = newsEvents.filter((n) => !dismissedIds.has(n.id));
  }

  return { newsEvents, count };
}
