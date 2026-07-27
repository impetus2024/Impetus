"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PackageFormDialog } from "./package-form-dialog";
import { updatePackage, setPackageActive } from "./actions";

type Option = { id: string; name: string };

export function PackageRowActions({
  pkg,
  playerTypes,
}: {
  pkg: {
    id: string;
    name: string;
    player_type_id: string | null;
    price: number;
    duration: string;
    is_active: boolean;
  };
  playerTypes: Option[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <PackageFormDialog
        trigger={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
        title="Edit Package"
        action={updatePackage.bind(null, pkg.id)}
        playerTypes={playerTypes}
        defaultValues={{
          name: pkg.name,
          playerTypeId: pkg.player_type_id,
          price: pkg.price,
          duration: pkg.duration,
        }}
      />
      <Button
        variant={pkg.is_active ? "destructive" : "default"}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setPackageActive(pkg.id, !pkg.is_active))
        }
      >
        {pkg.is_active ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
