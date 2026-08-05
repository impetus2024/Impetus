import { requireRole } from "@/lib/auth/dal";
import {
  EmailAnalyticsDashboard,
  type EmailAnalyticsSearchParams,
} from "@/components/email-analytics/email-analytics-dashboard";

export default async function CentreAdminEmailAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<EmailAnalyticsSearchParams>;
}) {
  // centre_admin only — centreId below always comes from this session, never
  // from searchParams, so a centre_admin can never see another centre's data
  // no matter what's in the URL. RLS on email_logs backstops this too (see
  // its migration).
  const centreAdmin = await requireRole("centre_admin");
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Email Analytics</h1>
      <EmailAnalyticsDashboard
        centreId={centreAdmin.centre_id!}
        searchParams={params}
        detailBasePath="/centre-admin/email-analytics"
      />
    </div>
  );
}
