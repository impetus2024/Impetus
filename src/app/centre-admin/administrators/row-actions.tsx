"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { setAdministratorActive, resetAdministratorPassword, type ResetPasswordActionState } from "./actions";

export function AdministratorRowActions({
  profileId,
  isActive,
  isSelf,
}: {
  profileId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [resetResult, setResetResult] = useState<ResetPasswordActionState | null>(null);

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" render={<Link href={`/centre-admin/administrators/${profileId}`}>View</Link>} />
      <Button
        variant="outline"
        size="sm"
        disabled={resetPending}
        onClick={() =>
          startReset(async () => {
            const result = await resetAdministratorPassword(profileId);
            setResetResult(result);
          })
        }
      >
        {resetPending ? "Resetting..." : "Reset Password"}
      </Button>
      {!isSelf && (
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
      )}

      <Dialog open={resetResult !== null} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
          </DialogHeader>
          {resetResult && "error" in resetResult ? (
            <DialogDescription className="text-destructive">{resetResult.error}</DialogDescription>
          ) : resetResult ? (
            <div className="space-y-3">
              <DialogDescription>
                {resetResult.emailSent
                  ? "A new temporary password was emailed to this account. It's also shown below in case delivery isn't configured."
                  : "The email couldn't be sent — share this temporary password with them directly."}
              </DialogDescription>
              <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm select-all">
                {resetResult.tempPassword}
              </p>
            </div>
          ) : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
