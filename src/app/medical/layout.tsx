import { requireRole } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_ITEMS = [
  { href: "/medical", label: "Dashboard" },
  { href: "/medical/injuries", label: "Injuries" },
];

export default async function MedicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("medical");

  return (
    <DashboardShell
      title="Medical"
      userName={profile.full_name || profile.email}
      navItems={NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
