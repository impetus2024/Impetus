export function ViewField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
      <div className="flex min-h-9 items-center rounded-lg bg-muted/60 px-3 py-1.5 text-sm text-foreground">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
