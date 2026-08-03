import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { ListPagination } from "@/components/list-pagination";
import { parsePageParam, pageRange, totalPages as computeTotalPages } from "@/lib/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddPaymentDialog } from "./add-payment-dialog";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; packageId?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const { q, packageId, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);
  const [from, to] = pageRange(page);

  let query = supabase
    .from("payments")
    .select("id, amount, payment_date, notes, players!inner(name), packages(name)", { count: "exact" })
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("players.name", `%${q}%`);
  if (packageId) query = query.eq("package_id", packageId);

  const [{ data: payments, count }, { data: players }, { data: packages }] = await Promise.all([
    query.order("payment_date", { ascending: false }).range(from, to),
    supabase
      .from("players")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("packages")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .eq("is_custom", false)
      .order("name"),
  ]);

  const hasFilters = Boolean(q || packageId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payment History</h1>
        {canEdit && <AddPaymentDialog players={players ?? []} packages={packages ?? []} />}
      </div>

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
