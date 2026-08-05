export type DateRangePreset = "today" | "7d" | "30d" | "custom";

export const DATE_RANGE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Resolves the Today / Last 7 Days / Last 30 Days / Custom Range filter into
 * a concrete [since, until) window. `until` is always exclusive (the start
 * of the day *after* the range ends) so a plain `sent_at < until` comparison
 * covers the whole last day without needing end-of-day time math at the
 * call site.
 */
export function resolveDateRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): { since: Date; until: Date; preset: DateRangePreset; from: string; to: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (params.range === "custom" && params.from && params.to) {
    const since = parseISODate(params.from);
    const until = parseISODate(params.to);
    until.setDate(until.getDate() + 1);
    // A custom range typed backwards (to before from) would otherwise silently
    // return zero rows rather than a visible error — swap instead.
    if (since > until) {
      return { since: until, until: since, preset: "custom", from: params.to, to: params.from };
    }
    return { since, until, preset: "custom", from: params.from, to: params.to };
  }

  if (params.range === "7d") {
    const since = new Date(startOfToday);
    since.setDate(since.getDate() - 6);
    return { since, until: startOfTomorrow, preset: "7d", from: toISODate(since), to: toISODate(startOfToday) };
  }

  if (params.range === "30d") {
    const since = new Date(startOfToday);
    since.setDate(since.getDate() - 29);
    return { since, until: startOfTomorrow, preset: "30d", from: toISODate(since), to: toISODate(startOfToday) };
  }

  return {
    since: startOfToday,
    until: startOfTomorrow,
    preset: "today",
    from: toISODate(startOfToday),
    to: toISODate(startOfToday),
  };
}
