import { Badge } from "@/components/ui/badge";
import type { OverallPlayerRating } from "@/lib/five-s/scores";

// Red-to-green gradient across the 5 tiers, reusing the app's existing
// fixed status/chart color tokens rather than inventing new ones (see
// src/app/globals.css) — status-critical/serious/warning are already the
// bad-to-middling end of a severity scale, status-good and chart-3 give two
// distinct greens for the top two tiers.
const RATING_STYLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-status-critical/10 text-status-critical",
  2: "bg-status-serious/10 text-status-serious",
  3: "bg-status-warning/10 text-status-warning",
  4: "bg-chart-3/10 text-chart-3",
  5: "bg-status-good/10 text-status-good",
};

// Shown next to a player's name wherever their overall 5S rating is
// relevant (see computeOverallPlayerRating) — nothing renders when the
// player has no assessed 5S category yet.
export function PlayerRatingBadge({ rating }: { rating: OverallPlayerRating | null }) {
  if (!rating) return null;

  return (
    <Badge
      title={`Overall 5S rating: ${rating.label} (${rating.rating}/5)`}
      className={RATING_STYLES[rating.rating]}
    >
      {rating.rating} · {rating.label}
    </Badge>
  );
}
