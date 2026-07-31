import { Loader2 } from "lucide-react";

// Used as each role section's loading.tsx — Next.js scopes that Suspense
// boundary to the layout's {children} slot, so the sidebar/topbar in
// AppShell stays mounted and only the content area shows this, instead of
// a root-level loading.tsx blanking the whole shell on every navigation.
export function RouteLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
