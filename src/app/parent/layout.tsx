import { requireRole } from "@/lib/auth/dal";
import { buildGreeting } from "@/lib/greeting";
import { AppShell } from "@/components/shell/app-shell";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("parent");

  const { title, dateLine } = buildGreeting(profile.full_name || "there");

  return (
    <AppShell
      navKey="parent"
      roleLabel="Parent"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
      greetingTitle={title}
      greetingDateLine={dateLine}
    >
      {children}
    </AppShell>
  );
}
