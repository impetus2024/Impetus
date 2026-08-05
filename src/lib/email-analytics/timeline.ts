export type EmailTimelineEvent = {
  label: string;
  timestamp: string;
  detail?: string;
};

type EmailLogTimelineSource = {
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  complained_at: string | null;
  open_count: number;
  click_count: number;
};

// Not a full history of every individual open/click (email_logs only keeps
// the *first* occurrence of each — see its migration comment); this is the
// event-type-level timeline that data actually supports, in the order the
// events happened. open_count/click_count fill in "how many", since a
// single opened_at/clicked_at can't.
export function buildEmailTimeline(row: EmailLogTimelineSource): EmailTimelineEvent[] {
  const events: EmailTimelineEvent[] = [{ label: "Sent", timestamp: row.sent_at }];

  if (row.delivered_at) events.push({ label: "Delivered", timestamp: row.delivered_at });
  if (row.opened_at) {
    events.push({
      label: "Opened",
      timestamp: row.opened_at,
      detail: row.open_count > 1 ? `${row.open_count} times` : undefined,
    });
  }
  if (row.clicked_at) {
    events.push({
      label: "Clicked",
      timestamp: row.clicked_at,
      detail: row.click_count > 1 ? `${row.click_count} times` : undefined,
    });
  }
  if (row.bounced_at) events.push({ label: "Bounced", timestamp: row.bounced_at });
  if (row.failed_at) events.push({ label: "Failed", timestamp: row.failed_at });
  if (row.complained_at) events.push({ label: "Complained", timestamp: row.complained_at });

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
