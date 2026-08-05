"use client";

import { Image as ImageIcon } from "lucide-react";
import { ReadMoreText } from "@/components/publishable-content/read-more-text";
import { DismissButton } from "@/components/publishable-content/dismiss-button";
import { formatRelativeDate } from "@/lib/publishable-content/format";
import { useDismissable } from "@/hooks/use-dismissable";
import { dismissMonthlyHighlight } from "@/lib/monthly-highlights/actions";

export function HighlightCard({
  id,
  title,
  description,
  publishedAt,
  imageUrl,
}: {
  id: string;
  title: string;
  description: string | null;
  publishedAt: string;
  imageUrl: string | null;
}) {
  const { dismissed, pending, dismiss } = useDismissable(() => dismissMonthlyHighlight(id));

  if (dismissed) return null;

  return (
    <article className="relative overflow-hidden rounded-xl border border-border/70 bg-card">
      <DismissButton
        onClick={dismiss}
        pending={pending}
        className="absolute top-2 right-2 z-10 bg-card/90 backdrop-blur-sm"
      />
      <div className="aspect-video w-full bg-muted">
        {imageUrl ? (
          // Plain <img>, not next/image — R2's public URL host isn't
          // configured in next.config's images.remotePatterns, and this app's
          // existing pattern for R2-hosted images (centre logos, the highlight
          // management table) already goes through a plain <img> internally
          // (base-ui's Avatar) rather than Next's image pipeline.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" />
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="text-sm font-semibold leading-snug">{title}</h3>
        {description && <ReadMoreText text={description} />}
        <p className="text-xs text-muted-foreground">{formatRelativeDate(publishedAt)}</p>
      </div>
    </article>
  );
}
