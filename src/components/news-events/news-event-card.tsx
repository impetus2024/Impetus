"use client";

import { CalendarDays, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadMoreText } from "@/components/publishable-content/read-more-text";
import { DismissButton } from "@/components/publishable-content/dismiss-button";
import { formatPublishedDate } from "@/lib/publishable-content/format";
import { useDismissable } from "@/hooks/use-dismissable";
import { dismissNewsEvent } from "@/lib/news-events/actions";
import type { NewsEventListItem } from "@/lib/news-events/queries";

// Two visually distinct card styles so an Upcoming Event and a News &
// Announcement are immediately distinguishable in the feed — accent color,
// icon, and badge differ per type; neither carries an image (News & Events
// has no image upload, unlike Monthly Highlights).
export function NewsEventCard({
  newsEvent,
}: {
  newsEvent: Pick<NewsEventListItem, "id" | "type" | "title" | "description" | "event_date">;
}) {
  const isEvent = newsEvent.type === "upcoming_event";
  const { dismissed, pending, dismiss } = useDismissable(() => dismissNewsEvent(newsEvent.id));

  if (dismissed) return null;

  return (
    <article
      className={cn(
        "flex items-start justify-between gap-2 rounded-xl border-l-4 border-border/70 bg-card p-3",
        isEvent ? "border-l-primary" : "border-l-amber-500"
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
            isEvent
              ? "bg-primary/10 text-primary"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          {isEvent ? <CalendarDays className="size-3.5" /> : <Megaphone className="size-3.5" />}
          {isEvent ? "Upcoming Event" : "News & Announcement"}
        </span>
        <h3 className="text-sm font-semibold leading-snug">{newsEvent.title}</h3>
        {isEvent && newsEvent.event_date && (
          <p className="text-xs font-medium text-muted-foreground">
            {formatPublishedDate(newsEvent.event_date)}
          </p>
        )}
        {newsEvent.description && <ReadMoreText text={newsEvent.description} />}
      </div>
      <DismissButton onClick={dismiss} pending={pending} />
    </article>
  );
}
