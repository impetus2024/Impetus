import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewField } from "@/components/view-field";
import { EmailStatusBadge } from "./email-status-badge";
import { buildEmailTimeline } from "@/lib/email-analytics/timeline";
import type { EmailLogDetail } from "@/lib/email-analytics/queries";

export function EmailDetailView({ email }: { email: EmailLogDetail }) {
  const timeline = buildEmailTimeline(email);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Email Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <ViewField label="Recipient" value={email.recipient_email} />
          <ViewField label="Subject" value={email.subject ?? "—"} />
          <ViewField label="Status" value={<EmailStatusBadge status={email.status} />} />
          <ViewField label="Type" value={email.email_type} />
          <ViewField label="Open Count" value={email.open_count} />
          <ViewField label="Click Count" value={email.click_count} />
        </CardContent>
      </Card>

      {email.error_message && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5 shadow-card">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Reported by Resend for this email.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{email.error_message}</p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/70 shadow-card">
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>Every stage this email has reached, in order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeline.map((event, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="font-medium">
                  {event.label}
                  {event.detail && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">({event.detail})</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
