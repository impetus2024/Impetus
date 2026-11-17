import { requireRole } from "@/lib/auth/dal";
import { MonthlyHighlightsFeed } from "@/components/monthly-highlights/monthly-highlights-feed";
import { NewsEventsFeed } from "@/components/news-events/news-events-feed";

export default async function MediaDashboard() {
  await requireRole("media");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <NewsEventsFeed />
      <MonthlyHighlightsFeed />
    </div>
  );
}
