import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { roleHome, type UserRole } from "@/lib/auth/roles";
import { resolveClientIp, type HeaderReader } from "@/lib/auth/client-ip";

const PUBLIC_PATHS = ["/login", "/auth", "/forgot-password"];
// Unlike PUBLIC_PATHS, never redirected in *either* direction (logged-in
// users aren't bounced to their dashboard here either) — an uptime monitor
// can't follow a redirect meaningfully, and it isn't a page a signed-in
// user would land on by mistake. /auth/confirm is here too: an emailed
// recovery/password-setup link must be verified even when the browser already
// holds some other session, instead of being bounced to that session's
// dashboard with the link left unused.
const ALWAYS_ALLOWED_PATHS = ["/api/health", "/api/webhooks/resend", "/auth/confirm"];

// Refreshes the Supabase session cookie on every request and applies
// optimistic (cookie-only) redirects. Authoritative role checks still
// happen in the DAL close to the data — see src/lib/auth/dal.ts.
type AuthEnv = {
  VERCEL?: string;
  TRUSTED_PROXY_HOPS?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

// Supabase Auth rate-limits by caller IP. From the server every request would
// share the app's egress IP, so with a secret key the real client IP must be
// forwarded in Sb-Forwarded-For. Only a trusted-proxy IP is ever forwarded
// (see resolveClientIp), and the secret key is used only when there is one to
// forward — otherwise fall back to the anon key with no extra header. The
// secret key is for this client only: it never goes on the response.
export function resolveSupabaseAuth(
  get: HeaderReader,
  env: AuthEnv,
  onIpUnavailable?: () => void
): { key: string; headers: Record<string, string> } {
  const ip = resolveClientIp(get, env);
  if (env.SUPABASE_SECRET_KEY && ip) {
    return { key: env.SUPABASE_SECRET_KEY, headers: { "Sb-Forwarded-For": ip } };
  }
  if (env.SUPABASE_SECRET_KEY) onIpUnavailable?.();
  return { key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, headers: {} };
}

// Secret-key path configured but no trusted client IP: auth calls fall back to
// the anon key, so Supabase rate-limits every user under the server's IP.
// Count every occurrence (Sentry metric) but log at most once per 5 minutes
// per instance — this runs on every request.
const FALLBACK_LOG_INTERVAL_MS = 5 * 60 * 1000;
let lastFallbackLog = 0;
function reportIpFallback(): void {
  if (process.env.NODE_ENV !== "production") return;
  Sentry.metrics.count("supabase_auth.sb_forwarded_for_fallback", 1);
  const now = Date.now();
  if (now - lastFallbackLog < FALLBACK_LOG_INTERVAL_MS) return;
  lastFallbackLog = now;
  const message =
    "SUPABASE_SECRET_KEY is set but no trusted client IP is available (set TRUSTED_PROXY_HOPS or deploy on Vercel): session refresh is falling back to the anon key without Sb-Forwarded-For.";
  console.warn(message);
  Sentry.captureMessage(message, "warning");
}

// Cookie adapter for the SSR client. setAll also receives cache headers
// (Cache-Control, Expires, Pragma) that stop CDNs caching a response carrying
// refreshed tokens; they must be applied to the rebuilt response.
export function createSessionCookieAdapter(request: NextRequest) {
  let response = NextResponse.next({ request });
  return {
    getResponse: () => response,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[],
        headers: Record<string, string> = {}
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value)
        );
      },
    },
  };
}

export async function updateSession(request: NextRequest) {
  const adapter = createSessionCookieAdapter(request);
  const auth = resolveSupabaseAuth(
    (name) => request.headers.get(name),
    {
      VERCEL: process.env.VERCEL,
      TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    },
    reportIpFallback
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    auth.key,
    {
      cookies: adapter.cookies,
      global: { headers: auth.headers },
    }
  );

  const pathname = request.nextUrl.pathname;
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
    return adapter.getResponse();
  }

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!claims && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A disabled account's access token stays locally valid until it expires
  // (see verifySession's comment on getClaims being a stateless check), so
  // without this carve-out a still-"claims-valid" disabled user would bounce
  // straight back here from roleHome, which the DAL bounces right back to
  // /login?disabled=1 — an infinite loop.
  const isDisabledLoginBounce =
    pathname.startsWith("/login") && request.nextUrl.searchParams.get("disabled") === "1";

  if (claims && isPublicPath && !isDisabledLoginBounce) {
    // app_metadata is only writable by the service role (see profiles trigger),
    // never trust user_metadata for authorization — it's client-editable.
    const role = claims.app_metadata?.role as UserRole | undefined;
    const url = request.nextUrl.clone();
    url.pathname = (role && roleHome(role)) || "/";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: any response returned from proxy must carry the refreshed
  // cookies set above, or the session will appear to randomly log out.
  return adapter.getResponse();
}
