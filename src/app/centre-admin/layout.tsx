import { requireRole } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_ITEMS = [
  { href: "/centre-admin", label: "Dashboard" },
  { href: "/centre-admin/gate-pass", label: "Gate Pass" },
  { href: "/centre-admin/batches", label: "Batch Management" },
  { href: "/centre-admin/players", label: "Player Management" },
  { href: "/centre-admin/player-types", label: "Player Type" },
  { href: "/centre-admin/administrators", label: "Administrator Management" },
  { href: "/centre-admin/payments", label: "Payment History" },
  { href: "/centre-admin/packages", label: "Package Management" },
];

export default async function CentreAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("centre_admin");

  return (
    <DashboardShell
      title="Centre Admin"
      userName={profile.full_name || profile.email}
      navItems={NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
