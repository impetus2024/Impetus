const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Last n months (oldest first), each with a "YYYY-MM" key and a short label. */
export function getLastNMonths(n: number) {
  const now = new Date();
  const months: { key: string; label: string; year: number; start: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      start: d,
    });
  }
  return months;
}

export function monthKeyOf(dateStr: string) {
  return dateStr.slice(0, 7);
}
