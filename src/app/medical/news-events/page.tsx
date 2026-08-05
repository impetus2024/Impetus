import { requireRole } from "@/lib/auth/dal";
import { getNewsEvents } from "@/lib/news-events/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { NewsEventsTable } from "@/components/news-events/news-events-table";

// Read-only for Medical — RLS scopes the listing to their own centre (see
// 20260805060000_news_events_monthly_highlights_broader_read_access.sql);
// no Add/Edit/Delete, matching every other role besides centre_admin/
// super_admin.
export default async function MedicalNewsEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("medical");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { newsEvents, count } = await getNewsEvents(page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">News & Events</h1>

      <NewsEventsTable newsEvents={newsEvents} canManage={false} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
