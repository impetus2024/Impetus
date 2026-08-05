import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CentreSelect } from "../centre-select";
import {
  EmailAnalyticsDashboard,
  type EmailAnalyticsSearchParams,
} from "@/components/email-analytics/email-analytics-dashboard";

// super_admin picks which centre to view, same "existing permission model"
// as the main super-admin dashboard (src/app/super-admin/page.tsx) — RLS's
// "super_admin full access to email_logs" policy is what actually grants
// cross-centre access; centreId here just says *which* centre to look at
// this load, the same way it already works there.
export default async function SuperAdminEmailAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<EmailAnalyticsSearchParams & { centreId?: string }>;
}) {
  await requireRole("super_admin");
  const { centreId, ...rest } = await searchParams;
  const supabase = await createClient();

  const { data: centres } = await supabase.from("centres").select("id, name").order("name");
  const selectedCentreId = centreId || centres?.[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Email Analytics</h1>
        <CentreSelect centres={centres ?? []} selectedId={selectedCentreId} />
      </div>

      {selectedCentreId ? (
        <EmailAnalyticsDashboard
          centreId={selectedCentreId}
          searchParams={rest}
          detailBasePath="/super-admin/email-analytics"
        />
      ) : (
        <p className="text-muted-foreground">No centres yet — create one to get started.</p>
      )}
    </div>
  );
}
