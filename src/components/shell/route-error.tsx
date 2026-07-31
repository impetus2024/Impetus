"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Used as each role section's error.tsx — same reasoning as
// route-loading.tsx: Next.js scopes this error boundary to the layout's
// {children} slot, so AppShell's sidebar/topbar stays mounted and only the
// content area shows this, instead of an error anywhere under e.g.
// /centre-admin bubbling all the way up to the root error.tsx and blanking
// the whole shell (nav included).
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in route tree:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-foreground">Something went wrong</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try again, or contact support if the problem continues.
            </p>
          </div>
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
