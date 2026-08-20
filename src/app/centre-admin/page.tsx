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
import { InsightBanner } from "@/components/insight-banner";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthlyHighlightsFeed } from "@/components/monthly-highlights/monthly-highlights-feed";
import { NewsEventsFeed } from "@/components/news-events/news-events-feed";
import { getLastNMonths, monthKeyOf } from "@/lib/months";

const QUICK_ACTIONS = [
  { href: "/centre-admin/players/new", label: "Add Player", icon: UserPlus },
  { href: "/centre-admin/batches", label: "Add Batch", icon: CalendarPlus },
  { href: "/centre-admin/gate-pass", label: "Movement Pass", icon: DoorOpen },
  { href: "/centre-admin/payments", label: "Record Payment", icon: ReceiptText },
];

export default async function CentreAdminDashboard() {
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const canEdit = centreAdmin.role === "centre_admin";
  const supabase = await createClient();
  const centreId = centreAdmin.centre_id!;

  const months = getLastNMonths(6);

  const [players, batches, staff, checkedIn, paymentsByMonthRows] =
    await Promise.all([
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
        .in("role", ["coach", "medical", "centre_admin", "staff", "finance"])
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
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col space-y-6 sm:min-h-[calc(100dvh-7rem)] lg:min-h-[calc(100dvh-8rem)]">
      {batchCount === 0 ? (
        <InsightBanner
          tone="warning"
          title="No batches yet"
          message="Create your first training batch to start scheduling and taking attendance."
          action={canEdit ? { href: "/centre-admin/batches", label: "Create batch" } : undefined}
        />
      ) : playerCount === 0 ? (
        <InsightBanner
          tone="warning"
          title="No players yet"
          message="Add your first player to start managing registrations and movement pass."
          action={canEdit ? { href: "/centre-admin/players/new", label: "Add player" } : undefined}
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

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <NewsEventsFeed />
        <MonthlyHighlightsFeed />
      </div>

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Collected per month, last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={paymentsByMonth} />
        </CardContent>
      </Card>

      {canEdit && (
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
      )}
    </div>
  );
}
