import { TrendingUp, MailOpen, MousePointerClick, TriangleAlert } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import type { EmailAnalyticsSummary } from "@/lib/email-analytics/queries";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export function EmailMetricsCards({ summary }: { summary: EmailAnalyticsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Delivery Rate" value={pct(summary.deliveryRate)} icon={TrendingUp} />
      <StatCard label="Open Rate" value={pct(summary.openRate)} icon={MailOpen} />
      <StatCard label="Click Rate" value={pct(summary.clickRate)} icon={MousePointerClick} />
      <StatCard label="Bounce Rate" value={pct(summary.bounceRate)} icon={TriangleAlert} />
    </div>
  );
}
