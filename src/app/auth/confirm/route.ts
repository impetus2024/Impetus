import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/url";
import { logWarning } from "@/lib/logger";

// Landing point for every Supabase auth email link (password recovery
// today; also covers invite/signup confirmation if those are ever
// enabled) — reachable while logged out via proxy.ts's PUBLIC_PATHS
// "/auth" prefix match.
//
// Supabase can hand back either shape here depending on the project's
// flow type: a PKCE `code` (this local project — GoTrue's own
// /auth/v1/verify redirects with `?code=` for pkce_-prefixed tokens) or
// `token_hash`+`type` (implicit-flow projects, and Supabase's own current
// docs default to recommending this pattern). Handling both means this
// keeps working regardless of which a given Supabase project is
// configured for — confirmed by testing against this project's actual
// local instance, which turned out to use PKCE.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Penetration test finding: this previously passed the raw query param
  // straight into `${origin}${next}` with no validation. An absolute URL
  // there throws (ERR_INVALID_URL — ${origin}${next} is never a valid URL
  // once next is itself absolute), an unauthenticated 500 reachable by
  // anyone holding any valid reset code. safeNextPath rejects both that
  // and protocol-relative values, falling back to the same inferred
  // default as before.
  const next =
    safeNextPath(searchParams.get("next")) ?? (type === "recovery" || code ? "/reset-password" : "/");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    logWarning("Auth confirm link rejected (code exchange failed):", error);
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    logWarning("Auth confirm link rejected (OTP verify failed):", error);
  }

  return NextResponse.redirect(`${origin}/login?error=invalid-reset-link`);
}
