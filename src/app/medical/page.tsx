import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function MedicalDashboard() {
  const medical = await requireRole("medical");
  const supabase = await createClient();
  const centreId = medical.centre_id!;

  const [players, totalInjuries, recentInjuries] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .eq("is_active", true),
    supabase
      .from("injuries")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId),
    supabase
      .from("injuries")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .gte("date_of_injury", daysAgoISO(30)),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Players" value={players.count ?? 0} />
        <StatCard label="Total Injury Reports" value={totalInjuries.count ?? 0} />
        <StatCard label="Injuries (Last 30 Days)" value={recentInjuries.count ?? 0} />
      </div>
    </div>
  );
}
