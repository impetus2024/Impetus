import "server-only";
import * as Sentry from "@sentry/nextjs";

// Single place every catch block in the app reports through, so an
// unexpected failure always reaches both the server console (local/CI
// debugging) and Sentry (production alerting) instead of each call site
// picking one or the other. Sentry.captureException/captureMessage are
// safe no-ops when SENTRY_DSN isn't configured (see sentry.*.config.ts).
//
// `message` should stay free of secrets — every call site already follows
// that convention (ids/emails, never tokens or full request bodies);
// logError doesn't do any redaction of its own.
export function logError(message: string, error: unknown): void {
  console.error(message, error);
  Sentry.captureException(error, { extra: { message } });
}

// For expected, non-error outcomes worth a line in the server log but not a
// Sentry alert (e.g. cleanup deliberately keeping an object that is still
// referenced). Console only — unlike logWarning/logError this never reports
// to Sentry, because nothing here needs anyone paged about it.
export function logInfo(message: string): void {
  console.info(message);
}

// For failures that are noteworthy but non-fatal to the operation (e.g. an
// invite email didn't send) — still worth surfacing in production, one
// severity level down from logError.
export function logWarning(message: string, error?: unknown): void {
  console.warn(message, error);
  Sentry.captureMessage(message, {
    level: "warning",
    extra: error !== undefined ? { error } : undefined,
  });
}
