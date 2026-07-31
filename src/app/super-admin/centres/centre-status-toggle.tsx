"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setCentreActive } from "./actions";

export function CentreStatusToggle({
  centreId,
  isActive,
}: {
  centreId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={isActive ? "destructive" : "default"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setCentreActive(centreId, !isActive))}
    >
      {isActive ? "Disable" : "Enable"}
    </Button>
  );
}
