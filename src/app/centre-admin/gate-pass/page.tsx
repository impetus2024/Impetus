import { DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ListSearch } from "@/components/list-search";
import { ListFilter } from "@/components/list-filter";
import { DateRangeFilter } from "@/components/date-range-filter";
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
import { AddGatePassDialog } from "./add-gate-pass-dialog";
import { GatePassDetailsDialog, type GatePassEntry } from "./gate-pass-details-dialog";

type LogRow = {
  id: string;
  action: "check_in" | "check_out";
  reason: string;
  created_at: string;
  player_id: string;
  players: { name: string } | null;
  profiles: { full_name: string } | null;
};

type Session = {
  key: string;
  playerName: string;
  checkIn: GatePassEntry | null;
  checkOut: GatePassEntry | null;
};

function toEntry(log: LogRow): GatePassEntry {
  return { time: log.created_at, reason: log.reason, by: log.profiles?.full_name ?? null };
}

// Each gate_pass_logs row is a single action; a "visit" is a check_in
// paired with the check_out that follows it. createGatePassEntry always
// alternates check_in/check_out per player (based on is_checked_in), so
// walking each player's own log history in chronological order and pairing
// consecutive check_in -> check_out is reliable. A trailing check_in with
// no check_out yet (player still on-site) renders as an open session.
function pairSessions(logsAscending: LogRow[]): Session[] {
  const byPlayer = new Map<string, LogRow[]>();
  for (const log of logsAscending) {
    const list = byPlayer.get(log.player_id) ?? [];
    list.push(log);
    byPlayer.set(log.player_id, list);
  }

  const sessions: Session[] = [];
  for (const logs of byPlayer.values()) {
    const playerName = logs[0].players?.name ?? "—";
    let pendingCheckIn: LogRow | null = null;

    for (const log of logs) {
      if (log.action === "check_in") {
        if (pendingCheckIn) {
          sessions.push({ key: pendingCheckIn.id, playerName, checkIn: toEntry(pendingCheckIn), checkOut: null });
        }
        pendingCheckIn = log;
      } else {
        if (pendingCheckIn) {
          sessions.push({ key: pendingCheckIn.id, playerName, checkIn: toEntry(pendingCheckIn), checkOut: toEntry(log) });
          pendingCheckIn = null;
        } else {
          sessions.push({ key: log.id, playerName, checkIn: null, checkOut: toEntry(log) });
        }
      }
    }
    if (pendingCheckIn) {
      sessions.push({ key: pendingCheckIn.id, playerName, checkIn: toEntry(pendingCheckIn), checkOut: null });
    }
  }

  return sessions;
}

export default async function GatePassPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; page?: string }>;
}) {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const { q, status, from, to, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const page = parsePageParam(pageParam);

  // Default to the last 30 days when the user hasn't picked a range —
  // without this, every load of this page (the common case) scanned the
  // centre's entire gate pass history. An explicit `from` still overrides
  // it for anyone who wants to look further back.
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const effectiveFrom = from || defaultFrom.toISOString().slice(0, 10);

  let query = supabase
    .from("gate_pass_logs")
    .select(
      "id, action, reason, created_at, player_id, players!inner(name), profiles!gate_pass_logs_performed_by_fkey(full_name)"
    )
    .eq("centre_id", centreAdmin.centre_id!);

  if (q) query = query.ilike("players.name", `%${q}%`);
  query = query.gte("created_at", `${effectiveFrom}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const [{ data: rawLogs }, { data: players }] = await Promise.all([
    // Ascending + a generous cap so pairing sees each player's actions in
    // order; the final session list (below) is what actually gets paginated
    // for display.
    query.order("created_at", { ascending: true }).limit(1000),
    supabase
      .from("players")
      .select("id, name, is_checked_in")
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("is_active", true)
      .order("name"),
  ]);

  let sessions = pairSessions(rawLogs ?? []);
  if (status === "open") sessions = sessions.filter((s) => s.checkOut === null);
  if (status === "completed") sessions = sessions.filter((s) => s.checkOut !== null);

  sessions.sort((a, b) => {
    const aTime = a.checkIn?.time ?? a.checkOut?.time ?? "";
    const bTime = b.checkIn?.time ?? b.checkOut?.time ?? "";
    return bTime.localeCompare(aTime);
  });

  // Sessions are paired in memory from raw log rows (a "session" doesn't map
  // 1:1 to a DB row, so this can't be a .range() query like other list
  // pages) — paginate the already-computed, already-filtered array instead
  // of dumping up to ~500 rows into the DOM at once.
  const [rangeFrom, rangeTo] = pageRange(page);
  const pagedSessions = sessions.slice(rangeFrom, rangeTo + 1);

  const hasFilters = Boolean(q || status || from || to);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Movement Pass</h1>
        {canEdit && <AddGatePassDialog players={players ?? []} />}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ListSearch placeholder="Search by player..." />
        <ListFilter
          paramKey="status"
          label="All visits"
          options={[
            { id: "open", name: "Checked In" },
            { id: "completed", name: "Checked Out" },
          ]}
        />
        <DateRangeFilter />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedSessions.map((s) => (
            <TableRow key={s.key}>
              <TableCell>{s.playerName}</TableCell>
              <TableCell>{s.checkIn ? new Date(s.checkIn.time).toLocaleString() : "—"}</TableCell>
              <TableCell>
                {s.checkOut ? (
                  new Date(s.checkOut.time).toLocaleString()
                ) : (
                  <Badge variant="default">Checked In</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <GatePassDetailsDialog playerName={s.playerName} checkIn={s.checkIn} checkOut={s.checkOut} />
              </TableCell>
            </TableRow>
          ))}
          {sessions.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                {hasFilters ? (
                  <EmptyState icon={DoorOpen} title="No entries match your search" message="Try a different name or clear the filters." />
                ) : (
                  <EmptyState icon={DoorOpen} title="No movement pass entries yet" />
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ListPagination page={page} totalPages={computeTotalPages(sessions.length)} />
    </div>
  );
}
