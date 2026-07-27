"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPlayerActive } from "./actions";

export function PlayerRowActions({
  playerId,
  isActive,
}: {
  playerId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`/centre-admin/players/${playerId}`}>View Profile</Link>}
      />
      <Button
        variant={isActive ? "destructive" : "default"}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setPlayerActive(playerId, !isActive))
        }
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
