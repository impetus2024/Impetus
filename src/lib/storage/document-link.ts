// How a stored document reaches the UI. A record with no document has no
// entry at all (a missing key in DocumentLinks); a record that DOES reference
// a document is always one of these two, so a signing failure can never make
// an existing document look like it was never uploaded. "unavailable" carries
// no storage key or error detail — nothing about the private object (or why
// signing failed) is sent to the client; the server log has that.
export type DocumentLink = { status: "available"; url: string } | { status: "unavailable" };

export type DocumentLinks<Label extends string = string> = Partial<Record<Label, DocumentLink>>;

// For places that can only use a URL (an <img>/avatar src): no URL when the
// document is missing or unavailable, so they fall back as they would today.
export function documentUrl(link: DocumentLink | undefined): string | undefined {
  return link?.status === "available" ? link.url : undefined;
}
