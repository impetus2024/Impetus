import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFiveSReportData } from "@/lib/five-s/report-data";
import { FiveSPlaceholder } from "@/components/profile/five-s-placeholder";
import { FiveSRadarSection } from "@/components/profile/five-s-radar-section";
import { FiveSPdfExportButton } from "@/components/profile/five-s-pdf-export-button";

const ANSWER_LABEL: Record<string, string> = {
  rarely: "Rarely",
  sometimes: "Sometimes",
  frequently: "Frequently",
  always: "Always",
};

// Renders whichever 5S categories actually have test definitions — only
// Speed exists today. Adding Stamina/Strength/Spirit/Skill later needs no
// change here: this groups by whatever rows five_s_tests actually has.
export async function FiveSResultsView({
  playerId,
  gateUntilPublished = false,
}: {
  playerId: string;
  /** Centre admin/parent views only — coaches always see their own data.
   * Scores are coach-private until published (RLS enforces this on the
   * underlying tables regardless), so this also renders a clear "not
   * published yet" state instead of what would otherwise look like an
   * empty/unrecorded results page. */
  gateUntilPublished?: boolean;
}) {
  const supabase = await createClient();

  if (gateUntilPublished) {
    const { data: report } = await supabase
      .from("five_s_reports")
      .select("id")
      .eq("player_id", playerId)
      .maybeSingle();
    if (!report) {
      return (
        <FiveSPlaceholder
          title="5S report not published yet"
          message="The coach hasn't published this player's 5S results yet — check back once they do."
        />
      );
    }
  }

  const report = await getFiveSReportData(playerId);

  if (!report.hasData) {
    return <FiveSPlaceholder />;
  }

  const { current: currentScores, previous: previousScores, hasPrevious } = report.radar;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <FiveSPdfExportButton playerId={playerId} />
      </div>

      <FiveSRadarSection current={currentScores} previous={previousScores} showPrevious={hasPrevious} />

      {report.testSections.map((section) => (
        <div key={section.category}>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{section.categoryLabel}</h3>
            {section.rating != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Star className="size-3 fill-current" />
                {section.rating} / 5
              </span>
            )}
          </div>
          <div className="mt-3 space-y-5">
            {section.groups.map((group) => (
              <div key={group.label}>
                {group.label && (
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{group.label}</h4>
                )}
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  {group.tests.map((test) => (
                    <div key={test.id}>
                      <p className="mb-1.5 text-sm font-medium text-foreground">{test.name}</p>
                      <div className="flex min-h-9 items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                        <span className={test.result ? "text-foreground" : "text-muted-foreground"}>
                          {test.result
                            ? test.unit === "level"
                              ? `Level ${test.result.level} / Shuttle ${test.result.shuttle}`
                              : `${test.result.score} ${test.unit}`.trim()
                            : "Not recorded yet"}
                        </span>
                        {test.result && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(test.result.recorded_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {test.result?.vo2_max != null && (
                        <p className="mt-1 text-xs text-muted-foreground">VO2 Max: {test.result.vo2_max}</p>
                      )}
                      {test.result?.remarks && (
                        <p className="mt-1 text-xs text-muted-foreground">Remarks: {test.result.remarks}</p>
                      )}
                    </div>
                  ))}
                </div>
                {group.remarks && (
                  <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Remarks</p>
                    <p className="mt-0.5 text-foreground">{group.remarks}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {section.overallRemarks && (
            <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Overall Remarks</p>
              <p className="mt-0.5 text-foreground">{section.overallRemarks}</p>
            </div>
          )}
        </div>
      ))}

      {report.questionSections.map((section) => (
        <div key={section.category}>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{section.categoryLabel}</h3>
            {section.rating != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Star className="size-3 fill-current" />
                {section.rating} / 5
              </span>
            )}
          </div>
          <div className="mt-3 space-y-5">
            {section.groups.map((group) => (
              <div key={group.label}>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{group.label}</h4>
                <div className="space-y-2">
                  {group.questions.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{question.question}</span>
                      <span
                        className={
                          question.answer
                            ? "shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                            : "shrink-0 text-xs text-muted-foreground"
                        }
                      >
                        {question.answer ? ANSWER_LABEL[question.answer] : "Not recorded"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
