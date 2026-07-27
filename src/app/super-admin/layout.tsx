import { requireRole } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_ITEMS = [
  { href: "/super-admin", label: "Dashboard" },
  { href: "/super-admin/centres", label: "Centre Management" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("super_admin");

  return (
    <DashboardShell
      title="Super Admin"
      userName={profile.full_name || profile.email}
      navItems={NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
