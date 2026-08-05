import { Newspaper } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewsEventManagementCard } from "./news-event-management-card";
import type { NewsEventListItem } from "@/lib/news-events/queries";

// canManage defaults true for the two roles allowed to create/edit/delete
// (centre_admin, super_admin) — every other viewing role (staff, finance,
// coach, medical, parent) gets the same grid with Edit/Delete dropped, same
// read-only treatment those roles already get everywhere else in the app.
// Server Actions already refuse them regardless; this just avoids showing
// controls that would error. Card grid, not a data table, so this reads
// like the rest of the dashboard rather than an admin list.
export function NewsEventsTable({
  newsEvents,
  canManage = true,
}: {
  newsEvents: NewsEventListItem[];
  canManage?: boolean;
}) {
  if (newsEvents.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No news or events yet"
        message="Add one to get started."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {newsEvents.map((item) => (
        <NewsEventManagementCard key={item.id} newsEvent={item} canManage={canManage} />
      ))}
    </div>
  );
}
