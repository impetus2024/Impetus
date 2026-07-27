import "server-only";
import { Resend } from "resend";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
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

  await getClient().emails.send({
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
  });
}
