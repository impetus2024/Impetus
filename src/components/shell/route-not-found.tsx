import { Compass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Used as each role section's not-found.tsx — same reasoning as
// route-loading.tsx/route-error.tsx: keeps AppShell's sidebar/topbar
// mounted instead of an unmatched nested route (e.g. a stale link to a
// deleted player) bubbling up to the root not-found.tsx and blanking the
// whole shell.
export function RouteNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Compass className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Page not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              That page doesn&apos;t exist, or you may not have access to it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
