import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { CentreSelect } from "./centre-select";

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function SuperAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ centreId?: string }>;
}) {
  const { centreId } = await searchParams;
  const supabase = await createClient();

  const { data: centres } = await supabase
    .from("centres")
    .select("id, name")
    .order("name");

  const selectedCentreId = centreId || centres?.[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <CentreSelect centres={centres ?? []} selectedId={selectedCentreId} />
      </div>

      {selectedCentreId ? (
        <CentreMetrics centreId={selectedCentreId} />
      ) : (
        <p className="text-muted-foreground">No centres yet.</p>
      )}
    </div>
  );
}

async function CentreMetrics({ centreId }: { centreId: string }) {
  const supabase = await createClient();

  const [players, batches, staff, checkedIn, payments] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .eq("is_active", true),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .in("role", ["coach", "medical", "centre_admin"])
      .eq("is_active", true),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", centreId)
      .eq("is_checked_in", true),
    supabase
      .from("payments")
      .select("amount")
      .eq("centre_id", centreId)
      .gte("payment_date", monthStartISO()),
  ]);

  const paymentsTotal = (payments.data ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Active Players" value={players.count ?? 0} />
      <StatCard label="Active Batches" value={batches.count ?? 0} />
      <StatCard label="Staff" value={staff.count ?? 0} />
      <StatCard label="Currently Checked In" value={checkedIn.count ?? 0} />
      <StatCard label="Payments This Month" value={paymentsTotal.toFixed(2)} />
    </div>
  );
}
