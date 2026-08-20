import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { getNewsEvents } from "@/lib/news-events/queries";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/publishable-content/roles";
import { NewsEventCard } from "./news-event-card";

// Sister of MonthlyHighlightsFeed (src/components/monthly-highlights/) —
// same Card wrapper, same "own centre for Centre Admin / selected centre
// for Super Admin" scoping (see getNewsEvents), same scrollable-feed
// behavior. Deliberately its own independent widget, never merged with
// Monthly Highlights.
export async function NewsEventsFeed({ centreId }: { centreId?: string }) {
  // Safe to call again here — verifySession is React-cache()'d per request,
  // so this doesn't re-hit the DB; the page's own requireRole already ran.
  const actor = await requireRole(...DASHBOARD_VIEWER_ROLES);
  const { newsEvents } = await getNewsEvents(1, centreId, actor.id, true);

  return (
    <Card className="flex flex-col rounded-2xl border-border/70 shadow-card">
      <CardHeader>
        <CardTitle>News & Events</CardTitle>
        <CardDescription>Latest news and upcoming events</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {newsEvents.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Newspaper}
              title="No news or events yet"
              message="Published items will show up here."
            />
          </div>
        ) : (
          // Plain vertical scroll filling the card's stretched height, not a
          // carousel/slider — same social-feed behavior as Monthly
          // Highlights.
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {newsEvents.map((item) => (
              <NewsEventCard key={item.id} newsEvent={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
