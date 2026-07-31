export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

// Only ever redirect back to a same-site path — a "next"/"redirect_to"
// style param is client-supplied wherever it appears (the login form, the
// /auth/confirm callback), so an absolute or protocol-relative value (e.g.
// "//evil.com") must never be followed as-is. Concatenating origin+next
// naively (as /auth/confirm did before this helper existed there) doesn't
// actually let an absolute URL redirect off-site — new URL() rejects the
// malformed result — but it does crash with an unhandled exception on
// attacker-controlled input, which this avoids by rejecting up front.
export function safeNextPath(next: FormDataEntryValue | string | null): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}
