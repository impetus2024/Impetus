import { isIP } from "node:net";

// Pure, dependency-free so it can be unit tested. The caller supplies the
// header reader and the env, and only the headers a *trusted* proxy sets are
// believed: a client can send any X-Forwarded-For it likes, so trusting it
// blindly would let an attacker pick a fresh "IP" per request and walk around
// every per-IP limit.
//
// - Vercel (VERCEL=1): the platform overwrites x-vercel-forwarded-for /
//   x-real-ip with the connecting client's address.
// - Anything else: set TRUSTED_PROXY_HOPS to the number of proxies you
//   operate in front of the app; the client is then the entry that many
//   places from the RIGHT of x-forwarded-for (each proxy appends the address
//   it saw, so everything left of that is client-controlled).
// - Neither set: no header is trusted and null is returned.
export type HeaderReader = (name: string) => string | null | undefined;

export function resolveClientIp(
  get: HeaderReader,
  env: { VERCEL?: string; TRUSTED_PROXY_HOPS?: string }
): string | null {
  let raw: string | undefined;
  if (env.VERCEL === "1") {
    raw = firstToken(get("x-vercel-forwarded-for")) ?? firstToken(get("x-real-ip"));
  } else {
    const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);
    if (Number.isInteger(hops) && hops >= 1) {
      const parts = (get("x-forwarded-for") ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      raw = parts[parts.length - hops];
    }
  }
  return raw ? normalizeIp(raw) : null;
}

function firstToken(value: string | null | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

// IPv4 as-is. IPv6 is collapsed to its /64: a single subscriber routinely
// controls a whole /64, so per-address limits would be free to rotate.
export function normalizeIp(input: string): string | null {
  const ip = input.replace(/%.*$/, "").toLowerCase();
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return null;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  // Turn a dotted-quad tail into two hex groups so groups can be counted.
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  let text = ip;
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    text = ip.slice(0, tail.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, rest] = text.split("::");
  const headGroups = head ? head.split(":") : [];
  const restGroups = rest === undefined ? [] : rest ? rest.split(":") : [];
  const fill = rest === undefined ? 0 : 8 - headGroups.length - restGroups.length;
  const groups = [...headGroups, ...Array(Math.max(0, fill)).fill("0"), ...restGroups];
  if (groups.length !== 8) return null;
  return groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":") + "::/64";
}
