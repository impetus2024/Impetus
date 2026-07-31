import "server-only";

// Best-effort in-memory limiter — no Redis/Upstash in this deployment. On
// Vercel each serverless instance has its own memory, so this doesn't hold
// across instances the way a shared store would; it's still a real backstop
// for the common case (one warm instance handling repeated attempts from
// the same client) and costs nothing to add. Swap for Upstash's rate-limit
// package if this needs to be a hard guarantee later.
//
// Shared by login (key `login:<email>`), forgot-password (key
// `reset:<email>`), and file uploads (key `upload:<userId>`) — prefixed so
// none of them share a budget. Upload gets its own, more generous config:
// it throttles a single account hammering the endpoint, not repeated auth
// failures, and a legitimate multi-document form (e.g. the administrator
// form's 4 files) must never trip it in one submission.
const CONFIGS: Record<string, { maxAttempts: number; windowMs: number }> = {
  upload: { maxAttempts: 20, windowMs: 10 * 60 * 1000 },
};
const DEFAULT_CONFIG = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

function configFor(key: string) {
  const prefix = key.slice(0, key.indexOf(":"));
  return CONFIGS[prefix] ?? DEFAULT_CONFIG;
}

const attempts = new Map<string, { count: number; resetAt: number }>();

// Unbounded growth guard — if this ever gets large, drop expired entries
// rather than let the Map grow forever between deploys.
function sweep(now: number) {
  if (attempts.size < 1000) return;
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}

export function isRateLimited(key: string): { limited: boolean; retryAfterMinutes?: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return { limited: false };
  if (entry.count >= configFor(key).maxAttempts) {
    return { limited: true, retryAfterMinutes: Math.ceil((entry.resetAt - now) / 60000) };
  }
  return { limited: false };
}

export function recordAttempt(key: string) {
  const now = Date.now();
  sweep(now);
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + configFor(key).windowMs });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
