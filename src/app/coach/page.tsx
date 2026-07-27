import { CalendarCheck, Users, ClipboardCheck, ClipboardX, HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { InsightBanner } from "@/components/insight-banner";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const days: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
    });
  }
  return days;
}

export default async function CoachDashboard() {
  const coach = await requireRole("coach");
  const supabase = await createClient();
  const days = lastNDays(7);

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

  const [todayAttendance, injuries, weekAttendance] = await Promise.all([
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
    batchIds.length
      ? supabase
          .from("attendance")
          .select("status, attendance_date")
          .in("batch_id", batchIds)
          .gte("attendance_date", days[0].key)
      : Promise.resolve({ data: [] as { status: string; attendance_date: string }[] }),
  ]);

  const presentToday = (todayAttendance.data ?? []).filter((a) => a.status === "present").length;
  const absentToday = (todayAttendance.data ?? []).filter((a) => a.status === "absent").length;

  const presentByDay = days.map((d) => ({
    label: d.label,
    value: (weekAttendance.data ?? []).filter(
      (a) => a.attendance_date === d.key && a.status === "present"
    ).length,
  }));

  return (
    <div className="space-y-6">
      <DashboardGreeting name={coach.full_name || "coach"} subtitle={`${batchIds.length} assigned batches`} />

      {batchIds.length > 0 && presentToday + absentToday === 0 ? (
        <InsightBanner
          tone="warning"
          title="Attendance not marked today"
          message="Mark today's attendance for your batches before the session ends."
          action={{ href: "/coach/attendance", label: "Mark attendance" }}
        />
      ) : (
        <InsightBanner
          tone="good"
          title="You're on track"
          message={`${playerIds.length} players across ${batchIds.length} batches.`}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Assigned Batches" value={batchIds.length} icon={CalendarCheck} />
        <StatCard label="Total Players" value={playerIds.length} icon={Users} />
        <StatCard label="Present Today" value={presentToday} icon={ClipboardCheck} />
        <StatCard label="Absent Today" value={absentToday} icon={ClipboardX} />
        <StatCard label="Injury Reports" value={injuries.count ?? 0} icon={HeartPulse} />
      </div>

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>Players present per day, last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={presentByDay} highlightLabel={days[days.length - 1].label} />
        </CardContent>
      </Card>
    </div>
  );
}
