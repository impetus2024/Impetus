import Link from "next/link";
import { Bell, CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tone = "info" | "good" | "warning";

const TONE_STYLES: Record<Tone, { icon: typeof Bell; iconClass: string }> = {
  info: { icon: Bell, iconClass: "bg-primary/10 text-primary" },
  good: { icon: CircleCheck, iconClass: "bg-status-good/10 text-status-good" },
  warning: { icon: TriangleAlert, iconClass: "bg-status-warning/15 text-status-serious" },
};

export function InsightBanner({
  tone = "info",
  title,
  message,
  action,
}: {
  tone?: Tone;
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  const { icon: Icon, iconClass } = TONE_STYLES[tone];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", iconClass)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{message}</p>
      </div>
      {action && (
        <Button size="sm" render={<Link href={action.href}>{action.label}</Link>} />
      )}
    </div>
  );
}
