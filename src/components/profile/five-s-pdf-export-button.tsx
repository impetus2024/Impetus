"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Downloads via fetch + blob instead of a plain <a href> so the button can
// show a real loading state and surface a toast on failure (a bare download
// link gives no hook for either — the browser just does its own thing).
export function FiveSPdfExportButton({ playerId }: { playerId: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const response = await fetch(`/api/five-s/report/${playerId}`);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error ?? "Couldn't generate the PDF. Please try again.");
        return;
      }

      const blob = await response.blob();
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "5S-Report.pdf";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't generate the PDF. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
      {pending ? <Loader2 className="animate-spin" /> : <Download />}
      {pending ? "Preparing PDF..." : "Export PDF"}
    </Button>
  );
}
