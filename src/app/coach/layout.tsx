import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildGreeting } from "@/lib/greeting";
import { getOwnAvatarUrl } from "@/lib/staff/avatar";
import { AppShell } from "@/components/shell/app-shell";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("coach");

  const supabase = await createClient();
  const { count } = await supabase
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("head_coach_id", profile.id)
    .eq("is_active", true);

  const { title, dateLine } = buildGreeting(
    profile.full_name || "coach",
    `${count ?? 0} assigned batches`
  );
  const avatarUrl = await getOwnAvatarUrl(profile.id);

  return (
    <AppShell
      navKey="coach"
      roleLabel="Coach"
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
