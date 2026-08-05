// Shared by Monthly Highlights and News & Events — both auto-expire 30 days
// after created_at (see each table's generated `expires_at` column, e.g.
// 20260805030000_monthly_highlights.sql) and list newest-published-first,
// so the same "how many days left" / "when was this published" formatting
// applies to both.

export function formatPublishedDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function expiresInDays(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// "Today" / "2 days ago" — the relative framing both dashboard feeds use for
// their social-feed-style cards.
export function formatRelativeDate(value: string): string {
  const diffDays = Math.round((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-diffDays, "day");
}
