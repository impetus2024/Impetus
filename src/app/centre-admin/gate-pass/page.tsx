import { DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddGatePassDialog } from "./add-gate-pass-dialog";

const ACTION_LABEL: Record<string, string> = {
  check_in: "Check In",
  check_out: "Check Out",
};

export default async function GatePassPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin");
  const { q, action } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("gate_pass_logs")
    .select("id, action, reason, created_at, players!inner(name), profiles!gate_pass_logs_performed_by_fkey(full_name)")
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("players.name", `%${q}%`);
  if (action === "check_in" || action === "check_out") query = query.eq("action", action);

  const [{ data: logs }, { data: players }] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(200),
    supabase
      .from("players")
      .select("id, name, is_checked_in")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  const hasFilters = Boolean(q || action);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gate Pass</h1>
        <AddGatePassDialog players={players ?? []} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search by player..." />
        <ListFilter
          paramKey="action"
          label="All actions"
          options={[
            { id: "check_in", name: "Check In" },
            { id: "check_out", name: "Check Out" },
          ]}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>By</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.players?.name}</TableCell>
              <TableCell>
                <Badge variant={log.action === "check_in" ? "default" : "secondary"}>
                  {ACTION_LABEL[log.action]}
                </Badge>
              </TableCell>
              <TableCell>{log.reason}</TableCell>
              <TableCell>{log.profiles?.full_name}</TableCell>
              <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {logs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                {hasFilters ? (
                  <EmptyState icon={DoorOpen} title="No entries match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={DoorOpen} title="No gate pass entries yet" />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
