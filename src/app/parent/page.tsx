import { CalendarCheck, DoorOpen, ClipboardCheck, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { StatCard } from "@/components/stat-card";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { InsightBanner } from "@/components/insight-banner";
import { ChildSelect } from "./child-select";

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string }>;
}) {
  const parent = await requireRole("parent");
  const { playerId } = await searchParams;

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
        <ChildMetrics playerId={selectedId} />
      ) : null}
    </div>
  );
}

async function ChildMetrics({ playerId }: { playerId: string }) {
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("name, is_checked_in, batches(name)")
    .eq("id", playerId)
    .maybeSingle();

  const [attendance, lastPayment] = await Promise.all([
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
  ]);

  const presentCount = (attendance.data ?? []).filter((a) => a.status === "present").length;
  const totalSessions = attendance.data?.length ?? 0;

  return (
    <>
      <InsightBanner
        tone={player?.is_checked_in ? "good" : "info"}
        title={player?.name ?? "Player"}
        message={
          player?.is_checked_in
            ? "Currently checked in at the centre."
            : `Batch: ${player?.batches?.name ?? "Not assigned yet"}`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Batch" value={player?.batches?.name ?? "—"} icon={CalendarCheck} />
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
