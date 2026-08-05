import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { Resend } from "resend";
import { getClient } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logWarning } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

type TrackedEvent = {
  status: Database["public"]["Enums"]["email_status"];
  emailId: string;
  errorMessage: string | null;
};

// The 7 event types this app tracks on email_logs. A switch (rather than a
// lookup table keyed by event.type) is what lets TypeScript narrow `event`
// per case — email_id lives on every email.* event's data, but bounce/
// failed's extra reason field only exists on their own case. Anything else
// Resend sends here (email.scheduled, email.delivery_delayed,
// email.received, contact.*, domain.*) falls through to `default`,
// acknowledged (200, so Resend doesn't retry) and otherwise ignored — no
// email_logs column tracks it.
function toTrackedEvent(event: ReturnType<Resend["webhooks"]["verify"]>): TrackedEvent | null {
  switch (event.type) {
    case "email.sent":
      return { status: "sent", emailId: event.data.email_id, errorMessage: null };
    case "email.delivered":
      return { status: "delivered", emailId: event.data.email_id, errorMessage: null };
    case "email.opened":
      return { status: "opened", emailId: event.data.email_id, errorMessage: null };
    case "email.clicked":
      return { status: "clicked", emailId: event.data.email_id, errorMessage: null };
    case "email.bounced":
      return { status: "bounced", emailId: event.data.email_id, errorMessage: event.data.bounce.message };
    case "email.failed":
      return { status: "failed", emailId: event.data.email_id, errorMessage: event.data.failed.reason };
    case "email.complained":
      return { status: "complained", emailId: event.data.email_id, errorMessage: null };
    default:
      return null;
  }
}

// Unauthenticated by design (see proxy.ts's ALWAYS_ALLOWED_PATHS) — Resend
// calls this directly, there's no Supabase session to check. The signature
// verification below is what stands in for auth here.
//
// Resend signs webhook requests the same way Svix does: `svix-id` /
// `svix-timestamp` / `svix-signature` headers over the raw request body.
// resend.webhooks.verify() (backed by the `standardwebhooks` package,
// bundled with the `resend` SDK) throws if the signature, timestamp, or
// secret don't match.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logError(
      "Resend webhook received but RESEND_WEBHOOK_SECRET is not set",
      new Error("RESEND_WEBHOOK_SECRET is not set")
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Must be the raw body, not parsed JSON — the signature is computed over
  // the exact bytes Resend sent.
  const payload = await request.text();
  const svixId = request.headers.get("svix-id") ?? "";

  let event;
  try {
    event = getClient().webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch (err) {
    logWarning("Resend webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const tracked = toTrackedEvent(event);
  if (!tracked) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // record_email_event does the delivery-id dedup check and the email_logs
  // update as one atomic statement (see its migration) — a redelivered event
  // (same svixId) is a no-op there instead of double-counting open/click.
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_email_event", {
    p_webhook_event_id: svixId,
    p_resend_email_id: tracked.emailId,
    p_event_type: tracked.status,
    p_error_message: tracked.errorMessage,
  });

  if (error) {
    logError(`Failed to record ${event.type} for Resend email ${tracked.emailId}:`, error);
    // 500 so Resend retries — this is a real failure to persist the event,
    // not a duplicate or an event type we don't track.
    return NextResponse.json({ error: "Failed to process event" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
