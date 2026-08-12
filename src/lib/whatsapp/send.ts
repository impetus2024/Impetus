import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWarning } from "@/lib/logger";

// Fixed per Route Mobile's documented API -- not environment-specific (no
// separate sandbox/production host was given), so these are constants, not
// env vars. Only credentials go in env vars (see ROUTE_MOBILE_USERNAME/
// ROUTE_MOBILE_PASSWORD below), matching how email/send.ts treats Resend's
// API host as fixed too.
const AUTH_URL = "https://apis.rmlconnect.net/auth/v1/login/";
const SEND_URL = "https://apis.rmlconnect.net/wba/v1/messages";

const WELCOME_TEMPLATE_NAME = "welcome_template";
const WELCOME_TEMPLATE_LANG = "en";

const AUTH_TIMEOUT_MS = 10000;
const SEND_TIMEOUT_MS = 15000;

// Route Mobile documents the JWT as valid for 1 hour. Cached per warm
// server instance (cleared on cold start, which is fine -- a fresh login
// costs one extra request) so a burst of onboarding sends doesn't
// re-authenticate every time. Refreshed 5 minutes early so a token doesn't
// expire mid-flight.
let cachedToken: { token: string; expiresAt: number } | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
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

async function safeReadJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Route Mobile's documented error shapes differ slightly by status code
// (400/401 use "reason", 404 only has "message", 422 has a "template_type"
// array) -- try each documented field in order rather than assuming one.
function extractErrorMessage(status: number, body: Record<string, unknown> | null): string {
  if (!body) return `HTTP ${status}`;
  if (typeof body.reason === "string") return body.reason;
  if (typeof body.message === "string") return body.message;
  if (Array.isArray(body.template_type)) return `template_type: ${body.template_type.join(", ")}`;
  return `HTTP ${status}`;
}

// Masks a phone number for console/Sentry logs (never for the whatsapp_logs
// row itself, which centre_admin/staff/finance can already see unmasked on
// the player's own profile via RLS) -- e.g. "+919876543210" -> "+919****10".
function maskPhone(phone: string): string {
  if (phone.length <= 6) return "*".repeat(phone.length);
  return `${phone.slice(0, 4)}${"*".repeat(phone.length - 6)}${phone.slice(-2)}`;
}

// Route Mobile requires full E.164 with a leading '+'. Never writes back to
// players.parent_contact_number -- this only produces the value used for
// one API call. Only accepts a number already given in full international
// form; a bare local number has no reliable country code to infer, so it's
// treated as unnormalizable rather than guessed at (no country-specific
// assumption here -- the caller records this as 'skipped').
export function normalizePhoneForRouteMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  return null;
}

async function getAuthToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const username = process.env.ROUTE_MOBILE_USERNAME;
  const password = process.env.ROUTE_MOBILE_PASSWORD;
  if (!username || !password) {
    throw new Error("ROUTE_MOBILE_USERNAME/ROUTE_MOBILE_PASSWORD is not set");
  }

  const response = await withTimeout(
    fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
    AUTH_TIMEOUT_MS,
    "Route Mobile auth"
  );

  const body = await safeReadJson(response);
  if (!response.ok) {
    throw new Error(`Route Mobile auth failed: ${extractErrorMessage(response.status, body)}`);
  }

  const token = body?.JWTAUTH;
  if (typeof token !== "string" || !token) {
    throw new Error("Route Mobile auth response missing JWTAUTH");
  }

  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

async function postTemplateMessage(phone: string, token: string): Promise<Response> {
  return withTimeout(
    fetch(SEND_URL, {
      method: "POST",
      // Route Mobile's documented Authorization header carries the raw JWT,
      // no "Bearer " prefix.
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({
        phone,
        media: {
          type: "media_template",
          template_name: WELCOME_TEMPLATE_NAME,
          lang_code: WELCOME_TEMPLATE_LANG,
        },
      }),
    }),
    SEND_TIMEOUT_MS,
    "Route Mobile send"
  );
}

type LogParams = {
  centreId: string;
  playerId: string;
  parentProfileId: string | null;
  recipientPhone: string;
  status: "sent" | "failed" | "skipped";
  errorMessage: string | null;
  requestId: string | null;
};

async function recordAttempt(params: LogParams): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("whatsapp_logs").insert({
      centre_id: params.centreId,
      player_id: params.playerId,
      parent_profile_id: params.parentProfileId,
      recipient_phone: params.recipientPhone,
      template_name: WELCOME_TEMPLATE_NAME,
      route_mobile_request_id: params.requestId,
      status: params.status,
      error_message: params.errorMessage,
    });
    if (error) throw error;
  } catch (err) {
    // Best-effort, same reasoning as sendAccountInviteEmail's email_logs
    // insert: losing the log row doesn't undo the send (or non-send).
    logWarning(`Failed to record whatsapp_logs entry for player ${params.playerId}:`, err);
  }
}

// Sends the approved, zero-variable `welcome_template` to a newly created
// player's parent. Never throws -- every failure (missing number,
// unnormalizable number, auth failure, timeout, Route Mobile error) is
// caught, logged, and recorded to whatsapp_logs; the caller (createPlayer)
// can await this without any try/catch of its own and player creation is
// never affected.
export async function sendWhatsAppWelcomeTemplate(params: {
  centreId: string;
  playerId: string;
  parentProfileId: string | null;
  rawPhoneNumber: string | null;
}): Promise<void> {
  const { centreId, playerId, parentProfileId, rawPhoneNumber } = params;

  // Stored in whatsapp_logs unmasked once known (same RLS-gated visibility
  // as players.parent_contact_number itself) -- only ever masked for
  // console/Sentry via maskPhone() at each logWarning call below.
  let normalized: string | null = null;

  try {
    if (!rawPhoneNumber) {
      await recordAttempt({
        centreId,
        playerId,
        parentProfileId,
        recipientPhone: "",
        status: "skipped",
        errorMessage: "No parent contact number on file.",
        requestId: null,
      });
      logWarning(`WhatsApp welcome skipped for player ${playerId}: no parent contact number on file.`);
      return;
    }

    normalized = normalizePhoneForRouteMobile(rawPhoneNumber);
    if (!normalized) {
      await recordAttempt({
        centreId,
        playerId,
        parentProfileId,
        recipientPhone: rawPhoneNumber,
        status: "skipped",
        errorMessage: "Stored contact number could not be safely normalized to E.164.",
        requestId: null,
      });
      logWarning(
        `WhatsApp welcome skipped for player ${playerId}: contact number could not be normalized (${maskPhone(rawPhoneNumber)}).`
      );
      return;
    }

    let token = await getAuthToken();
    let response = await postTemplateMessage(normalized, token);

    // JWT expired mid-cache-window (or was invalidated server-side) --
    // re-authenticate once and retry, rather than failing the whole send
    // over a stale cached token.
    if (response.status === 401) {
      cachedToken = null;
      token = await getAuthToken();
      response = await postTemplateMessage(normalized, token);
    }

    const body = await safeReadJson(response);

    if (!response.ok) {
      throw new Error(`Route Mobile send failed: ${extractErrorMessage(response.status, body)}`);
    }

    const requestId = typeof body?.request_id === "string" ? body.request_id : null;
    await recordAttempt({
      centreId,
      playerId,
      parentProfileId,
      recipientPhone: normalized,
      status: "sent",
      errorMessage: null,
      requestId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordAttempt({
      centreId,
      playerId,
      parentProfileId,
      recipientPhone: normalized ?? rawPhoneNumber ?? "",
      status: "failed",
      errorMessage: message,
      requestId: null,
    });
    logWarning(`WhatsApp welcome not sent for player ${playerId} (${maskPhone(normalized ?? rawPhoneNumber ?? "")}):`, err);
  }
}
