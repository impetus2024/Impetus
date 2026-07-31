import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { randomUUID } from "crypto";
import { isRateLimited, recordAttempt } from "@/lib/auth/rate-limit";

// Cloudflare R2 (S3-compatible). "public" objects (centre logos) are served
// via R2_PUBLIC_URL and readable by anyone with the URL — that's the whole
// point, keep genuinely sensitive files out of that bucket. "private"
// objects (Aadhaar, medical records, injury reports, staff/profile docs)
// are only ever handed out as short-lived signed URLs.
//
// R2_PRIVATE_BUCKET_NAME is optional: if unset, both visibilities share
// R2_BUCKET_NAME (today's single-bucket setup — private files stay
// "private" only in the sense that their key is an unguessable UUID, not
// because the bucket enforces it, since enabling public access on R2 is
// bucket-wide). Setting R2_PRIVATE_BUCKET_NAME to a second bucket with
// public access left off gives private documents a real access boundary
// instead of relying on that.
type Visibility = "public" | "private";

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // The AWS SDK's default HTTP handler has no timeout at all — an
    // unreachable R2 endpoint would otherwise hang the request (and the
    // Server Action awaiting it) indefinitely instead of failing visibly.
    // maxAttempts keeps the SDK's own default retry-with-backoff behavior
    // for transient failures (explicit here so it isn't silently relied on).
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000,
      requestTimeout: 15000,
    }),
    maxAttempts: 3,
  });
}

function bucketFor(visibility: Visibility) {
  const name =
    visibility === "private"
      ? (process.env.R2_PRIVATE_BUCKET_NAME ?? process.env.R2_BUCKET_NAME)
      : process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME is not set");
  return name;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// Every upload in this app is either a photo/scan of an ID document or a
// profile/logo image — nothing here legitimately needs to be HTML, SVG
// (can carry <script>), or an executable. Content-Type is never trusted
// from the client: `file.type` is spoofable from a raw request, so the
// actual bytes are sniffed against each signature below and the upload is
// rejected if they don't match one of these regardless of what the
// browser claimed.
const ALLOWED_TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": {
    ext: "png",
    magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  "image/webp": {
    ext: "webp",
    magic: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  "application/pdf": {
    ext: "pdf",
    magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
};

// Thrown for any rejection the caller should show back to the user (as
// opposed to a genuine R2/network failure) — callers can catch this
// specifically to surface e.g. err.message in a form error.
export class UploadValidationError extends Error {}

// folder e.g. "centre-logos", "player-documents/<playerId>". Defaults to
// "private" — callers have to opt into "public" explicitly (only centre
// logos do today), so a new call site is secure by default.
//
// actorId (the uploading user's profile id, not the record being written
// to) is optional only because a couple of call sites predate this check —
// every current caller passes it. Rate-limited here rather than per call
// site so every upload path (player/staff documents, injury reports, centre
// logos) gets the same throttle for free instead of each one reimplementing
// it.
export async function uploadFile(
  file: File,
  folder: string,
  visibility: Visibility = "private",
  actorId?: string
): Promise<string> {
  if (actorId) {
    const rateLimitKey = `upload:${actorId}`;
    const rateLimit = isRateLimited(rateLimitKey);
    if (rateLimit.limited) {
      throw new UploadValidationError(
        `Too many uploads — try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.`
      );
    }
    recordAttempt(rateLimitKey);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      `File is too large — max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const declared = ALLOWED_TYPES[file.type];
  const matchedType =
    declared && declared.magic(bytes)
      ? file.type
      : Object.entries(ALLOWED_TYPES).find(([, t]) => t.magic(bytes))?.[0];

  if (!matchedType) {
    throw new UploadValidationError(
      "Unsupported file — only JPG, PNG, WebP, and PDF files are allowed."
    );
  }

  const key = `${folder}/${randomUUID()}.${ALLOWED_TYPES[matchedType].ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketFor(visibility),
      Key: key,
      Body: bytes,
      // The sniffed type, never the client-declared one — see ALLOWED_TYPES.
      ContentType: matchedType,
      // Public objects (centre logos) are content-addressed — the key is a
      // fresh UUID every upload, never overwritten — so they can be cached
      // indefinitely. Private objects (Aadhaar, medical records, injury
      // reports) are only ever fetched through short-lived signed URLs;
      // "private" here tells any intermediary (browser, CDN in front of the
      // bucket) not to cache the response for anyone else.
      CacheControl:
        visibility === "public"
          ? "public, max-age=31536000, immutable"
          : "private, max-age=0, no-store",
    })
  );

  return key;
}

export async function deleteFile(key: string, visibility: Visibility = "private"): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucketFor(visibility), Key: key })
  );
}

export function getPublicFileUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error("R2_PUBLIC_URL is not set");
  return `${base.replace(/\/$/, "")}/${key}`;
}

export async function getSignedFileUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketFor("private"), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

// Used by the health check endpoint (/api/health) — confirms R2 is
// reachable and the configured credentials/bucket are valid without
// touching any object data. Bounded to a short timeout of its own so a
// slow/unreachable R2 can't make the health endpoint itself hang past
// what an uptime monitor's own timeout would tolerate.
export async function checkStorageHealth(timeoutMs = 3000): Promise<boolean> {
  try {
    await getClient().send(new HeadBucketCommand({ Bucket: bucketFor("public") }), {
      requestTimeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}
