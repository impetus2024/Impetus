import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CoachDashboard() {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("id")
    .eq("head_coach_id", coach.id)
    .eq("is_active", true);

  const batchIds = (batches ?? []).map((b) => b.id);

  const { data: batchPlayers } = batchIds.length
    ? await supabase
        .from("players")
        .select("id")
        .in("batch_id", batchIds)
        .eq("is_active", true)
    : { data: [] as { id: string }[] };

  const playerIds = (batchPlayers ?? []).map((p) => p.id);

  const [todayAttendance, injuries] = await Promise.all([
    batchIds.length
      ? supabase
          .from("attendance")
          .select("status")
          .in("batch_id", batchIds)
          .eq("attendance_date", todayISO())
      : Promise.resolve({ data: [] as { status: string }[] }),
    playerIds.length
      ? supabase
          .from("injuries")
          .select("id", { count: "exact", head: true })
          .in("player_id", playerIds)
      : Promise.resolve({ count: 0 }),
  ]);

  const presentToday = (todayAttendance.data ?? []).filter(
    (a) => a.status === "present"
  ).length;
  const absentToday = (todayAttendance.data ?? []).filter(
    (a) => a.status === "absent"
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Assigned Batches" value={batchIds.length} />
        <StatCard label="Total Players" value={playerIds.length} />
        <StatCard label="Present Today" value={presentToday} />
        <StatCard label="Absent Today" value={absentToday} />
        <StatCard label="Injury Reports" value={injuries.count ?? 0} />
      </div>
    </div>
  );
}
