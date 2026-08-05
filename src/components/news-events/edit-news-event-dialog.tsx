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
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { updateNewsEvent, type NewsEventFormState } from "@/lib/news-events/actions";

const TYPE_LABEL: Record<string, string> = {
  upcoming_event: "Upcoming Event",
  news_announcement: "News & Announcement",
};

export function EditNewsEventDialog({
  newsEvent,
}: {
  newsEvent: {
    id: string;
    type: "upcoming_event" | "news_announcement";
    title: string;
    description: string | null;
    event_date: string | null;
  };
}) {
  const boundAction = updateNewsEvent.bind(null, newsEvent.id);
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<NewsEventFormState>(boundAction);
  const [type, setType] = useState(newsEvent.type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit — {newsEvent.title}</DialogTitle>
        </DialogHeader>
        <form action={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`type-${newsEvent.id}`}>Type</FieldLabel>
              <Select
                name="type"
                value={type}
                onValueChange={(v) => {
                  if (v === "upcoming_event" || v === "news_announcement") setType(v);
                }}
                required
              >
                <SelectTrigger id={`type-${newsEvent.id}`} className="w-full">
                  <SelectValue placeholder="Select type">{(v: string) => TYPE_LABEL[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming_event">Upcoming Event</SelectItem>
                  <SelectItem value="news_announcement">News &amp; Announcement</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`title-${newsEvent.id}`}>Title</FieldLabel>
              <Input
                id={`title-${newsEvent.id}`}
                name="title"
                defaultValue={newsEvent.title}
                required
              />
            </Field>
            {type === "upcoming_event" && (
              <Field>
                <FieldLabel htmlFor={`eventDate-${newsEvent.id}`}>Event Date</FieldLabel>
                <Input
                  id={`eventDate-${newsEvent.id}`}
                  name="eventDate"
                  type="date"
                  defaultValue={newsEvent.event_date ?? ""}
                  required
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={`description-${newsEvent.id}`}>Description</FieldLabel>
              <Textarea
                id={`description-${newsEvent.id}`}
                name="description"
                defaultValue={newsEvent.description ?? ""}
                rows={3}
              />
            </Field>
            {state?.error && (
              <FieldDescription className="text-destructive">{state.error}</FieldDescription>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
