import { requireRole } from "@/lib/auth/dal";
import { getNewsEvents } from "@/lib/news-events/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { NewsEventsTable } from "@/components/news-events/news-events-table";
import { AddNewsEventDialog } from "@/components/news-events/add-news-event-dialog";

// Full access for Media Team. No centre selector: createNewsEvent always
// publishes to this session's own centre_id, and RLS scopes the listing to it
// too (see 20261117010000_media_role_policies.sql).
export default async function MediaNewsEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("media");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { newsEvents, count } = await getNewsEvents(page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">News & Events</h1>
        <AddNewsEventDialog />
      </div>

      <NewsEventsTable newsEvents={newsEvents} canManage />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
