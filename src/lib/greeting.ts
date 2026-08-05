function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayLongDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Server-side only — computing the date/greeting inside a Client Component would re-run on hydration and risk a mismatch. */
export function buildGreeting(name: string, subtitle?: string) {
  return {
    title: `${timeOfDayGreeting()}, ${name.split(" ")[0]}`,
    dateLine: subtitle ? `${todayLongDate()} · ${subtitle}` : todayLongDate(),
  };
}
