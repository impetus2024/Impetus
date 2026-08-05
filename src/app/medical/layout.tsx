import { requireRole } from "@/lib/auth/dal";
import { buildGreeting } from "@/lib/greeting";
import { getOwnAvatarUrl } from "@/lib/staff/avatar";
import { AppShell } from "@/components/shell/app-shell";

export default async function MedicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("medical");

  const { title, dateLine } = buildGreeting(profile.full_name || "there");
  const avatarUrl = await getOwnAvatarUrl(profile.id);

  return (
    <AppShell
      navKey="medical"
      roleLabel="Medical"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
      userAvatarUrl={avatarUrl}
      greetingTitle={title}
      greetingDateLine={dateLine}
    >
      {children}
    </AppShell>
  );
}
