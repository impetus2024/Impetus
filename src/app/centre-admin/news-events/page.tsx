import { requireRole } from "@/lib/auth/dal";
import { getNewsEvents } from "@/lib/news-events/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { NewsEventsTable } from "@/components/news-events/news-events-table";
import { AddNewsEventDialog } from "@/components/news-events/add-news-event-dialog";

export default async function CentreAdminNewsEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // No centre selector here — createNewsEvent always publishes to this
  // session's own centre_id, and RLS scopes the listing to it too (see
  // 20260805040000_news_events.sql). Staff/Finance share this page for
  // viewing — read-only, same as everywhere else they appear (see
  // 20260805060000_news_events_monthly_highlights_broader_read_access.sql).
  const profile = await requireRole("centre_admin", "staff", "finance");
  const canManage = profile.role === "centre_admin";
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { newsEvents, count } = await getNewsEvents(page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">News & Events</h1>
        {canManage && <AddNewsEventDialog />}
      </div>

      <NewsEventsTable newsEvents={newsEvents} canManage={canManage} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
