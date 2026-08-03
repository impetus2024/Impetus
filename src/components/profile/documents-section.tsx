import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Document",
  medicalRecords: "Medical Records",
  profilePicture: "Profile Picture",
};

// View-only: lists whichever of the player's uploaded documents actually
// have a signed link (resolveDocumentLinks already drops any that are
// missing or failed to sign), so nothing needs a fetch of its own here.
export function DocumentsSection({ documentLinks }: { documentLinks: Record<string, string> }) {
  const entries = Object.entries(DOC_LABELS).filter(([key]) => documentLinks[key]);

  if (entries.length === 0) {
    return <EmptyState icon={FileText} title="No documents uploaded" />;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, label]) => (
        <div key={key} className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <a
            href={documentLinks[key]}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            View
          </a>
        </div>
      ))}
    </div>
  );
}
