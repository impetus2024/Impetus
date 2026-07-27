import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function CentreAdminDashboard() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();
  const centreId = centreAdmin.centre_id!;

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Players" value={players.count ?? 0} />
        <StatCard label="Active Batches" value={batches.count ?? 0} />
        <StatCard label="Staff" value={staff.count ?? 0} />
        <StatCard label="Currently Checked In" value={checkedIn.count ?? 0} />
        <StatCard label="Payments This Month" value={paymentsTotal.toFixed(2)} />
      </div>
    </div>
  );
}
