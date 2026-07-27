import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function CentreAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("centre_admin");

  return (
    <AppShell
      navKey="centre-admin"
      roleLabel="Centre Admin"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
