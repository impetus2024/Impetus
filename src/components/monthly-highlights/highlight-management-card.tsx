import { Image as ImageIcon } from "lucide-react";
import { ReadMoreText } from "@/components/publishable-content/read-more-text";
import { TargetCentresBadges } from "@/components/publishable-content/target-centres-badges";
import { getPublicFileUrl } from "@/lib/storage/r2";
import { formatPublishedDate, expiresInDays } from "@/lib/publishable-content/format";
import { EditMonthlyHighlightDialog } from "./edit-monthly-highlight-dialog";
import { DeleteMonthlyHighlightDialog } from "./delete-monthly-highlight-dialog";
import type { MonthlyHighlightListItem } from "@/lib/monthly-highlights/queries";

// Management-grid sibling of HighlightCard (the dashboard feed's compact
// version) — same image/title layout, but with the admin-facing fields
// (published date, expiry, target centres) and Edit/Delete instead of a
// dismiss button. canManage hides Edit/Delete for every role besides
// centre_admin/super_admin (see MonthlyHighlightsTable).
export function HighlightManagementCard({
  highlight,
  canManage,
}: {
  highlight: MonthlyHighlightListItem;
  canManage: boolean;
}) {
  const canShowImages = Boolean(process.env.R2_PUBLIC_URL);
  const daysLeft = expiresInDays(highlight.expires_at);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      <div className="aspect-video w-full bg-muted">
        {canShowImages && highlight.image_path ? (
          // Plain <img>, not next/image — same reasoning as HighlightCard
          // (R2's public URL host isn't in next.config's remotePatterns).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPublicFileUrl(highlight.image_path)}
            alt={highlight.title}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold leading-snug">{highlight.title}</h3>
        {highlight.description && <ReadMoreText text={highlight.description} />}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Published {formatPublishedDate(highlight.created_at)}</span>
          <span>
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </span>
        </div>

        <TargetCentresBadges centres={highlight.centres} />

        {canManage && (
          <div className="mt-2 flex gap-2 border-t border-border/70 pt-3">
            <EditMonthlyHighlightDialog highlight={highlight} />
            <DeleteMonthlyHighlightDialog highlight={highlight} />
          </div>
        )}
      </div>
    </article>
  );
}
