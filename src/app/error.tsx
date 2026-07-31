"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalErrorBoundary({
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
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-foreground">Something went wrong</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try again, or head back to your dashboard if the problem continues.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
            <Button render={<Link href="/">Go home</Link>} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
