import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth/dal";
import { getFiveSReportData, getFiveSReportMeta } from "@/lib/five-s/report-data";
import { FiveSReportDocument } from "@/lib/five-s/pdf/five-s-report-document";
import { logError } from "@/lib/logger";

// renderToBuffer needs Node's Buffer/fs APIs — not available on the Edge
// runtime.
export const runtime = "nodejs";

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;

  // requireRole redirects (not throws-as-401) on failure, matching every
  // other 5S entry point — an unauthenticated/wrong-role request lands on a
  // login or dashboard HTML page instead of a PDF, which the client button
  // treats as a failed export.
  const profile = await requireRole("coach", "parent", "centre_admin", "staff", "finance");

  // Same publish-gate FiveSResultsView applies for every role except coach
  // (coaches always see their own recorded data — see gateUntilPublished's
  // doc comment on FiveSResultsView).
  const gateUntilPublished = profile.role !== "coach";

  const [meta, report] = await Promise.all([getFiveSReportMeta(playerId), getFiveSReportData(playerId)]);

  // meta is null when RLS scopes the caller out of this player entirely
  // (wrong batch/centre/child) — same as the page-level 404s elsewhere.
  if (!meta) return errorResponse(404, "Player not found.");

  if (gateUntilPublished && !meta.publishedAt) {
    return errorResponse(404, "The coach hasn't published this player's 5S results yet.");
  }

  if (!report.hasData) {
    return errorResponse(404, "No 5S results have been recorded for this player yet.");
  }

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(FiveSReportDocument({ meta, report }));
  } catch (error) {
    logError("5S PDF export: renderToBuffer failed", { playerId, error });
    return errorResponse(500, "Couldn't generate the PDF. Please try again.");
  }

  const safeName = meta.playerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "player";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="5S-Report-${safeName}.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}
