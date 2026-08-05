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
