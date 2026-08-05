"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function DismissButton({
  onClick,
  pending,
  className,
}: {
  onClick: () => void;
  pending: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title="Mark as read"
      aria-label="Mark as read"
      disabled={pending}
      onClick={onClick}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50",
        className
      )}
    >
      <Check className="size-3.5" />
    </button>
  );
}
