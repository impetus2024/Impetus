import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyHighlights } from "@/lib/monthly-highlights/queries";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
import { MonthlyHighlightsTable } from "@/components/monthly-highlights/monthly-highlights-table";
import { AddMonthlyHighlightDialog } from "@/components/monthly-highlights/add-monthly-highlight-dialog";

export default async function SuperAdminMonthlyHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("super_admin");
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  const supabase = await createClient();

  const [{ highlights, count }, { data: centres }] = await Promise.all([
    getMonthlyHighlights(page),
    supabase.from("centres").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monthly Highlights</h1>
        <AddMonthlyHighlightDialog centres={centres ?? []} />
      </div>

      <MonthlyHighlightsTable highlights={highlights} />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
