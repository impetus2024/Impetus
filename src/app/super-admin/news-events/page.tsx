import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getNewsEvents } from "@/lib/news-events/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { NewsEventsTable } from "@/components/news-events/news-events-table";
import { AddNewsEventDialog } from "@/components/news-events/add-news-event-dialog";

export default async function SuperAdminNewsEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("super_admin");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const supabase = await createClient();

  const [{ newsEvents, count }, { data: centres }] = await Promise.all([
    getNewsEvents(page),
    supabase.from("centres").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">News & Events</h1>
        <AddNewsEventDialog centres={centres ?? []} />
      </div>

      <NewsEventsTable newsEvents={newsEvents} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
