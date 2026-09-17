import "server-only";
import { logWarning } from "@/lib/logger";

// Checked once at server startup (see instrumentation.ts's register()).
// Every one of these is read with a non-null assertion (`!`) somewhere on
// nearly every request (Supabase clients, field encryption) with no
// fallback path if it's missing — better to fail the deploy immediately
// than crash on whichever request happens to touch it first.
const REQUIRED_VARS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIELD_ENCRYPTION_KEY",
] as const;

// Storage and email are already designed to degrade gracefully when unset
// (see r2.ts/send.ts and their callers — an upload/email failure is caught,
// logged, and shown as a warning, never a hard crash) — deliberately so a
// deploy can stand up auth/data flows before wiring up R2/Resend. Missing,
// these are worth a startup warning, not a fail-fast throw.
const RECOMMENDED_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "RESEND_WEBHOOK_SECRET",
] as const;

// In production the "degrades gracefully" argument above stops holding for
// email specifically: the only way a provisioned account learns its temporary
// password, and the only warning a parent gets that their sign-in address was
// changed, is an email. Without these, those flows don't degrade — they fail
// silently from the recipient's point of view. RESEND_WEBHOOK_SECRET stays a
// warning: delivery still works without it, only the status tracking in
// email-analytics goes stale.
const PRODUCTION_EMAIL_VARS = ["RESEND_API_KEY", "EMAIL_FROM"] as const;

// Resend rejects a From that isn't a verified sending identity, which is a
// 403 per send rather than anything a startup check can see — but the two
// shapes it accepts ("name@domain" or "Name <name@domain>") are checkable
// here, and a malformed value is otherwise only discovered when the first
// invite silently fails to arrive.
const EMAIL_FROM_PATTERN = /^(?:[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+|[^<>]+<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>)$/;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. See .env.local.example.`
    );
  }

  const missingRecommended = RECOMMENDED_VARS.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    logWarning(
      `Missing recommended environment variable(s): ${missingRecommended.join(", ")} — file uploads and/or transactional email will be unavailable until these are set.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    const missingEmail = PRODUCTION_EMAIL_VARS.filter((key) => !process.env[key]);
    if (missingEmail.length > 0) {
      throw new Error(
        `Missing required environment variable(s) for production email: ${missingEmail.join(", ")}. Account invites, password resets and email-change notifications cannot be delivered without these. See .env.local.example.`
      );
    }

    const emailFrom = process.env.EMAIL_FROM!;
    if (!EMAIL_FROM_PATTERN.test(emailFrom)) {
      throw new Error(
        'EMAIL_FROM must be an email address ("noreply@example.com") or a named sender ("Impetus <noreply@example.com>"), and its domain must be verified in Resend.'
      );
    }
  }

  // DEV_DEFAULT_PASSWORD gives every newly provisioned account the same
  // known password — meant strictly for local testing without an email
  // provider configured (see provision-user.ts). Left set by accident in a
  // deployed environment, it's a full account-takeover path for every
  // staff/parent account ever created.
  if (process.env.NODE_ENV === "production" && process.env.DEV_DEFAULT_PASSWORD) {
    throw new Error(
      "DEV_DEFAULT_PASSWORD must not be set in production — remove it before deploying."
    );
  }
}
