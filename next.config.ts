import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Built once at config-eval time (not per-request) — safe since these are
// build/deploy-time env vars, not user input.
function buildCsp() {
  const connectSrc = ["'self'", "https://cloudflareinsights.com"];
  const imgSrc = ["'self'", "data:"];
  const scriptSrc = ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"];
  // React's dev mode (hot reload, component-stack reconstruction) relies on
  // eval() — never used in a production build. Scoped to non-production so
  // the deployed CSP stays as strict as before.
  if (process.env.NODE_ENV !== "production") {
    scriptSrc.push("'unsafe-eval'");
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    connectSrc.push(process.env.NEXT_PUBLIC_SUPABASE_URL);
  }
  if (process.env.R2_PUBLIC_URL) {
    try {
      imgSrc.push(new URL(process.env.R2_PUBLIC_URL).origin);
    } catch {
      // malformed env var — ignore rather than crash the build over it
    }
  }
  // Private objects (profile pictures, Aadhaar, medical records, staff
  // docs) are served as short-lived signed URLs straight off R2's S3 API
  // endpoint (see getSignedFileUrl in r2.ts), not through R2_PUBLIC_URL —
  // that's a different origin and needs its own allow-list entry, or every
  // <img> pointed at a signed URL gets silently blocked by img-src.
  if (process.env.R2_ACCOUNT_ID) {
    imgSrc.push(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  }

  return [
    `default-src 'self'`,
    // Next.js's own bootstrap/hydration scripts need 'unsafe-inline' short
    // of a nonce-based CSP wired through middleware (bigger lift than this
    // pass) — still meaningfully restricts cross-origin script/object
    // loading and clickjacking (frame-ancestors) even without that.
    // static.cloudflareinsights.com is Cloudflare's edge-injected Web
    // Analytics beacon (added when the zone is proxied through Cloudflare,
    // not something this app loads itself) — allow-listed here, and its
    // reporting endpoint in connect-src, so it isn't CSP-blocked.
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(" ")}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
  ].join("; ");
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Calibrated to the worst-case *legitimate* submission, not a single
      // file: the administrator form submits up to 4 documents in one
      // request (aadhaarCard, birthCertificate, profilePicture,
      // otherDocuments — see add-administrator-dialog.tsx), each up to
      // MAX_UPLOAD_BYTES (10MB, src/lib/storage/r2.ts). 4 x 10MB + margin
      // for multipart overhead and the form's text fields. Below this, the
      // per-file 10MB cap + type validation in r2.ts is what actually does
      // the security work; this just has to not reject a real multi-file
      // submission before that validation gets to run.
      bodySizeLimit: "45mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Wraps the config with Sentry's build-time instrumentation (source map
// upload, request tracing). Silent and org/project/authToken all fall back
// to no-ops when unset, so this is harmless in any environment that hasn't
// configured Sentry — see sentry.*.config.ts for the runtime (Sentry.init)
// side, which is what actually determines whether anything gets sent.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
