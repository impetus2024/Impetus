import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("coach");

  return (
    <AppShell
      navKey="coach"
      roleLabel="Coach"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
