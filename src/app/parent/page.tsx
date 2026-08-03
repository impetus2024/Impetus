import { CalendarCheck, DoorOpen, ClipboardCheck, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { getFiveSCurrentScores } from "@/lib/five-s/scores";
import { StatCard } from "@/components/stat-card";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceCalendar } from "@/components/profile/attendance-calendar";
import { FIVE_S_RADAR_AXES } from "@/components/profile/five-s-radar-section";
import { FiveSPerformanceOverview } from "@/components/profile/five-s-performance-overview";
import { ChildSelect } from "./child-select";

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string; month?: string }>;
}) {
  const parent = await requireRole("parent");
  const { playerId, month } = await searchParams;

  const children = await getParentChildren(parent.id);
  const selectedId = playerId || children[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardGreeting name={parent.full_name || "there"} />
        <ChildSelect options={children} selectedId={selectedId} basePath="/parent" />
      </div>

      {children.length === 0 ? (
        <InsightBanner
          tone="warning"
          title="No children linked yet"
          message="Once your centre adds your child as a player, they'll appear here automatically."
        />
      ) : selectedId ? (
        <>
          <ChildMetrics playerId={selectedId} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Card className="flex flex-col rounded-2xl border-border/70 shadow-card">
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <AttendanceCalendar
                  playerId={selectedId}
                  month={month}
                  basePath={`/parent?playerId=${selectedId}`}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-card">
              <CardContent>
                <FiveSDashboardCard playerId={selectedId} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

async function FiveSDashboardCard({ playerId }: { playerId: string }) {
  const scores = await getFiveSCurrentScores(
    playerId,
    FIVE_S_RADAR_AXES.map((a) => a.key)
  );

  return <FiveSPerformanceOverview scores={scores} />;
}

async function ChildMetrics({ playerId }: { playerId: string }) {
  const supabase = await createClient();

  // RLS-scoped: only resolves if this player is actually linked to the
  // signed-in parent (see the "parents view own children" policy).
  const { data: player } = await supabase
    .from("players")
    .select("name, is_checked_in, batch_id")
    .eq("id", playerId)
    .maybeSingle();

  const [attendance, lastPayment, batch] = await Promise.all([
    supabase
      .from("attendance")
      .select("status")
      .eq("player_id", playerId)
      .order("attendance_date", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select("amount, payment_date")
      .eq("player_id", playerId)
      .order("payment_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // batches has no RLS policy for the parent role — adding one that
    // subqueries players would recreate the same policy cycle documented
    // on parent_player_links ("coach views players in own batches" already
    // subqueries batches, so batches subquerying players back is circular).
    // We already confirmed above (via RLS) that this player belongs to
    // this parent, so a narrow admin-client lookup of just the batch name
    // is safe and avoids that cycle entirely.
    player?.batch_id
      ? createAdminClient().from("batches").select("name").eq("id", player.batch_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const presentCount = (attendance.data ?? []).filter((a) => a.status === "present").length;
  const totalSessions = attendance.data?.length ?? 0;
  const batchName = batch.data?.name ?? null;

  return (
    <>
      <InsightBanner
        tone={player?.is_checked_in ? "good" : "info"}
        title={player?.name ?? "Player"}
        message={
          player?.is_checked_in
            ? "Currently checked in at the centre."
            : `Batch: ${batchName ?? "Not assigned yet"}`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Batch" value={batchName ?? "—"} icon={CalendarCheck} />
        <StatCard
          label="Gate Status"
          value={player?.is_checked_in ? "Checked In" : "Checked Out"}
          icon={DoorOpen}
        />
        <StatCard
          label="Attendance (Last 5)"
          value={`${presentCount}/${totalSessions}`}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Last Payment"
          value={lastPayment.data ? lastPayment.data.amount : "—"}
          icon={Wallet}
        />
      </div>
    </>
  );
}
