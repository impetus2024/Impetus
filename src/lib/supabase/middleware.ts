import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleHome, type UserRole } from "@/lib/auth/roles";

const PUBLIC_PATHS = ["/login", "/auth", "/forgot-password"];
// Unlike PUBLIC_PATHS, never redirected in *either* direction (logged-in
// users aren't bounced to their dashboard here either) — an uptime monitor
// can't follow a redirect meaningfully, and it isn't a page a signed-in
// user would land on by mistake.
const ALWAYS_ALLOWED_PATHS = ["/api/health"];

// Refreshes the Supabase session cookie on every request and applies
// optimistic (cookie-only) redirects. Authoritative role checks still
// happen in the DAL close to the data — see src/lib/auth/dal.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
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
  return response;
}
