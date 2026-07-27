import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddPaymentDialog } from "./add-payment-dialog";

export default async function PaymentsPage() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();

  const [{ data: payments }, { data: players }, { data: packages }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, payment_date, notes, players(name), packages(name)")
      .eq("centre_id", centreAdmin.centre_id!)
      .order("payment_date", { ascending: false }),
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
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payment History</h1>
        <AddPaymentDialog players={players ?? []} packages={packages ?? []} />
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
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No payments recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
