import { Send, MailCheck, MailOpen, MousePointerClick, MailWarning, MailX, Flag } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import type { EmailAnalyticsSummary } from "@/lib/email-analytics/queries";

export function EmailSummaryCards({ summary }: { summary: EmailAnalyticsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
      <StatCard label="Sent" value={summary.sent} icon={Send} />
      <StatCard label="Delivered" value={summary.delivered} icon={MailCheck} />
      <StatCard label="Opened" value={summary.opened} icon={MailOpen} />
      <StatCard label="Clicked" value={summary.clicked} icon={MousePointerClick} />
      <StatCard label="Bounced" value={summary.bounced} icon={MailWarning} />
      <StatCard label="Failed" value={summary.failed} icon={MailX} />
      <StatCard label="Complaints" value={summary.complained} icon={Flag} />
    </div>
  );
}
