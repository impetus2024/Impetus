import { ListSearch } from "@/components/list-search";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, totalPages as computeTotalPages } from "@/lib/pagination";
import { resolveDateRange } from "@/lib/email-analytics/date-range";
import { getEmailAnalyticsSummary, getEmailLogs, isEmailLogSortColumn } from "@/lib/email-analytics/queries";
import { EmailSummaryCards } from "./email-summary-cards";
import { EmailMetricsCards } from "./email-metrics-cards";
import { DateRangeFilter } from "./date-range-filter";
import { EmailLogTable } from "./email-log-table";

export type EmailAnalyticsSearchParams = {
  q?: string;
  range?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

// Shared by /centre-admin/email-analytics and /super-admin/email-analytics —
// the only difference between the two roles is how centreId is resolved
// (the centre_admin's own session vs. the super_admin's CentreSelect), which
// both page.tsx files do themselves before rendering this. This component
// never reads a centre id from searchParams/props other than the one it's
// explicitly given.
export async function EmailAnalyticsDashboard({
  centreId,
  searchParams,
  detailBasePath,
}: {
  centreId: string;
  searchParams: EmailAnalyticsSearchParams;
  detailBasePath: string;
}) {
  const { since, until, preset, from, to } = resolveDateRange(searchParams);
  const sort = isEmailLogSortColumn(searchParams.sort) ? searchParams.sort : "sent_at";
  const dir = searchParams.dir === "asc" ? "asc" : "desc";
  const page = parsePageParam(searchParams.page);

  const [summary, { logs, count }] = await Promise.all([
    getEmailAnalyticsSummary(centreId, since, until),
    getEmailLogs(centreId, { q: searchParams.q, since, until, sort, dir, page }),
  ]);

  const hasFilters = Boolean(searchParams.q);

  return (
    <div className="space-y-6">
      <EmailSummaryCards summary={summary} />
      <EmailMetricsCards summary={summary} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListSearch placeholder="Search by recipient email..." />
        <DateRangeFilter preset={preset} from={from} to={to} />
      </div>

      <EmailLogTable
        logs={logs}
        sort={sort}
        dir={dir}
        centreId={centreId}
        detailBasePath={detailBasePath}
        hasFilters={hasFilters}
      />

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
