import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { getParentChildren } from "@/lib/parent/children";
import { StatCard } from "@/components/stat-card";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <ChildSelect options={children} selectedId={selectedId} basePath="/parent" />
      </div>

      {selectedId ? (
        <ChildMetrics playerId={selectedId} />
      ) : (
        <p className="text-muted-foreground">No children linked to your account yet.</p>
      )}
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Batch" value={player?.batches?.name ?? "—"} />
      <StatCard label="Gate Status" value={player?.is_checked_in ? "Checked In" : "Checked Out"} />
      <StatCard label="Present (Last 5 Sessions)" value={`${presentCount}/${attendance.data?.length ?? 0}`} />
      <StatCard
        label="Last Payment"
        value={lastPayment.data ? `${lastPayment.data.amount} on ${lastPayment.data.payment_date}` : "—"}
      />
    </div>
  );
}
