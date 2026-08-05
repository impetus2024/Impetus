import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { getEmailLogDetail } from "@/lib/email-analytics/queries";
import { EmailDetailView } from "@/components/email-analytics/email-detail-view";

export default async function CentreAdminEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // centreId is this session's own centre — never taken from the URL/params,
  // even though the row link this page is reached from carries a ?centreId
  // query string (that's only there for the super-admin equivalent page).
  const centreAdmin = await requireRole("centre_admin");

  const email = await getEmailLogDetail(centreAdmin.centre_id!, id);
  if (!email) notFound();

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        render={
          <Link href="/centre-admin/email-analytics">
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
