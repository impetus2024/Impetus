import { Image as ImageIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HighlightManagementCard } from "./highlight-management-card";
import type { MonthlyHighlightListItem } from "@/lib/monthly-highlights/queries";

// canManage defaults true for the two roles allowed to create/edit/delete
// (centre_admin, super_admin) — every other viewing role (staff, finance,
// coach, medical, parent) gets the same grid with Edit/Delete dropped, same
// read-only treatment those roles already get everywhere else in the app.
// Server Actions already refuse them regardless; this just avoids showing
// controls that would error. Card grid, not a data table, so this reads
// like the rest of the dashboard rather than an admin list.
export function MonthlyHighlightsTable({
  highlights,
  canManage = true,
}: {
  highlights: MonthlyHighlightListItem[];
  canManage?: boolean;
}) {
  if (highlights.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="No monthly highlights yet"
        message="Add one to get started."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {highlights.map((highlight) => (
        <HighlightManagementCard key={highlight.id} highlight={highlight} canManage={canManage} />
      ))}
    </div>
  );
}
