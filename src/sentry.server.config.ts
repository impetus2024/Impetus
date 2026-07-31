import * as Sentry from "@sentry/nextjs";

// No-op without SENTRY_DSN — error tracking is optional infrastructure,
// not something local dev or a deploy without it configured should have to
// carry. See src/lib/logger.ts, which is what everything in the app
// actually calls; this just gives that call somewhere to report to.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // This app's own error messages are already scrubbed of secrets/PII by
    // convention (see logger.ts) — don't let Sentry additionally attach
    // request bodies/headers/cookies on top of that.
    sendDefaultPii: false,
  });
}
