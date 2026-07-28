import { createClient } from "@/lib/supabase/server";
import { FiveSPlaceholder } from "@/components/profile/five-s-placeholder";

const CATEGORY_LABEL: Record<string, string> = {
  speed: "Speed",
  stamina: "Stamina",
  strength: "Strength",
  spirit: "Spirit",
  skill: "Skill",
};

const ANSWER_LABEL: Record<string, string> = {
  rarely: "Rarely",
  sometimes: "Sometimes",
  frequently: "Frequently",
  always: "Always",
};

// Renders whichever 5S categories actually have test definitions — only
// Speed exists today. Adding Stamina/Strength/Spirit/Skill later needs no
// change here: this groups by whatever rows five_s_tests actually has.
export async function FiveSResultsView({ playerId }: { playerId: string }) {
  const supabase = await createClient();

  const [
    { data: tests },
    { data: results },
    { data: notes },
    { data: groupNotes },
    { data: questions },
    { data: responses },
  ] = await Promise.all([
    supabase
      .from("five_s_tests")
      .select("id, category, name, unit, group_name, display_order")
      .order("display_order"),
    supabase
      .from("five_s_results")
      .select("test_id, score, vo2_max, remarks, recorded_at")
      .eq("player_id", playerId),
    supabase.from("five_s_category_notes").select("category, remarks").eq("player_id", playerId),
    supabase.from("five_s_group_notes").select("category, group_name, remarks").eq("player_id", playerId),
    supabase
      .from("five_s_questions")
      .select("id, category, section, question, display_order")
      .order("display_order"),
    supabase
      .from("five_s_question_responses")
      .select("question_id, answer")
      .eq("player_id", playerId),
  ]);

  const hasTests = tests && tests.length > 0;
  const hasQuestions = questions && questions.length > 0;

  if (!hasTests && !hasQuestions) {
    return <FiveSPlaceholder />;
  }

  const resultByTest = new Map(
    (results ?? []).map((r) => [r.test_id, r])
  );
  const noteByCategory = new Map((notes ?? []).map((n) => [n.category, n.remarks]));
  const groupNoteByKey = new Map((groupNotes ?? []).map((n) => [`${n.category}::${n.group_name}`, n.remarks]));
  const responseByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));

  const categories = [...new Set((tests ?? []).map((t) => t.category))];
  const questionCategories = [...new Set((questions ?? []).map((q) => q.category))];

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const categoryTests = (tests ?? []).filter((t) => t.category === category);
        const overallRemarks = noteByCategory.get(category);

        // Subsection groups within a category (e.g. Strength's Flexibility
        // Test / Strength Test / Power Test). Falls back to a single
        // unlabeled group when tests have no group_name.
        const subgroups: { label: string; tests: typeof categoryTests }[] = [];
        for (const test of categoryTests) {
          const label = test.group_name ?? "";
          const current = subgroups[subgroups.length - 1];
          if (current && current.label === label) {
            current.tests.push(test);
          } else {
            subgroups.push({ label, tests: [test] });
          }
        }

        return (
          <div key={category}>
            <h3 className="text-lg font-semibold">{CATEGORY_LABEL[category] ?? category}</h3>
            <div className="mt-3 space-y-5">
              {subgroups.map((group) => {
                const groupRemarks = group.label
                  ? groupNoteByKey.get(`${category}::${group.label}`)
                  : undefined;
                return (
                  <div key={group.label}>
                    {group.label && (
                      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{group.label}</h4>
                    )}
                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                      {group.tests.map((test) => {
                        const result = resultByTest.get(test.id);
                        return (
                          <div key={test.id}>
                            <p className="mb-1.5 text-sm font-medium text-foreground">{test.name}</p>
                            <div className="flex min-h-9 items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                              <span className={result ? "text-foreground" : "text-muted-foreground"}>
                                {result ? `${result.score} ${test.unit}`.trim() : "Not recorded yet"}
                              </span>
                              {result && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(result.recorded_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {result?.vo2_max != null && (
                              <p className="mt-1 text-xs text-muted-foreground">VO2 Max: {result.vo2_max}</p>
                            )}
                            {result?.remarks && (
                              <p className="mt-1 text-xs text-muted-foreground">Remarks: {result.remarks}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {groupRemarks && (
                      <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">Remarks</p>
                        <p className="mt-0.5 text-foreground">{groupRemarks}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {overallRemarks && (
              <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Overall Remarks</p>
                <p className="mt-0.5 text-foreground">{overallRemarks}</p>
              </div>
            )}
          </div>
        );
      })}

      {questionCategories.map((category) => {
        const categoryQuestions = (questions ?? []).filter((q) => q.category === category);

        const sections: { label: string; questions: typeof categoryQuestions }[] = [];
        for (const question of categoryQuestions) {
          const current = sections[sections.length - 1];
          if (current && current.label === question.section) {
            current.questions.push(question);
          } else {
            sections.push({ label: question.section, questions: [question] });
          }
        }

        return (
          <div key={category}>
            <h3 className="text-lg font-semibold">{CATEGORY_LABEL[category] ?? category}</h3>
            <div className="mt-3 space-y-5">
              {sections.map((section) => (
                <div key={section.label}>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{section.label}</h4>
                  <div className="space-y-2">
                    {section.questions.map((question) => {
                      const answer = responseByQuestion.get(question.id);
                      return (
                        <div
                          key={question.id}
                          className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                        >
                          <span className="text-foreground">{question.question}</span>
                          <span
                            className={
                              answer
                                ? "shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                                : "shrink-0 text-xs text-muted-foreground"
                            }
                          >
                            {answer ? ANSWER_LABEL[answer] : "Not recorded"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
