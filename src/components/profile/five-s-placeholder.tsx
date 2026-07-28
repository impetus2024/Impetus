import { Sparkles } from "lucide-react";

export function FiveSPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Sparkles className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">5S Model isn&apos;t set up yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Once the 5S skill assessment model is defined, results for this player will show up here.
        </p>
      </div>
    </div>
  );
}
