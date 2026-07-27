"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LookupItem = { id: string; name: string; is_active: boolean };
type LookupFormState = { error?: string } | undefined;

function ItemDialog({
  trigger,
  title,
  defaultValue,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValue?: string;
  action: (prev: LookupFormState, formData: FormData) => Promise<LookupFormState>;
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<LookupFormState>(action);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" defaultValue={defaultValue} required />
          </Field>
          {state?.error && (
            <FieldDescription className="mt-2 text-destructive">
              {state.error}
            </FieldDescription>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LookupManager({
  items,
  itemLabel,
  createAction,
  renameAction,
  toggleAction,
}: {
  items: LookupItem[];
  itemLabel: string;
  createAction: (prev: LookupFormState, formData: FormData) => Promise<LookupFormState>;
  renameAction: (id: string, prev: LookupFormState, formData: FormData) => Promise<LookupFormState>;
  toggleAction: (id: string, active: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ItemDialog
          trigger={<Button>Add {itemLabel}</Button>}
          title={`Add ${itemLabel}`}
          action={createAction}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>
                <Badge variant={item.is_active ? "default" : "secondary"}>
                  {item.is_active ? "Enabled" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <ItemDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  }
                  title={`Edit ${itemLabel}`}
                  defaultValue={item.name}
                  action={renameAction.bind(null, item.id)}
                />
                <Button
                  variant={item.is_active ? "destructive" : "default"}
                  size="sm"
                  onClick={() => toggleAction(item.id, !item.is_active)}
                >
                  {item.is_active ? "Disable" : "Enable"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No {itemLabel.toLowerCase()}s yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
