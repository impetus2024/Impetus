import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function MedicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("medical");

  return (
    <AppShell
      navKey="medical"
      roleLabel="Medical"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
