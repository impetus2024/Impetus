import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getFiveSTests, getFiveSQuestions } from "@/lib/five-s/catalog";
import { computeFiveSScores, getStaminaBenchmarkContext, getSpeedBenchmarkContext, getStrengthBenchmarkContext, type FiveSScores } from "@/lib/five-s/scores";
import { calculateAge } from "@/lib/age";
import { FIVE_S_RADAR_AXES } from "@/components/profile/five-s-radar-section";
import { FIVE_S_CATEGORY_META } from "@/lib/five-s/categories";

type FiveSTest = Awaited<ReturnType<typeof getFiveSTests>>[number];
type FiveSQuestion = Awaited<ReturnType<typeof getFiveSQuestions>>[number];

export type FiveSTestResult = {
  score: number | null;
  level: number | null;
  shuttle: number | null;
  vo2_max: number | null;
  remarks: string | null;
  recorded_at: string;
};

export type FiveSTestRow = {
  id: string;
  name: string;
  unit: string;
  result: FiveSTestResult | null;
};

export type FiveSTestGroup = {
  label: string;
  remarks: string | null;
  tests: FiveSTestRow[];
};

export type FiveSTestSection = {
  category: string;
  categoryLabel: string;
  overallRemarks: string | null;
  // The category's 1-5 score, exactly as plotted on the radar: benchmark-
  // derived for speed/stamina/strength, the coach-entered half-star rating
  // for skill. Null when nothing has been recorded for this category yet.
  rating: number | null;
  groups: FiveSTestGroup[];
};

export type FiveSQuestionRow = {
  id: string;
  question: string;
  answer: string | null;
};

export type FiveSQuestionGroup = {
  label: string;
  questions: FiveSQuestionRow[];
};

export type FiveSQuestionSection = {
  category: string;
  categoryLabel: string;
  // The category's 1-5 score, exactly as plotted on the radar — for
  // question-based categories (spirit) that is the coach-entered half-star
  // rating. Null when nothing has been recorded for this category yet.
  rating: number | null;
  groups: FiveSQuestionGroup[];
};

export type FiveSReportData = {
  hasData: boolean;
  radar: FiveSScores;
  testSections: FiveSTestSection[];
  questionSections: FiveSQuestionSection[];
};

function categoryLabel(category: string) {
  return FIVE_S_CATEGORY_META[category as keyof typeof FIVE_S_CATEGORY_META]?.label ?? category;
}

// Groups a category's tests into their group_name subsections (e.g.
// Strength's Flexibility Test / Strength Test / Power Test), same
// adjacent-run grouping FiveSResultsView renders from. Falls back to a
// single unlabeled group when tests have no group_name.
function groupTests(categoryTests: FiveSTest[]): { label: string; tests: FiveSTest[] }[] {
  const groups: { label: string; tests: FiveSTest[] }[] = [];
  for (const test of categoryTests) {
    const label = test.group_name ?? "";
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.tests.push(test);
    } else {
      groups.push({ label, tests: [test] });
    }
  }
  return groups;
}

function groupQuestions(categoryQuestions: FiveSQuestion[]): { label: string; questions: FiveSQuestion[] }[] {
  const sections: { label: string; questions: FiveSQuestion[] }[] = [];
  for (const question of categoryQuestions) {
    const current = sections[sections.length - 1];
    if (current && current.label === question.section) {
      current.questions.push(question);
    } else {
      sections.push({ label: question.section, questions: [question] });
    }
  }
  return sections;
}

// Single source of truth for a player's 5S results, shared by the on-screen
// FiveSResultsView and the PDF export — both render the same fetched/scored
// data, just to different targets (JSX vs. a PDF document), so scoring and
// grouping logic never drifts between the two.
export async function getFiveSReportData(playerId: string): Promise<FiveSReportData> {
  const supabase = await createClient();

  const [
    tests,
    { data: results },
    { data: notes },
    { data: groupNotes },
    questions,
    { data: responses },
  ] = await Promise.all([
    getFiveSTests(),
    supabase
      .from("five_s_results")
      // level/shuttle/vo2_max are retained for legacy Beep Test / Cooper Test historical results.
      // New Stamina tests (Yo-Yo, RSA) store null for these fields.
      .select("test_id, score, level, shuttle, vo2_max, remarks, recorded_at, previous_score")
      .eq("player_id", playerId),
    supabase.from("five_s_category_notes").select("category, remarks, rating").eq("player_id", playerId),
    supabase.from("five_s_group_notes").select("category, group_name, remarks").eq("player_id", playerId),
    getFiveSQuestions(),
    supabase
      .from("five_s_question_responses")
      .select("question_id, answer")
      .eq("player_id", playerId),
  ]);

  const hasData = tests.length > 0 || questions.length > 0;
  if (!hasData) {
    return {
      hasData: false,
      radar: { current: {}, previous: {}, hasPrevious: false, assessed: {} },
      testSections: [],
      questionSections: [],
    };
  }

  const resultByTest = new Map((results ?? []).map((r) => [r.test_id, r]));
  const noteByCategory = new Map((notes ?? []).map((n) => [n.category, n.remarks]));
  const ratingByCategory = new Map(
    (notes ?? []).flatMap((n) => (n.rating != null ? [[n.category, n.rating] as const] : []))
  );
  const groupNoteByKey = new Map((groupNotes ?? []).map((n) => [`${n.category}::${n.group_name}`, n.remarks]));
  const responseByQuestion = new Map((responses ?? []).map((r) => [r.question_id, r.answer]));

  const categories = [...new Set(tests.map((t) => t.category))];
  const questionCategories = [...new Set(questions.map((q) => q.category))];

  const staminaTestIds = tests.filter((t) => t.category === "stamina").map((t) => t.id);
  const speedTestIds = tests.filter((t) => t.category === "speed").map((t) => t.id);
  const strengthTestIds = tests.filter((t) => t.category === "strength").map((t) => t.id);
  const [staminaContext, speedContext, strengthContext] = await Promise.all([
    getStaminaBenchmarkContext(supabase, playerId, staminaTestIds),
    getSpeedBenchmarkContext(supabase, playerId, speedTestIds),
    getStrengthBenchmarkContext(supabase, playerId, strengthTestIds),
  ]);

  const radar = computeFiveSScores(
    FIVE_S_RADAR_AXES.map((a) => a.key),
    tests,
    questions,
    resultByTest,
    responseByQuestion,
    staminaContext,
    ratingByCategory,
    speedContext,
    strengthContext
  );

  // The badge next to a category heading must show the same 1-5 the radar
  // plots for that category: benchmark-derived for speed/stamina/strength,
  // the coach's half-star rating for skill/spirit. Reading
  // five_s_category_notes.rating directly only ever produced a value for the
  // latter two, so every benchmark-based category rendered without a rating
  // despite having a computed score. `assessed` gates it, so a category with
  // nothing recorded shows no badge rather than 0.
  const categoryRating = (category: string): number | null =>
    radar.assessed[category] ? (radar.current[category] ?? null) : null;

  const testSections: FiveSTestSection[] = categories.map((category) => {
    const categoryTests = tests.filter((t) => t.category === category);
    return {
      category,
      categoryLabel: categoryLabel(category),
      overallRemarks: noteByCategory.get(category) ?? null,
      rating: categoryRating(category),
      groups: groupTests(categoryTests).map((group) => ({
        label: group.label,
        remarks: group.label ? (groupNoteByKey.get(`${category}::${group.label}`) ?? null) : null,
        tests: group.tests.map((test) => ({
          id: test.id,
          name: test.name,
          unit: test.unit,
          result: resultByTest.get(test.id) ?? null,
        })),
      })),
    };
  });

  const questionSections: FiveSQuestionSection[] = questionCategories.map((category) => {
    const categoryQuestions = questions.filter((q) => q.category === category);
    return {
      category,
      categoryLabel: categoryLabel(category),
      rating: categoryRating(category),
      groups: groupQuestions(categoryQuestions).map((section) => ({
        label: section.label,
        questions: section.questions.map((question) => ({
          id: question.id,
          question: question.question,
          answer: responseByQuestion.get(question.id) ?? null,
        })),
      })),
    };
  });

  return { hasData: true, radar, testSections, questionSections };
}

export type FiveSReportMeta = {
  playerName: string;
  centreName: string | null;
  batchName: string | null;
  age: number | null;
  publishedAt: string | null;
} | null;

// Identity/header info for the PDF export — kept separate from
// getFiveSReportData because the on-screen view never needs it (the page
// shells around FiveSResultsView already show the player's name in their
// own header). RLS-scoped like everything else here, so this returns null
// for a player the caller can't see rather than leaking a 403 vs 404
// distinction.
export async function getFiveSReportMeta(playerId: string): Promise<FiveSReportMeta> {
  const supabase = await createClient();

  const [{ data: player }, { data: report }] = await Promise.all([
    supabase
      .from("players")
      .select("name, date_of_birth, centres(name), batches!players_batch_id_fkey(name)")
      .eq("id", playerId)
      .maybeSingle(),
    supabase.from("five_s_reports").select("published_at").eq("player_id", playerId).maybeSingle(),
  ]);

  if (!player) return null;

  return {
    playerName: player.name,
    centreName: player.centres?.name ?? null,
    batchName: player.batches?.name ?? null,
    age: player.date_of_birth ? calculateAge(player.date_of_birth) : null,
    publishedAt: report?.published_at ?? null,
  };
}
