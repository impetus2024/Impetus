import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AttendanceMarkForm } from "./attendance-mark-form";
import { markAttendance } from "../actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CoachBatchAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { batchId } = await params;
  const { date } = await searchParams;
  const selectedDate = date || todayISO();

  const coach = await requireRole("coach");
  const supabase = await createClient();

  // batch/players/existing/recentDates only depend on batchId + selectedDate
  // (both already known from params/searchParams) — not on each other's
  // results — so they run as one round trip instead of four sequential
  // ones. Only last5Records genuinely depends on recentDates and stays
  // after. The authorization check (`if (!batch) notFound()`) still runs
  // before anything renders; on the rare unauthorized-batchId request the
  // other three just fetch data that gets discarded.
  const [{ data: batch }, { data: players }, { data: existing }, { data: recentDates }] =
    await Promise.all([
      supabase
        .from("batches")
        .select("id, name")
        .eq("id", batchId)
        .or(coachBatchFilter(coach.id))
        .maybeSingle(),
      supabase
        .from("players")
        .select("id, name, player_batches!inner(batch_id)")
        .eq("player_batches.batch_id", batchId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("attendance")
        .select("player_id, status")
        .eq("batch_id", batchId)
        .eq("attendance_date", selectedDate),
      supabase
        .from("attendance")
        .select("attendance_date")
        .eq("batch_id", batchId)
        .order("attendance_date", { ascending: false })
        .limit(200),
    ]);

  if (!batch) notFound();

  const playerList = players ?? [];

  const defaultStatuses = Object.fromEntries(
    (existing ?? []).map((a) => [a.player_id, a.status])
  ) as Record<string, "present" | "absent">;

  const last5Dates = [...new Set((recentDates ?? []).map((r) => r.attendance_date))].slice(0, 5);

  const { data: last5Records } = last5Dates.length
    ? await supabase
        .from("attendance")
        .select("player_id, attendance_date, status")
        .eq("batch_id", batchId)
        .in("attendance_date", last5Dates)
    : { data: [] as { player_id: string; attendance_date: string; status: string }[] };

  const matrix = new Map<string, Map<string, string>>();
  for (const rec of last5Records ?? []) {
    if (!matrix.has(rec.player_id)) matrix.set(rec.player_id, new Map());
    matrix.get(rec.player_id)!.set(rec.attendance_date, rec.status);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{batch.name} — Attendance</h1>

      <AttendanceMarkForm
        players={playerList}
        date={selectedDate}
        defaultStatuses={defaultStatuses}
        action={markAttendance.bind(null, batchId)}
      />

      {last5Dates.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Previous 5 Days</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                {last5Dates.map((d) => (
                  <TableHead key={d}>{d}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerList.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  {last5Dates.map((d) => {
                    const status = matrix.get(p.id)?.get(d);
                    return (
                      <TableCell key={d}>
                        {status ? (
                          <Badge variant={status === "present" ? "default" : "destructive"}>
                            {status === "present" ? "P" : "A"}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
