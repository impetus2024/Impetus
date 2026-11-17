import { requireRole } from "@/lib/auth/dal";
import { getMonthlyHighlights } from "@/lib/monthly-highlights/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { MonthlyHighlightsTable } from "@/components/monthly-highlights/monthly-highlights-table";
import { AddMonthlyHighlightDialog } from "@/components/monthly-highlights/add-monthly-highlight-dialog";

// Full access for Media Team. No centre selector: createMonthlyHighlight
// always publishes to this session's own centre_id, and RLS scopes the
// listing to it too (see 20261117010000_media_role_policies.sql).
export default async function MediaMonthlyHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("media");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { highlights, count } = await getMonthlyHighlights(page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monthly Highlights</h1>
        <AddMonthlyHighlightDialog />
      </div>

      <MonthlyHighlightsTable highlights={highlights} canManage />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
