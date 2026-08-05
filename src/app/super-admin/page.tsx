import { Users, CalendarCheck, UserCog, DoorOpen, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/stat-card";
import { InsightBanner } from "@/components/insight-banner";
import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MonthlyHighlightsFeed } from "@/components/monthly-highlights/monthly-highlights-feed";
import { NewsEventsFeed } from "@/components/news-events/news-events-feed";
import { getLastNMonths, monthKeyOf } from "@/lib/months";
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
  await requireRole("super_admin");
  const { centreId } = await searchParams;
  const supabase = await createClient();

  const [{ data: centres }, { data: adminLinks }] = await Promise.all([
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("profiles").select("centre_id").eq("role", "centre_admin").eq("is_active", true),
  ]);

  const selectedCentreId = centreId || centres?.[0]?.id;
  const centresWithAdmin = new Set((adminLinks ?? []).map((a) => a.centre_id));
  const centresWithoutAdmin = (centres ?? []).filter((c) => !centresWithAdmin.has(c.id));

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col space-y-6 sm:min-h-[calc(100dvh-7rem)] lg:min-h-[calc(100dvh-8rem)]">
      <div className="flex justify-end">
        <CentreSelect centres={centres ?? []} selectedId={selectedCentreId} />
      </div>

      {centresWithoutAdmin.length > 0 ? (
        <InsightBanner
          tone="warning"
          title={`${centresWithoutAdmin.length} centre${centresWithoutAdmin.length > 1 ? "s" : ""} without an admin`}
          message={centresWithoutAdmin.map((c) => c.name).join(", ")}
          action={{ href: "/super-admin/centres", label: "Invite admin" }}
        />
      ) : (
        <InsightBanner
          tone="good"
          title="All centres are staffed"
          message="Every centre has at least one active Centre Admin."
        />
      )}

      {selectedCentreId ? (
        <CentreMetrics centreId={selectedCentreId} />
      ) : (
        <p className="text-muted-foreground">No centres yet — create one to get started.</p>
      )}
    </div>
  );
}

async function CentreMetrics({ centreId }: { centreId: string }) {
  const supabase = await createClient();
  const months = getLastNMonths(6);

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
      .select("amount, payment_date")
      .eq("centre_id", centreId)
      .gte("payment_date", months[0].start.toISOString().slice(0, 10)),
  ]);

  const paymentsThisMonth = (payments.data ?? [])
    .filter((p) => p.payment_date >= monthStartISO())
    .reduce((sum, p) => sum + p.amount, 0);

  const paymentsByMonth = months.map((m) => ({
    label: m.label,
    value: (payments.data ?? [])
      .filter((p) => monthKeyOf(p.payment_date) === m.key)
      .reduce((sum, p) => sum + p.amount, 0),
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Players" value={players.count ?? 0} icon={Users} />
        <StatCard label="Active Batches" value={batches.count ?? 0} icon={CalendarCheck} />
        <StatCard label="Staff" value={staff.count ?? 0} icon={UserCog} />
        <StatCard label="Checked In Now" value={checkedIn.count ?? 0} icon={DoorOpen} />
        <StatCard label="Payments This Month" value={paymentsThisMonth.toFixed(0)} icon={Wallet} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <NewsEventsFeed centreId={centreId} />
        <MonthlyHighlightsFeed centreId={centreId} />
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
    </>
  );
}
