import { Package2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// packages has no RLS policy for the parent role (only staff can read it
// directly — same gap documented on the centre-admin batch-name lookup and
// the parent Player Profile view), so an embedded join here would resolve
// to null. The payments row itself is already proven (via RLS) to belong to
// this player, so a narrow admin-client lookup of just the referenced
// package names is safe.
export async function PackagesSection({ playerId }: { playerId: string }) {
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, package_id, amount, payment_date, notes")
    .eq("player_id", playerId)
    .order("payment_date", { ascending: false });

  const packageIds = [...new Set((payments ?? []).map((p) => p.package_id).filter((id): id is string => !!id))];

  let packageNames = new Map<string, string>();
  if (packageIds.length > 0) {
    const admin = createAdminClient();
    const { data: packages } = await admin.from("packages").select("id, name").in("id", packageIds);
    packageNames = new Map((packages ?? []).map((p) => [p.id, p.name]));
  }

  if (!payments || payments.length === 0) {
    return <EmptyState icon={Package2} title="No packages taken yet" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Package</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.package_id ? (packageNames.get(p.package_id) ?? "—") : "—"}</TableCell>
            <TableCell>{p.amount}</TableCell>
            <TableCell>{p.payment_date}</TableCell>
            <TableCell>{p.notes ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
