export type FiveSWindowStatus =
  | { status: "none" }
  | { status: "upcoming"; start: string; end: string }
  | { status: "open"; start: string; end: string }
  | { status: "closed"; start: string; end: string };

// Plain date-string comparison (YYYY-MM-DD sorts chronologically), no
// timezone conversion — matches how the rest of the app treats plain date
// columns (e.g. attendance, payments).
export function getFiveSWindowStatus(
  start: string | null,
  end: string | null
): FiveSWindowStatus {
  if (!start || !end) return { status: "none" };
  const today = new Date().toISOString().slice(0, 10);
  if (today < start) return { status: "upcoming", start, end };
  if (today > end) return { status: "closed", start, end };
  return { status: "open", start, end };
}

export function isFiveSWindowOpen(start: string | null, end: string | null): boolean {
  return getFiveSWindowStatus(start, end).status === "open";
}
