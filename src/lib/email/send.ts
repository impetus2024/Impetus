import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWarning } from "@/lib/logger";

// Exported for the Resend webhook route (src/app/api/webhooks/resend) —
// signature verification lives on the same Resend client, no separate
// instantiation/error-handling for a missing RESEND_API_KEY.
export function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

const SEND_TIMEOUT_MS = 10000;

// The Resend SDK doesn't expose a per-call timeout — without this, a
// hanging request to their API would hang the Server Action awaiting it
// (provisionUser/resetUserPassword already treat a failed send as
// non-fatal and log a warning, but only once this actually rejects).
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Email send timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Every interpolated value below is operator- or user-supplied (a name typed
// into the player/administrator form, an email address), so it can't go into
// an HTML body raw — an apostrophe alone already breaks the markup, and a
// `<a href>` typed into a name field would be rendered as a live link in
// someone else's inbox.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailLogContext = {
  to: string;
  subject: string;
  emailType: string;
  recipientProfileId: string | null;
  centreId: string | null;
};

// Best-effort: losing the log row doesn't change whether the email went out,
// same "notification, not a precondition" reasoning provision-user.ts already
// applies to the send itself. Mirrors recordAttempt() in whatsapp/send.ts,
// which records failed and skipped attempts the same way.
async function recordEmailLog(
  context: EmailLogContext,
  outcome:
    | { status: "sent"; resendEmailId: string; idempotencyKey: string | null }
    | { status: "failed"; errorMessage: string }
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_logs").insert({
      // Null on failure: email_logs.resend_email_id is nullable precisely for
      // "failed before Resend returned an id" (see its migration).
      resend_email_id: outcome.status === "sent" ? outcome.resendEmailId : null,
      email_type: context.emailType,
      subject: context.subject,
      recipient_email: context.to,
      recipient_profile_id: context.recipientProfileId,
      centre_id: context.centreId,
      status: outcome.status,
      error_message: outcome.status === "failed" ? outcome.errorMessage : null,
      failed_at: outcome.status === "failed" ? new Date().toISOString() : null,
      // Only a *successful* send claims the idempotency key. A failed attempt
      // that recorded it would make every later retry skip the send (the
      // pre-check below only asks whether the key exists), turning one
      // transient Resend outage into an email that can never be sent.
      idempotency_key: outcome.status === "sent" ? outcome.idempotencyKey : null,
    });
    if (error) throw error;
  } catch (err) {
    logWarning(`Failed to record email_logs entry for ${context.to}:`, err);
  }
}

// Single path every transactional email goes through: timeout, Resend's
// resolve-don't-reject error shape, an email_logs row for the outcome
// (success *and* failure), and optional at-most-once delivery.
//
// Throws on any failure — callers decide whether that's fatal (none of them
// currently treat it as such; see provisionUser/resetUserPassword).
//
// Nothing here logs the message body: an invite carries a temporary password,
// so only the recipient, subject and email type ever reach email_logs, the
// console or Sentry.
async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType: string;
  recipientProfileId: string | null;
  centreId: string | null;
  // Set for emails that must go out at most once no matter how often the
  // action behind them is retried (see sendEmailChangedEmail). Sent to Resend
  // as the Idempotency-Key header *and* stored on the email_logs row, so the
  // duplicate is caught here before it ever reaches Resend.
  idempotencyKey?: string | null;
}): Promise<void> {
  const { to, subject, html, text, emailType, recipientProfileId, centreId } = params;
  const idempotencyKey = params.idempotencyKey ?? null;
  const context: EmailLogContext = { to, subject, emailType, recipientProfileId, centreId };

  if (idempotencyKey) {
    const { data: existing, error: lookupError } = await createAdminClient()
      .from("email_logs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    // Fail rather than send: an unreadable log is exactly the case where we
    // can't tell a first attempt from a retry, and sending a duplicate is the
    // worse of the two outcomes for a "your email address was changed" notice.
    if (lookupError) {
      const message = `Could not check email idempotency key: ${lookupError.message}`;
      await recordEmailLog(context, { status: "failed", errorMessage: message });
      throw new Error(message);
    }

    if (existing) return;
  }

  try {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM is not set");

    const result = await withTimeout(
      getClient().emails.send(
        { from, to, subject, html, text },
        idempotencyKey ? { idempotencyKey } : undefined
      ),
      SEND_TIMEOUT_MS
    );

    // The Resend SDK resolves (doesn't reject) on API-level failures — this
    // check is what makes a rejected domain/address a thrown error the way
    // callers already expect.
    if (result.error) {
      // result.error carries only Resend's own name/message (e.g.
      // "validation_error"), never the request body — safe to log and store.
      throw new Error(`Resend rejected the send (${result.error.name}): ${result.error.message}`);
    }

    await recordEmailLog(context, {
      status: "sent",
      resendEmailId: result.data.id,
      idempotencyKey,
    });
  } catch (err) {
    // The failure used to leave no trace anywhere except a console/Sentry
    // warning at the call site, so "was this person ever emailed?" had no
    // answer in the email log the admin UI reads. Record it, then rethrow
    // unchanged so existing call-site handling is untouched.
    await recordEmailLog(context, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Sent whenever the service-role admin API creates an account for someone
// else (Centre Admin, Coach, Medical, Parent) — carries their temp password.
//
// emailType/recipientProfileId/centreId are only used to populate email_logs
// — the send itself doesn't need them, but this is the one place that knows
// the Resend id and the actual send outcome, so it's also the natural place
// to record it (see provisionUser/resetUserPassword call sites).
//
// Deliberately not idempotency-keyed: "reset this account's password again"
// is a legitimate repeat action, and each one carries a different password.
export async function sendAccountInviteEmail(params: {
  to: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
  emailType: string;
  recipientProfileId: string | null;
  centreId: string | null;
}) {
  const { to, fullName, tempPassword, loginUrl, emailType, recipientProfileId, centreId } = params;
  const subject = "Your account has been created";

  await sendTransactionalEmail({
    to,
    subject,
    emailType,
    recipientProfileId,
    centreId,
    html: `
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>An account has been created for you. Sign in and change your password as soon as possible — you'll be asked to set a new one the first time you sign in.</p>
      <p><strong>Email:</strong> ${escapeHtml(to)}<br/>
      <strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
      <p><a href="${escapeHtml(loginUrl)}">Sign in</a></p>
    `,
    // A text/plain alternative isn't cosmetic: a single-part HTML message is
    // a well-known spam signal, and this one has to reach an inbox to be of
    // any use at all.
    text: [
      `Hi ${fullName},`,
      "",
      "An account has been created for you. Sign in and change your password as soon as possible — you'll be asked to set a new one the first time you sign in.",
      "",
      `Email: ${to}`,
      `Temporary password: ${tempPassword}`,
      "",
      `Sign in: ${loginUrl}`,
    ].join("\n"),
  });
}

// Sent to the NEW address after an administrator has changed the login email
// on someone else's account and every database/auth write for that change has
// already succeeded (see updateParentProfile).
//
// Never sent to the old address, and never carries a password: the account's
// existing password is untouched by an email change, and the one-time link
// below is the recovery path if the owner doesn't have it. That link is
// Supabase's own recovery link (admin.generateLink), so it expires and is
// single-use — it is not a credential we minted.
export async function sendEmailChangedEmail(params: {
  to: string;
  fullName: string;
  passwordSetupUrl: string | null;
  loginUrl: string;
  recipientProfileId: string | null;
  centreId: string | null;
  idempotencyKey: string;
}) {
  const { to, fullName, passwordSetupUrl, loginUrl, recipientProfileId, centreId, idempotencyKey } =
    params;
  const subject = "Your sign-in email has been updated";

  // The old address is deliberately absent from the copy as well as the
  // recipient list: this message can land in the inbox of someone who was
  // never connected to the previous account holder.
  const htmlSetup = passwordSetupUrl
    ? `<p>If you don't know your password, use this one-time link to set a new one: <a href="${escapeHtml(passwordSetupUrl)}">Set your password</a>. It expires shortly and can only be used once.</p>`
    : `<p>If you don't know your password, use "Forgot password?" on the sign-in page to set a new one.</p>`;
  const textSetup = passwordSetupUrl
    ? `If you don't know your password, use this one-time link to set a new one (it expires shortly and can only be used once):\n${passwordSetupUrl}`
    : `If you don't know your password, use "Forgot password?" on the sign-in page to set a new one.`;

  await sendTransactionalEmail({
    to,
    subject,
    emailType: "email_changed",
    recipientProfileId,
    centreId,
    idempotencyKey,
    html: `
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Your sign-in email has been changed to <strong>${escapeHtml(to)}</strong>. Use this address the next time you sign in.</p>
      <p>You have been signed out on every device as a precaution.</p>
      ${htmlSetup}
      <p><a href="${escapeHtml(loginUrl)}">Sign in</a></p>
      <p>If you weren't expecting this change, contact your centre straight away.</p>
    `,
    text: [
      `Hi ${fullName},`,
      "",
      `Your sign-in email has been changed to ${to}. Use this address the next time you sign in.`,
      "",
      "You have been signed out on every device as a precaution.",
      "",
      textSetup,
      "",
      `Sign in: ${loginUrl}`,
      "",
      "If you weren't expecting this change, contact your centre straight away.",
    ].join("\n"),
  });
}
