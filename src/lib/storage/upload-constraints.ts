// Client-safe mirror of the limits r2.ts enforces server-side. r2.ts is
// "server-only" and can't be imported from client components, so both sides
// import the actual numbers from here instead of duplicating them (and
// risking the client-shown hint drifting from what the server actually
// accepts).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

export const DOCUMENT_TYPES_LABEL = "JPG, PNG, WebP, or PDF";
export const IMAGE_TYPES_LABEL = "JPG, PNG, or WebP";
