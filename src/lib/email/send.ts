import "server-only";
import { Resend } from "resend";

function getClient() {
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
export async function sendAccountInviteEmail(params: {
  to: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const { to, fullName, tempPassword, loginUrl } = params;

  await withTimeout(
    getClient().emails.send({
      from,
      to,
      subject: "Your account has been created",
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
}
