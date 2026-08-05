import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { getEmailLogDetail } from "@/lib/email-analytics/queries";
import { EmailDetailView } from "@/components/email-analytics/email-detail-view";

export default async function SuperAdminEmailDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ centreId?: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;
  const { centreId } = await searchParams;

  // Unlike the centre-admin equivalent, a super_admin has no single "own"
  // centre — centreId here is which centre's list this row was reached
  // from (see EmailLogTable's row links), not an access grant. RLS's
  // "super_admin full access to email_logs" policy is the actual grant.
  if (!centreId) notFound();

  const email = await getEmailLogDetail(centreId, id);
  if (!email) notFound();

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        render={
          <Link href={`/super-admin/email-analytics?centreId=${centreId}`}>
            <ArrowLeft className="size-4" />
            Back to Email Analytics
          </Link>
        }
      />
      <div>
        <h1 className="text-2xl font-semibold">{email.recipient_email}</h1>
        <p className="text-sm text-muted-foreground">{email.subject ?? "No subject"}</p>
      </div>
      <EmailDetailView email={email} />
    </div>
  );
}
