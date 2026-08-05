import { CalendarDays, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadMoreText } from "@/components/publishable-content/read-more-text";
import { TargetCentresBadges } from "@/components/publishable-content/target-centres-badges";
import { formatPublishedDate, expiresInDays } from "@/lib/publishable-content/format";
import { EditNewsEventDialog } from "./edit-news-event-dialog";
import { DeleteNewsEventDialog } from "./delete-news-event-dialog";
import type { NewsEventListItem } from "@/lib/news-events/queries";

const TYPE_LABEL: Record<NewsEventListItem["type"], string> = {
  upcoming_event: "Upcoming Event",
  news_announcement: "News & Announcement",
};

// Management-grid sibling of NewsEventCard (the dashboard feed's compact
// version) — same badge/border visual language, but with the admin-facing
// fields (published date, expiry, target centres) and Edit/Delete instead
// of a dismiss button. canManage hides Edit/Delete for every role besides
// centre_admin/super_admin (see NewsEventsTable).
export function NewsEventManagementCard({
  newsEvent,
  canManage,
}: {
  newsEvent: NewsEventListItem;
  canManage: boolean;
}) {
  const isEvent = newsEvent.type === "upcoming_event";
  const daysLeft = expiresInDays(newsEvent.expires_at);

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border-l-4 border-border/70 bg-card p-4 shadow-card",
        isEvent ? "border-l-primary" : "border-l-amber-500"
      )}
    >
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          isEvent
            ? "bg-primary/10 text-primary"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}
      >
        {isEvent ? <CalendarDays className="size-3.5" /> : <Megaphone className="size-3.5" />}
        {TYPE_LABEL[newsEvent.type]}
      </span>
      <h3 className="text-sm font-semibold leading-snug">{newsEvent.title}</h3>
      {isEvent && newsEvent.event_date && (
        <p className="text-xs font-medium text-muted-foreground">
          {formatPublishedDate(newsEvent.event_date)}
        </p>
      )}
      {newsEvent.description && <ReadMoreText text={newsEvent.description} />}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Published {formatPublishedDate(newsEvent.created_at)}</span>
        <span>
          {daysLeft} day{daysLeft === 1 ? "" : "s"} left
        </span>
      </div>

      <TargetCentresBadges centres={newsEvent.centres} />

      {canManage && (
        <div className="mt-2 flex gap-2 border-t border-border/70 pt-3">
          <EditNewsEventDialog newsEvent={newsEvent} />
          <DeleteNewsEventDialog newsEvent={newsEvent} />
        </div>
      )}
    </article>
  );
}
