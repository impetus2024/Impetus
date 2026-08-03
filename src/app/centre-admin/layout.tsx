import { requireRole } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

const ROLE_LABEL = {
  centre_admin: "Centre Admin",
  staff: "Staff",
  finance: "Finance",
} as const;

export default async function CentreAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Staff/Finance share this entire route tree for viewing — read-only,
  // enforced by RLS (20260803* migrations) and by every mutating Server
  // Action still calling requireRole("centre_admin") alone, never these.
  const profile = await requireRole("centre_admin", "staff", "finance");

  return (
    <AppShell
      navKey="centre-admin"
      roleLabel={ROLE_LABEL[profile.role as keyof typeof ROLE_LABEL]}
      userName={profile.full_name || profile.email}
      userEmail={profile.email}
    >
      {children}
    </AppShell>
  );
}
