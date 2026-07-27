"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeactivatePlayerButton({
  playerId,
  isActive,
  action,
}: {
  playerId: string;
  isActive: boolean;
  action: (id: string, active: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={isActive ? "destructive" : "default"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => action(playerId, !isActive))}
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
