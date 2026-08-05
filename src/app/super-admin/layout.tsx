import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildGreeting } from "@/lib/greeting";
import { AppShell } from "@/components/shell/app-shell";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("super_admin");

  const supabase = await createClient();
  const { count } = await supabase.from("centres").select("id", { count: "exact", head: true });

  const { title, dateLine } = buildGreeting(profile.full_name || "there", `${count ?? 0} centres`);

  return (
    <AppShell
      navKey="super-admin"
      roleLabel="Super Admin"
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
      greetingTitle={title}
      greetingDateLine={dateLine}
    >
      {children}
    </AppShell>
  );
}
