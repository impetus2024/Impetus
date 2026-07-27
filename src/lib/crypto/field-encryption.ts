import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM field-level encryption for Aadhaar/passport numbers. Ciphertext
// layout (base64): iv (12 bytes) || authTag (16 bytes) || encrypted data.
// The key never touches the database — only this process's env holds it.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("FIELD_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptField(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
