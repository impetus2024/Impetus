import * as Sentry from "@sentry/nextjs";

// Client-side counterpart to sentry.server.config.ts/sentry.edge.config.ts
// — catches React rendering errors (via error.tsx/global-error.tsx calling
// Sentry.captureException) and uncaught browser-side exceptions. DSNs
// aren't secret (they're meant to ship in client bundles), but this is
// still a no-op without one configured, same as the server side.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

// Recommended by the SDK so navigations show up as part of the same trace
// instead of each page load looking like an unrelated request.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
