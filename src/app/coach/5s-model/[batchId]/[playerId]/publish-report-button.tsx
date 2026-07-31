"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishFiveSReport } from "../../actions";

export function PublishReportButton({
  batchId,
  playerId,
  isComplete,
  isPublished,
}: {
  batchId: string;
  playerId: string;
  isComplete: boolean;
  isPublished: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (isPublished) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <CheckCircle2 className="size-4 text-status-good" />
        Published
      </Button>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await publishFiveSReport(batchId, playerId);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Report published — centre admin and parent can now view it.");
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={!isComplete || pending}>
      {pending ? "Publishing..." : "Submit & Publish Report"}
    </Button>
  );
}
