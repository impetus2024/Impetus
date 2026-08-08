"use client";

import { Tag } from "lucide-react";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LookupItem = { id: string; name: string; is_active: boolean; age?: number | null };
type LookupFormState = { error?: string } | undefined;

// The actual age a category represents (e.g. "Cubs" -> 8), used by the 5S
// Model — distinct from the free-text name, which is just a display label.
const AGE_OPTIONS = Array.from({ length: 22 }, (_, i) => i + 4); // 4..25

function ItemDialog({
  trigger,
  title,
  defaultValue,
  defaultAge,
  showAge,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValue?: string;
  defaultAge?: number | null;
  showAge?: boolean;
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
          {showAge && (
            <Field className="mt-4">
              <FieldLabel htmlFor="age">Age</FieldLabel>
              <Select name="age" defaultValue={defaultAge != null ? String(defaultAge) : undefined} required>
                <SelectTrigger id="age" className="w-full">
                  <SelectValue placeholder="Select age" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_OPTIONS.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
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
  canEdit = true,
  showAge = false,
}: {
  items: LookupItem[];
  itemLabel: string;
  createAction: (prev: LookupFormState, formData: FormData) => Promise<LookupFormState>;
  renameAction: (id: string, prev: LookupFormState, formData: FormData) => Promise<LookupFormState>;
  toggleAction: (id: string, active: boolean) => Promise<void>;
  canEdit?: boolean;
  showAge?: boolean;
}) {
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <ItemDialog
            trigger={<Button>Add {itemLabel}</Button>}
            title={`Add ${itemLabel}`}
            showAge={showAge}
            action={createAction}
          />
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showAge && <TableHead>Age</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              {showAge && <TableCell>{item.age ?? "—"}</TableCell>}
              <TableCell>
                <Badge variant={item.is_active ? "default" : "secondary"}>
                  {item.is_active ? "Enabled" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                {canEdit ? (
                  <>
                    <ItemDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      }
                      title={`Edit ${itemLabel}`}
                      defaultValue={item.name}
                      defaultAge={item.age}
                      showAge={showAge}
                      action={renameAction.bind(null, item.id)}
                    />
                    <Button
                      variant={item.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleAction(item.id, !item.is_active)}
                    >
                      {item.is_active ? "Disable" : "Enable"}
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={showAge ? 4 : 3}>
                <EmptyState icon={Tag} title={`No ${itemLabel.toLowerCase()}s yet`} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
