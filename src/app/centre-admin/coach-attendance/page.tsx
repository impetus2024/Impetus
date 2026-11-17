import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { MONTH_NAMES, monthParam, parseMonthParam, toDateKey } from "@/lib/calendar-grid";
import { getFiveSWindowStatus } from "@/lib/five-s/testing-window";
import { fetchAllRows, getFiveSCompletePlayerIds } from "@/lib/five-s/completion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DOT = {
  green: "bg-status-good",
  orange: "bg-status-serious",
  red: "bg-status-critical",
  grey: "bg-muted-foreground/40",
} as const;

type FiveSDot = { color: keyof typeof DOT; label: string };

const shortDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default async function CoachAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const supabase = await createClient();
  const centreId = centreAdmin.centre_id!;

  const [{ data: coaches }, { data: batches }, { data: centre }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("centre_id", centreId)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("batches")
      .select("id, name, head_coach_id, assistant_coach_id")
      .eq("centre_id", centreId)
      .eq("is_active", true),
    supabase.from("centres").select("five_s_window_start, five_s_window_end").eq("id", centreId).single(),
  ]);

  // ── Dates ──
  const { year, month: monthIdx } = parseMonthParam(month);
  const today = new Date();
  const todayKey = toDateKey(today);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(year, monthIdx, i + 1)));
  const countedDays = monthDays.filter((d) => d <= todayKey); // future days can't be missed yet
  const last7 = Array.from({ length: 7 }, (_, i) => toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i)));
  const rangeStart = [monthDays[0], last7[0]].sort()[0];
  const rangeEnd = [monthDays[monthDays.length - 1], todayKey].sort().reverse()[0];

  // ── Attendance: a coach "attended" a day if attendance was marked for any of their batches ──
  const batchList = batches ?? [];
  const batchIds = batchList.map((b) => b.id);
  const records = batchIds.length
    ? await fetchAllRows<{ batch_id: string; attendance_date: string }>((from, to) =>
        supabase
          .from("attendance")
          .select("batch_id, attendance_date")
          .in("batch_id", batchIds)
          .gte("attendance_date", rangeStart)
          .lte("attendance_date", rangeEnd)
          .order("id")
          .range(from, to)
      )
    : [];
  const datesByBatch = new Map<string, Set<string>>();
  for (const r of records) {
    if (!datesByBatch.has(r.batch_id)) datesByBatch.set(r.batch_id, new Set());
    datesByBatch.get(r.batch_id)!.add(r.attendance_date);
  }

  // ── 5S completion per coach across all their batches' players ──
  const { data: links } = batchIds.length
    ? { data: await fetchAllRows<{ batch_id: string; player_id: string }>((from, to) =>
        supabase
          .from("player_batches")
          .select("batch_id, player_id, players!inner(is_active)")
          .in("batch_id", batchIds)
          .eq("players.is_active", true)
          .order("player_id")
          .range(from, to)
      ) }
    : { data: [] };
  const playersByBatch = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (!playersByBatch.has(l.batch_id)) playersByBatch.set(l.batch_id, []);
    playersByBatch.get(l.batch_id)!.push(l.player_id);
  }
  const allPlayerIds = [...new Set((links ?? []).map((l) => l.player_id))];
  const windowStart = centre?.five_s_window_start ?? null;
  const windowStatus = getFiveSWindowStatus(windowStart, centre?.five_s_window_end ?? null);
  const completePlayers = await getFiveSCompletePlayerIds(allPlayerIds, windowStart);

  function fiveSDot(playerIds: string[]): FiveSDot {
    if (windowStatus.status === "none") return { color: "grey", label: "No 5S window set" };
    if (windowStatus.status === "upcoming") return { color: "grey", label: `5S opens ${shortDate(windowStatus.start)}` };
    if (playerIds.length === 0) return { color: "grey", label: "No players" };
    const done = playerIds.filter((id) => completePlayers.has(id)).length;
    const progress = `${done}/${playerIds.length} players`;
    if (done === playerIds.length) return { color: "green", label: `5S complete — ${progress}` };
    if (windowStatus.status === "open") return { color: "orange", label: `5S in progress — ${progress}` };
    return { color: "red", label: `5S incomplete after ${shortDate(windowStatus.end)} — ${progress}` };
  }

  const rows = (coaches ?? []).map((coach) => {
    const mine = batchList.filter((b) => b.head_coach_id === coach.id || b.assistant_coach_id === coach.id);
    const isHead = mine.some((b) => b.head_coach_id === coach.id);
    const attended = new Set<string>();
    for (const b of mine) for (const d of datesByBatch.get(b.id) ?? []) attended.add(d);
    const playerIds = [...new Set(mine.flatMap((b) => playersByBatch.get(b.id) ?? []))];
    return {
      coach,
      role: isHead ? "Head Coach" : mine.length > 0 ? "Assistant Coach" : "Coach",
      totalAttended: countedDays.filter((d) => attended.has(d)).length,
      last7: last7.map((d) => ({ date: d, attended: attended.has(d) })),
      dot: fiveSDot(playerIds),
    };
  });

  const basePath = "/centre-admin/coach-attendance";
  const navBtn = cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full bg-card shadow-sm hover:bg-muted");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Coach Attendance</h1>
        <div className="flex items-center gap-2">
          <Link href={`${basePath}?month=${monthParam(year, monthIdx - 1)}`} className={navBtn}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous month</span>
          </Link>
          <span className="min-w-32 text-center text-sm font-medium">
            {MONTH_NAMES[monthIdx]} {year}
          </span>
          <Link href={`${basePath}?month=${monthParam(year, monthIdx + 1)}`} className={navBtn}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Next month</span>
          </Link>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coach</TableHead>
            <TableHead className="text-center">5S</TableHead>
            <TableHead className="text-center">Days in Month</TableHead>
            <TableHead className="text-center">Total Attendance</TableHead>
            <TableHead>Last 7 Days</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ coach, role, totalAttended, last7: days, dot }) => (
            <TableRow key={coach.id}>
              <TableCell>
                <div className="font-medium">{coach.full_name}</div>
                <Badge variant="outline" className="mt-1">{role}</Badge>
              </TableCell>
              <TableCell>
                <span title={dot.label} className="flex justify-center">
                  <span className={cn("size-3.5 rounded-full", DOT[dot.color])} />
                  <span className="sr-only">{dot.label}</span>
                </span>
              </TableCell>
              <TableCell className="text-center tabular-nums">{daysInMonth}</TableCell>
              <TableCell className="text-center tabular-nums">
                {totalAttended} / {countedDays.length}
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  {days.map(({ date, attended }) => (
                    <span
                      key={date}
                      title={`${shortDate(date)}: ${attended ? "Present" : "Absent"}`}
                      className="flex flex-col items-center gap-0.5"
                    >
                      {attended ? (
                        <Check className="size-4 text-status-good" strokeWidth={3} />
                      ) : (
                        <X className="size-4 text-status-critical" strokeWidth={3} />
                      )}
                      <span className="text-[10px] text-muted-foreground tabular-nums">{date.slice(8)}</span>
                      <span className="sr-only">{attended ? "Present" : "Absent"}</span>
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`${basePath}/${coach.id}`}>View Attendance</Link>}
                />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState icon={Users} title="No coaches yet" message="Add a coach to see their attendance here." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">5S:</span>
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", DOT.green)} /> Complete for all players</span>
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", DOT.orange)} /> In progress (window open)</span>
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", DOT.red)} /> Incomplete after window closed</span>
        <span className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", DOT.grey)} /> No window / not opened yet</span>
      </div>
    </div>
  );
}
