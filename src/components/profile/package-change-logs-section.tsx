import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Every insert into package_change_logs (see syncPackageAssignment in
// players/actions.ts) is one row here: the initial package assignment at
// player creation, plus every later change from Edit Player / the Parent
// Profile tab. old_package_name/old_amount are null on that first row since
// there's nothing to compare against yet.
export async function PackageChangeLogsSection({ playerId }: { playerId: string }) {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("package_change_logs")
    .select("id, old_package_name, old_amount, new_package_name, new_amount, created_at, profiles(full_name)")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Logs</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Changed From</TableHead>
            <TableHead>Changed To</TableHead>
            <TableHead>Changed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(logs ?? []).map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
              <TableCell>
                {log.old_package_name ? `${log.old_package_name} — ${log.old_amount}` : "—"}
              </TableCell>
              <TableCell>
                {log.new_package_name ? `${log.new_package_name} — ${log.new_amount}` : "—"}
              </TableCell>
              <TableCell>{log.profiles?.full_name ?? "—"}</TableCell>
            </TableRow>
          ))}
          {(logs ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState icon={History} title="No package changes logged yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
