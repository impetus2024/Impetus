"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setAdministratorActive } from "./actions";

export function AdministratorRowActions({
  profileId,
  isActive,
}: {
  profileId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" render={<Link href={`/centre-admin/administrators/${profileId}`}>View</Link>} />
      <Button
        variant={isActive ? "destructive" : "default"}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setAdministratorActive(profileId, !isActive))
        }
      >
        {isActive ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
