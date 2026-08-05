import { Users, HeartPulse, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";
import { InsightBanner } from "@/components/insight-banner";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MonthlyHighlightsFeed } from "@/components/monthly-highlights/monthly-highlights-feed";
import { NewsEventsFeed } from "@/components/news-events/news-events-feed";
import { getLastNMonths, monthKeyOf } from "@/lib/months";

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function MedicalDashboard() {
  const medical = await requireRole("medical");
  const supabase = await createClient();
  const centreId = medical.centre_id!;
  const months = getLastNMonths(6);

  const [players, totalInjuries, recentInjuries, injuryDates] = await Promise.all([
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
    supabase
      .from("injuries")
      .select("date_of_injury")
      .eq("centre_id", centreId)
      .gte("date_of_injury", months[0].start.toISOString().slice(0, 10)),
  ]);

  const injuriesByMonth = months.map((m) => ({
    label: m.label,
    value: (injuryDates.data ?? []).filter((r) => monthKeyOf(r.date_of_injury) === m.key).length,
  }));

  const recentCount = recentInjuries.count ?? 0;

  return (
    <div className="space-y-6">
      {recentCount > 0 ? (
        <InsightBanner
          tone="warning"
          title={`${recentCount} injury report${recentCount > 1 ? "s" : ""} in the last 30 days`}
          message="Review recent reports to follow up on player recovery."
          action={{ href: "/medical/injuries", label: "View injuries" }}
        />
      ) : (
        <InsightBanner tone="good" title="No recent injuries" message="No injury reports in the last 30 days." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Players" value={players.count ?? 0} icon={Users} />
        <StatCard label="Total Injury Reports" value={totalInjuries.count ?? 0} icon={HeartPulse} />
        <StatCard label="Last 30 Days" value={recentCount} icon={Activity} />
      </div>

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Injury Reports</CardTitle>
          <CardDescription>Reported per month, last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={injuriesByMonth} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NewsEventsFeed />
        <MonthlyHighlightsFeed />
      </div>
    </div>
  );
}
