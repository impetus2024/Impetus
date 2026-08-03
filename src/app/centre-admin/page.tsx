import Link from "next/link";
import {
  Users,
  CalendarCheck,
  UserCog,
  DoorOpen,
  Wallet,
  UserPlus,
  CalendarPlus,
  ReceiptText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";
import { DashboardGreeting } from "@/components/dashboard-greeting";
import { InsightBanner } from "@/components/insight-banner";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLastNMonths, monthKeyOf } from "@/lib/months";

const QUICK_ACTIONS = [
  { href: "/centre-admin/players/new", label: "Add Player", icon: UserPlus },
  { href: "/centre-admin/batches", label: "Add Batch", icon: CalendarPlus },
  { href: "/centre-admin/gate-pass", label: "Gate Pass", icon: DoorOpen },
  { href: "/centre-admin/payments", label: "Record Payment", icon: ReceiptText },
];

export default async function CentreAdminDashboard() {
  const centreAdmin = await requireRole("centre_admin");
  const supabase = await createClient();
  const centreId = centreAdmin.centre_id!;

  const months = getLastNMonths(6);

  const [centre, players, batches, staff, checkedIn, paymentsByMonthRows, recentGatePass] =
    await Promise.all([
      supabase.from("centres").select("name").eq("id", centreId).maybeSingle(),
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
      // Grouped in SQL (see payments_by_month's migration) instead of
      // pulling every payment row for the window and summing it per month
      // in JS.
      supabase.rpc("payments_by_month", {
        p_centre_id: centreId,
        p_since: months[0].start.toISOString().slice(0, 10),
      }),
      supabase
        .from("gate_pass_logs")
        .select("action, reason, created_at, players(name)")
        .eq("centre_id", centreId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const totalByMonthKey = new Map(
    (paymentsByMonthRows.data ?? []).map((row) => [monthKeyOf(row.month), row.total])
  );

  const paymentsByMonth = months.map((m) => ({
    label: m.label,
    value: totalByMonthKey.get(m.key) ?? 0,
  }));

  // months' last entry is always the current month (see getLastNMonths).
  const paymentsThisMonth = paymentsByMonth[paymentsByMonth.length - 1]?.value ?? 0;

  const playerCount = players.count ?? 0;
  const batchCount = batches.count ?? 0;
  const staffCount = staff.count ?? 0;

  return (
    <div className="space-y-6">
      <DashboardGreeting name={centreAdmin.full_name || "there"} subtitle={centre.data?.name} />

      {batchCount === 0 ? (
        <InsightBanner
          tone="warning"
          title="No batches yet"
          message="Create your first training batch to start scheduling and taking attendance."
          action={{ href: "/centre-admin/batches", label: "Create batch" }}
        />
      ) : playerCount === 0 ? (
        <InsightBanner
          tone="warning"
          title="No players yet"
          message="Add your first player to start managing registrations and gate pass."
          action={{ href: "/centre-admin/players/new", label: "Add player" }}
        />
      ) : (
        <InsightBanner
          tone="good"
          title="Everything's on track"
          message={`${playerCount} active players across ${batchCount} batches, run by ${staffCount} staff.`}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Players" value={playerCount} icon={Users} />
        <StatCard label="Active Batches" value={batchCount} icon={CalendarCheck} />
        <StatCard label="Staff" value={staffCount} icon={UserCog} />
        <StatCard label="Checked In Now" value={checkedIn.count ?? 0} icon={DoorOpen} />
        <StatCard label="Payments This Month" value={paymentsThisMonth.toFixed(0)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border/70 shadow-card lg:col-span-3">
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Collected per month, last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={paymentsByMonth} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest gate pass entries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {(recentGatePass.data ?? []).map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{log.players?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{log.reason}</p>
                </div>
                <span
                  className={
                    log.action === "check_in"
                      ? "shrink-0 text-xs font-medium text-status-good"
                      : "shrink-0 text-xs font-medium text-muted-foreground"
                  }
                >
                  {log.action === "check_in" ? "Checked in" : "Checked out"}
                </span>
              </div>
            ))}
            {(recentGatePass.data ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No gate pass activity yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto flex-col gap-2 rounded-xl px-5 py-4"
              render={
                <Link href={action.href}>
                  <action.icon className="size-5 text-primary" />
                  <span className="text-xs font-medium">{action.label}</span>
                </Link>
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
