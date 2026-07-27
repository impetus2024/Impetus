import { requireRole } from "@/lib/auth/dal";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_ITEMS = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/player", label: "Player" },
];

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("parent");

  return (
    <DashboardShell
      title="Parent"
      userName={profile.full_name || profile.email}
      navItems={NAV_ITEMS}
    >
      {children}
    </DashboardShell>
  );
}
