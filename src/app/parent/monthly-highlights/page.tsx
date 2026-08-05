import { requireRole } from "@/lib/auth/dal";
import { getMonthlyHighlights } from "@/lib/monthly-highlights/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { MonthlyHighlightsTable } from "@/components/monthly-highlights/monthly-highlights-table";

// Read-only for Parent — RLS scopes the listing to their linked children's
// centres (see 20260805060000_news_events_monthly_highlights_broader_read_
// access.sql); no Add/Edit/Delete, matching every other role besides
// centre_admin/super_admin.
export default async function ParentMonthlyHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("parent");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { highlights, count } = await getMonthlyHighlights(page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Monthly Highlights</h1>

      <MonthlyHighlightsTable highlights={highlights} canManage={false} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
