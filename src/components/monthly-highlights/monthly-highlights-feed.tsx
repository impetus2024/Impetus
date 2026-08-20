import { Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { getMonthlyHighlights } from "@/lib/monthly-highlights/queries";
import { getPublicFileUrl } from "@/lib/storage/r2";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/publishable-content/roles";
import { HighlightCard } from "./highlight-card";

// Dashboard replacement for the old "Recent Activity" card — same Card
// wrapper/grid slot, same className the Centre Admin dashboard's Payments
// card sits next to. RLS scopes a Centre Admin to their own centre
// automatically (see 20260805030000_monthly_highlights.sql); centreId
// narrows further for Super Admin, whose RLS is full-access across every
// centre — see getMonthlyHighlights.
export async function MonthlyHighlightsFeed({ centreId }: { centreId?: string }) {
  // Safe to call again here — verifySession is React-cache()'d per request,
  // so this doesn't re-hit the DB; the page's own requireRole already ran.
  const actor = await requireRole(...DASHBOARD_VIEWER_ROLES);
  const { highlights } = await getMonthlyHighlights(1, centreId, actor.id, true);
  const canShowImages = Boolean(process.env.R2_PUBLIC_URL);

  return (
    <Card className="flex flex-col rounded-2xl border-border/70 shadow-card">
      <CardHeader>
        <CardTitle>Monthly Highlights</CardTitle>
        <CardDescription>Latest published highlights</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {highlights.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Megaphone}
              title="No highlights yet"
              message="Published highlights will show up here."
            />
          </div>
        ) : (
          // Plain vertical scroll filling the card's stretched height, not a
          // carousel/slider — reads as a scrollable feed the way a social
          // app's timeline does, instead of a paged widget.
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {highlights.map((highlight) => (
              <HighlightCard
                key={highlight.id}
                id={highlight.id}
                title={highlight.title}
                description={highlight.description}
                publishedAt={highlight.created_at}
                imageUrl={
                  canShowImages && highlight.image_path
                    ? getPublicFileUrl(highlight.image_path)
                    : null
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
