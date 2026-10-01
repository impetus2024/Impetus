import "server-only";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";
import type { DocumentLink, DocumentLinks } from "@/lib/storage/document-link";

// Resolves one stored document key into what the UI shows for it: nothing
// when there is no document, otherwise a signed URL — or "unavailable" when
// signing fails (R2 not configured locally, credentials, network). The
// failure is logged with the key server-side only; the client just learns
// that the document exists but can't be opened right now.
export async function resolveDocumentLink(
  label: string,
  key: string | null | undefined
): Promise<DocumentLink | undefined> {
  if (!key) return undefined;
  try {
    return { status: "available", url: await getSignedFileUrl(key) };
  } catch (err) {
    logError(`Failed to sign document URL for "${label}" (${key}):`, err);
    return { status: "unavailable" };
  }
}

// Shared by every page that resolves a batch of stored document keys for
// display (player docs, staff docs). Labels with no document are left out.
export async function resolveDocumentLinks<Label extends string>(
  docKeys: Record<Label, string | null | undefined>
): Promise<DocumentLinks<Label>> {
  const links: DocumentLinks<Label> = {};

  for (const [label, key] of Object.entries(docKeys) as [Label, string | null | undefined][]) {
    const link = await resolveDocumentLink(label, key);
    if (link) links[label] = link;
  }

  return links;
}
