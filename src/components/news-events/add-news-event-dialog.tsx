"use client";

import { useState } from "react";
import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field";
import { CentreCheckboxesFieldset } from "@/components/publishable-content/centre-checkboxes-fieldset";
import { createNewsEvent, type NewsEventFormState } from "@/lib/news-events/actions";

const TYPE_LABEL: Record<string, string> = {
  upcoming_event: "Upcoming Event",
  news_announcement: "News & Announcement",
};

export function AddNewsEventDialog({
  centres,
}: {
  // Present only for super_admin — a centre_admin never gets a centre
  // picker; createNewsEvent resolves their own centre_id from the
  // authenticated session and ignores anything a client sends.
  centres?: { id: string; name: string }[];
}) {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<NewsEventFormState>(createNewsEvent);
  const [type, setType] = useState("upcoming_event");
  const noCentres = centres && centres.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setType("upcoming_event");
      }}
    >
      <DialogTrigger render={<Button>Add News / Event</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add News / Event</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-6">
          <FieldSet>
            <FieldLegend variant="label">Details</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select name="type" value={type} onValueChange={(v) => v && setType(v)} required>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select type">{(v: string) => TYPE_LABEL[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming_event">Upcoming Event</SelectItem>
                    <SelectItem value="news_announcement">News &amp; Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" name="title" required />
              </Field>
              {type === "upcoming_event" && (
                <Field>
                  <FieldLabel htmlFor="eventDate">Event Date</FieldLabel>
                  <Input id="eventDate" name="eventDate" type="date" required />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" name="description" rows={3} />
              </Field>
            </FieldGroup>
          </FieldSet>

          {centres && <CentreCheckboxesFieldset centres={centres} />}

          {state?.error && (
            <FieldDescription className="text-destructive">{state.error}</FieldDescription>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || noCentres}>
              {pending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
