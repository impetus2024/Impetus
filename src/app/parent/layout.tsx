import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("parent");

  return (
    <AppShell
      navKey="parent"
      roleLabel="Parent"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
