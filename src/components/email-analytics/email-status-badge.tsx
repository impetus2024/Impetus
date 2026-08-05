import { Badge } from "@/components/ui/badge";
import type { EmailStatus } from "@/lib/email-analytics/queries";

const STATUS_LABEL: Record<EmailStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  failed: "Failed",
  complained: "Complained",
};

const STATUS_VARIANT: Record<EmailStatus, "secondary" | "default" | "destructive"> = {
  sent: "secondary",
  delivered: "default",
  opened: "default",
  clicked: "default",
  bounced: "destructive",
  failed: "destructive",
  complained: "destructive",
};

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
