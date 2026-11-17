// Shared by Monthly Highlights and News & Events — both auto-expire 30 days
// after created_at (see each table's generated `expires_at` column, e.g.
// 20260805030000_monthly_highlights.sql) and list newest-published-first,
// so the same "how many days left" / "when was this published" formatting
// applies to both.

// Locale and time zone are pinned, not left to the runtime: these run during
// server rendering AND in the browser, and with `undefined` the server (en-US,
// UTC) and the user's browser (e.g. en-IN, IST) format the same instant
// differently ("Nov 17, 2026" vs "17 Nov 2026", or a different day near
// midnight), which React reports as a hydration mismatch.
const DISPLAY_LOCALE = "en-IN";
const DISPLAY_TIME_ZONE = "Asia/Kolkata";

export function formatPublishedDate(value: string): string {
  return new Date(value).toLocaleDateString(DISPLAY_LOCALE, {
    dateStyle: "medium",
    timeZone: DISPLAY_TIME_ZONE,
  });
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
  return new Intl.RelativeTimeFormat(DISPLAY_LOCALE,{ numeric: "auto" }).format(-diffDays, "day");
}
