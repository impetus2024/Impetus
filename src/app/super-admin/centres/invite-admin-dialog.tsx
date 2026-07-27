"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { inviteCentreAdmin, type CentreFormState } from "./actions";

export function InviteAdminDialog({ centreId, centreName }: { centreId: string; centreName: string }) {
  const boundAction = inviteCentreAdmin.bind(null, centreId);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<CentreFormState>(boundAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Invite Admin</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Admin — {centreName}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="adminName">Name</FieldLabel>
              <Input id="adminName" name="adminName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="adminEmail">Email</FieldLabel>
              <Input id="adminEmail" name="adminEmail" type="email" required />
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
