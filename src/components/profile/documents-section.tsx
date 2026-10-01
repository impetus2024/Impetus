import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { DocumentLink, DocumentLinks } from "@/lib/storage/document-link";

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Document",
  medicalRecords: "Medical Records",
  profilePicture: "Profile Picture",
};

export const DOCUMENT_UNAVAILABLE_TEXT = "Unavailable right now — try again later";

// Renders one existing document: a link when a signed URL was generated, or
// a plain notice when the document exists but its link couldn't be — never
// the "nothing uploaded" state, which callers render when there's no entry.
export function DocumentLinkView({
  link,
  label,
  className = "underline",
}: {
  link: DocumentLink;
  label: string;
  className?: string;
}) {
  if (link.status === "unavailable") {
    return <span className="text-muted-foreground">{DOCUMENT_UNAVAILABLE_TEXT}</span>;
  }
  return (
    <a href={link.url} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  );
}

// View-only: lists whichever of the player's documents exist — with a link,
// or marked unavailable when its link couldn't be generated (see
// resolveDocumentLinks) — so nothing needs a fetch of its own here.
export function DocumentsSection({ documentLinks }: { documentLinks: DocumentLinks }) {
  const entries = Object.entries(DOC_LABELS).flatMap(([key, label]) => {
    const link = documentLinks[key];
    return link ? [{ key, label, link }] : [];
  });

  if (entries.length === 0) {
    return <EmptyState icon={FileText} title="No documents uploaded" />;
  }

  return (
    <div className="space-y-3">
      {entries.map(({ key, label, link }) => (
        <div key={key} className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm">
            <DocumentLinkView link={link} label="View" className="text-primary underline underline-offset-4" />
          </span>
        </div>
      ))}
    </div>
  );
}
