import type { Instrumentation } from "next";

// Runs once per server instance, before it accepts requests — the natural
// place to fail fast on missing configuration (see lib/env.ts) rather than
// letting it surface as a runtime crash on whichever request touches the
// missing value first.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors Next.js's own instrumentation surfaces from Server
// Components, Route Handlers, Server Actions, and proxy.ts — the cases a
// try/catch in application code never runs for because nothing in the
// framework's own request handling caught and logged them first. Safe
// no-op without SENTRY_DSN, same as the config files above.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(err, request, context);
};
