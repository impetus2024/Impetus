import { requireRole } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_ITEMS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/batches", label: "Training Batch" },
  { href: "/coach/attendance", label: "Attendance" },
  { href: "/coach/injuries", label: "Injuries" },
];

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("coach");

  return (
    <DashboardShell
      title="Coach"
      userName={profile.full_name || profile.email}
      navItems={NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
