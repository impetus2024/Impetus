import * as Sentry from "@sentry/nextjs";

// Covers the edge runtime (proxy.ts) — see sentry.server.config.ts for the
// Node runtime and why this is a no-op without SENTRY_DSN.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
