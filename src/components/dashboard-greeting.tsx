function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting({
  name,
  subtitle,
}: {
  name: string;
  subtitle?: string;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {timeOfDayGreeting()}, {name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {today}
        {subtitle ? ` · ${subtitle}` : ""}
      </p>
    </div>
  );
}
