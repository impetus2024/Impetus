"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Only fires when the root layout itself throws — has to render its own
// <html>/<body> since it replaces the whole document in that case. Kept
// deliberately dependency-free (no Tailwind classes, no shared
// components) since whatever broke the root layout might also be why
// those failed to load. Sentry.captureException is safe here regardless
// (it doesn't depend on app styling/components, just the SDK).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in root layout:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontWeight: 600, fontSize: 18 }}>Something went wrong</p>
          <p style={{ color: "#666", marginTop: 8 }}>
            Please refresh the page. If this keeps happening, contact support.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
