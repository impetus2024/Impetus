import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, pageRange, totalPages as computeTotalPages } from "@/lib/pagination";
import { getLastNMonths, monthKeyOf } from "@/lib/months";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RevenueRangeFilter } from "./revenue-range-filter";
import { REVENUE_RANGE_OPTIONS, DEFAULT_REVENUE_RANGE } from "./revenue-range";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; packageId?: string; page?: string; range?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const { q, packageId, page: pageParam, range: rangeParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  const range = REVENUE_RANGE_OPTIONS.some((o) => o.id === rangeParam)
    ? rangeParam!
    : DEFAULT_REVENUE_RANGE;

  let monthsCount = 6;
  if (range === "all") {
    const { data: earliest } = await supabase
      .from("payments")
      .select("payment_date")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("payment_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (earliest) {
      const earliestDate = new Date(earliest.payment_date);
      const now = new Date();
      monthsCount = Math.max(
        1,
        (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth()) + 1
      );
    }
  } else {
    monthsCount = Number(range);
  }
  const months = getLastNMonths(monthsCount);

  let query = supabase
    .from("payments")
    .select("id, amount, payment_date, notes, players!inner(name), packages(name)", { count: "exact" })
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("players.name", `%${q}%`);
  if (packageId) query = query.eq("package_id", packageId);

  const [{ data: payments, count }, { data: packages }, { data: paymentsByMonthRows }] = await Promise.all([
    query.order("payment_date", { ascending: false }).range(from, to),
    supabase
      .from("packages")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .eq("is_custom", false)
      .order("name"),
    // Same aggregate RPC as the dashboard's Payments chart (grouped in
    // SQL, not summed per-row in JS — see its migration) so this page's
    // revenue trend always agrees with the dashboard's.
    supabase.rpc("payments_by_month", {
      p_centre_id: centreAdmin.centre_id!,
      p_since: months[0].start.toISOString().slice(0, 10),
    }),
  ]);

  const totalByMonthKey = new Map(
    (paymentsByMonthRows ?? []).map((row) => [monthKeyOf(row.month), row.total])
  );
  // Months only need a year suffix ("Mar '25") once a window can span more
  // than one calendar year -- the default 6-month view never does.
  const showYear = range !== "6";
  const revenueByMonth = months.map((m) => ({
    label: showYear ? `${m.label} '${String(m.year).slice(2)}` : m.label,
    value: totalByMonthKey.get(m.key) ?? 0,
  }));

  const hasFilters = Boolean(q || packageId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payment History</h1>

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
          <CardAction>
            <RevenueRangeFilter />
          </CardAction>
        </CardHeader>
        <CardContent>
          <RevenueAreaChart data={revenueByMonth} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search by player..." />
        <ListFilter paramKey="packageId" label="All packages" options={packages ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.players?.name}</TableCell>
              <TableCell>{p.packages?.name ?? "—"}</TableCell>
              <TableCell>{p.amount}</TableCell>
              <TableCell>{p.payment_date}</TableCell>
              <TableCell>{p.notes ?? "—"}</TableCell>
            </TableRow>
          ))}
          {payments?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                {hasFilters ? (
                  <EmptyState icon={Wallet} title="No payments match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={Wallet} title="No payments recorded yet" />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ListPagination page={page} totalPages={computeTotalPages(count)} />
    </div>
  );
}
