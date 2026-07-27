import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// Cloudflare R2 (S3-compatible). Public assets (centre logos, profile
// pictures) are served via R2_PUBLIC_URL. Sensitive documents (Aadhaar,
// medical records, injury reports) are stored in the same bucket but only
// ever handed out as short-lived signed URLs — never construct a public URL
// for those, callers must go through getSignedFileUrl.
function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function bucket() {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME is not set");
  return name;
}

// folder e.g. "centre-logos", "player-documents/<playerId>"
export async function uploadFile(
  file: File,
  folder: string
): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${folder}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return key;
}

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key })
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
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
