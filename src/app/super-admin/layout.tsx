import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("super_admin");

  return (
    <AppShell
      navKey="super-admin"
      roleLabel="Super Admin"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
