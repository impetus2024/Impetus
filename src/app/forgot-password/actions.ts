"use server";

import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import { authRateKeys } from "@/lib/auth/rate-limit-core";
import { absoluteUrl } from "@/lib/url";
import { consumeAll, getClientIp, RATE_LIMIT_UNAVAILABLE_MESSAGE } from "@/lib/auth/rate-limit";

const ForgotPasswordSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
});

export type ForgotPasswordState = { error?: string; success?: boolean } | undefined;

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email." };
  }

  const rateKeys = authRateKeys("reset", parsed.data.email, await getClientIp());
  const rateLimit = await consumeAll(rateKeys.consume);
  // Generic message: independent of whether the account exists.
  if (rateLimit.unavailable) return { error: RATE_LIMIT_UNAVAILABLE_MESSAGE };
  if (rateLimit.limited) {
    // Same success response either way — don't let the rate-limit branch
    // become a second way to distinguish real accounts from typos.
    return { success: true };
  }

  const supabase = await createClient();

  // Always report success regardless of whether the email exists — an
  // account-enumeration-safe response. Supabase itself doesn't error for
  // unknown emails on this call either, so this just matches that.
  // Kept query-string-free: Supabase's redirect URL allowlist (config.toml
  // locally, Dashboard → Auth → URL Configuration in production) matches
  // exact URLs, and a bare path is far easier to keep in sync there than
  // one with a query string.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl("/auth/confirm"),
  });

  return { success: true };
}
