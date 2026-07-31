import { Sparkles } from "lucide-react";

export function FiveSPlaceholder({
  title = "5S Model isn't set up yet",
  message = "Once the 5S skill assessment model is defined, results for this player will show up here.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Sparkles className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
