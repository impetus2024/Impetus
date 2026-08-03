"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteCentreAdmin } from "./actions";

type Admin = { id: string; full_name: string; email: string; is_active: boolean };

function AdminRow({ centreId, admin }: { centreId: string; admin: Admin }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{admin.full_name}</p>
        <p className="text-sm text-muted-foreground">{admin.email}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {!admin.is_active && <Badge variant="secondary">Disabled</Badge>}
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteCentreAdmin(centreId, admin.id);
              setError(result?.error ?? null);
            })
          }
        >
          {pending ? "Removing..." : "Remove"}
        </Button>
      </div>
    </div>
  );
}

export function CentreAdminsDialog({
  centreId,
  centreName,
  admins,
}: {
  centreId: string;
  centreName: string;
  admins: Admin[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {admins.length > 0 ? `${admins.length} Admin${admins.length > 1 ? "s" : ""}` : "No Admin"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Centre Admins — {centreName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {admins.length === 0 && (
            <p className="text-sm text-muted-foreground">No centre admins for this centre.</p>
          )}
          {admins.map((admin) => (
            <AdminRow key={admin.id} centreId={centreId} admin={admin} />
          ))}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
