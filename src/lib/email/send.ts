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

// Sent whenever the service-role admin API creates an account for someone
// else (Centre Admin, Coach, Medical, Parent) — carries their temp password.
//
// emailType/recipientProfileId/centreId are only used to populate email_logs
// below — the send itself doesn't need them, but this is the one place that
// knows the Resend id and the actual send outcome, so it's also the natural
// place to record it (see provisionUser/resetUserPassword call sites).
export async function sendAccountInviteEmail(params: {
  to: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
  emailType: string;
  recipientProfileId: string | null;
  centreId: string | null;
}) {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const { to, fullName, tempPassword, loginUrl, emailType, recipientProfileId, centreId } = params;
  const subject = "Your account has been created";

  const result = await withTimeout(
    getClient().emails.send({
      from,
      to,
      subject,
      html: `
      <p>Hi ${fullName},</p>
      <p>An account has been created for you. Sign in and change your password as soon as possible.</p>
      <p><strong>Email:</strong> ${to}<br/>
      <strong>Temporary password:</strong> ${tempPassword}</p>
      <p><a href="${loginUrl}">Sign in</a></p>
    `,
    }),
    10000
  );

  // The Resend SDK resolves (doesn't reject) on API-level failures — this
  // check is what makes a rejected domain/address a thrown error the way
  // callers already expect (they catch and log a warning, see
  // provisionUser/resetUserPassword).
  if (result.error) {
    throw new Error(result.error.message);
  }

  // Best-effort: losing the log row doesn't mean the email wasn't sent, same
  // "notification, not a precondition" reasoning provision-user.ts already
  // applies to the send itself.
  try {
    const admin = createAdminClient();
    const { error: logError } = await admin.from("email_logs").insert({
      resend_email_id: result.data.id,
      email_type: emailType,
      subject,
      recipient_email: to,
      recipient_profile_id: recipientProfileId,
      centre_id: centreId,
      status: "sent",
    });
    if (logError) throw logError;
  } catch (err) {
    logWarning(`Failed to record email_logs entry for ${to}:`, err);
  }
}
