import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/ui/alert";
import type { FiveSWindowStatus } from "@/lib/five-s/testing-window";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function describeWindow(status: FiveSWindowStatus): { title: string; description: string } {
  switch (status.status) {
    case "none":
      return {
        title: "No testing window scheduled",
        description: "Coaches can't add or edit 5S scores until a testing window is set.",
      };
    case "upcoming":
      return {
        title: `Opens ${formatDate(status.start)}`,
        description: `The next 5S testing window runs ${formatDate(status.start)} – ${formatDate(status.end)}. Scores can't be entered until it opens.`,
      };
    case "open":
      return {
        title: `Open until ${formatDate(status.end)}`,
        description: `Coaches can add and edit 5S scores until ${formatDate(status.end)}.`,
      };
    case "closed":
      return {
        title: `Closed ${formatDate(status.end)}`,
        description: "The testing window has ended — coaches can no longer add or edit scores.",
      };
  }
}

export function TestingWindowBanner({
  status,
  action,
}: {
  status: FiveSWindowStatus;
  action?: ReactNode;
}) {
  const { title, description } = describeWindow(status);
  return (
    <Alert>
      <CalendarClock />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action && <AlertAction>{action}</AlertAction>}
    </Alert>
  );
}
