import "server-only";
import { getSignedFileUrl } from "@/lib/storage/r2";
import { logError } from "@/lib/logger";

// Shared by every page that resolves a batch of stored document keys into
// signed URLs for display (player docs, staff docs, injury reports) — a
// missing/failed link is tolerated (R2 not configured locally is normal),
// but now logged instead of vanishing, so a genuine credential/network
// failure in production is visible somewhere.
export async function resolveDocumentLinks(
  docKeys: Record<string, string | null | undefined>
): Promise<Record<string, string>> {
  const links: Record<string, string> = {};

  for (const [label, key] of Object.entries(docKeys)) {
    if (!key) continue;
    try {
      links[label] = await getSignedFileUrl(key);
    } catch (err) {
      logError(`Failed to sign document URL for "${label}" (${key}):`, err);
    }
  }

  return links;
}
