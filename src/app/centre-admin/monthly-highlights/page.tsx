import { requireRole } from "@/lib/auth/dal";
import { getMonthlyHighlights } from "@/lib/monthly-highlights/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { MonthlyHighlightsTable } from "@/components/monthly-highlights/monthly-highlights-table";
import { AddMonthlyHighlightDialog } from "@/components/monthly-highlights/add-monthly-highlight-dialog";

export default async function CentreAdminMonthlyHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // No centre selector here — createMonthlyHighlight always publishes to
  // this session's own centre_id, and RLS scopes the listing to it too (see
  // 20260805030000_monthly_highlights.sql). Staff/Finance share this page
  // for viewing — read-only, same as everywhere else they appear (see
  // 20260805060000_news_events_monthly_highlights_broader_read_access.sql).
  const profile = await requireRole("centre_admin", "staff", "finance");
  const canManage = profile.role === "centre_admin";
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const { highlights, count } = await getMonthlyHighlights(page);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monthly Highlights</h1>
        {canManage && <AddMonthlyHighlightDialog />}
      </div>

      <MonthlyHighlightsTable highlights={highlights} canManage={canManage} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
