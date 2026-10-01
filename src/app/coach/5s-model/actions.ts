"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { isFiveSWindowOpen } from "@/lib/five-s/testing-window";
import { getFiveSTests, getFiveSQuestions } from "@/lib/five-s/catalog";
import { logError } from "@/lib/logger";

// Shared by submitSkillScores/submitSpiritResponses — the coach-entered
// overall category rating (five_s_category_notes.rating) that drives the
// radar graph for Skill/Spirit (see computeFiveSScores). Returns null for
// anything not a valid 1-5, half-star-step number, same "reject rather than
// silently clamp/round" stance as every other score input in this file.
function validateCategoryRating(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 5) return null;
  if (Math.round(value * 2) !== value * 2) return null;
  return value;
}

// Shared by every score/response-submitting action below — score entry
// (not publishing) only happens while the centre admin's 5S testing
// window is open. Re-checked here server-side since the disabled state of
// the "Update Score" button is just a UI courtesy.
async function assertTestingWindowOpen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  centreId: string
): Promise<string | null> {
  const { data: centre } = await supabase
    .from("centres")
    .select("five_s_window_start, five_s_window_end")
    .eq("id", centreId)
    .single();
  if (!isFiveSWindowOpen(centre?.five_s_window_start ?? null, centre?.five_s_window_end ?? null)) {
    return "The 5S testing window is closed. Contact your centre admin.";
  }
  return null;
}

// A test is frozen once any coach has recorded it — see the split
// five_s_results RLS policies in the player_batches migration. Re-checked
// here (not just left to RLS) because a multi-row upsert is one SQL
// statement: if RLS rejected even one locked row inside it, Postgres would
// fail the whole statement, blocking the coach's other, legitimately-own
// rows too. Filtering locked test ids out before the upsert keeps a
// same-submission mix of own/locked tests from failing entirely.
async function getLockedTestIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
  coachId: string,
  testIds: string[]
): Promise<Set<string>> {
  if (testIds.length === 0) return new Set();
  const { data } = await supabase
    .from("five_s_results")
    .select("test_id, recorded_by")
    .eq("player_id", playerId)
    .in("test_id", testIds);
  return new Set((data ?? []).filter((r) => r.recorded_by !== coachId).map((r) => r.test_id));
}

export type AutoSaveResult = { error?: string; saved?: boolean };

// Auto-save for the score-entry forms: fired on blur, one test at a time, as
// the coach types. Without it a category was all-or-nothing — the submit
// actions reject the whole batch if any one field is empty, so a coach who
// filled three of four, went back to check something and returned found the
// form empty again. Saving each value as it is entered means a half-finished
// category survives that trip (and the player hub's Add/Update label, which
// is derived from whether a five_s_results row exists, reflects it).
//
// Deliberately not the submit path: no redirect (the coach stays on the
// page) and the only revalidation is the player hub. Re-saving an unchanged
// value is a no-op for the previous_score trigger, which only snapshots when
// new.score is distinct from old.score.
export async function autoSaveTestScore(
  batchId: string,
  playerId: string,
  testId: string,
  rawValue: string
): Promise<AutoSaveResult> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const score = Number(rawValue);
  if (rawValue.trim() === "" || !Number.isFinite(score) || score <= 0) {
    // Empty, or mid-edit nonsense. There is simply nothing to save yet —
    // not worth surfacing an error for.
    return {};
  }

  const lockedTestIds = await getLockedTestIds(supabase, playerId, coach.id, [testId]);
  if (lockedTestIds.has(testId)) {
    return { error: "Already recorded by another coach — locked." };
  }

  const { error } = await supabase
    .from("five_s_results")
    .upsert(
      {
        player_id: playerId,
        test_id: testId,
        centre_id: batch.centre_id,
        score,
        recorded_by: coach.id,
      },
      { onConflict: "player_id,test_id" }
    );

  if (error) {
    logError(`Failed to auto-save score for player ${playerId} test ${testId}:`, error);
    return { error: "Failed to save score." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  return { saved: true };
}

export type SpeedScoresFormState = { error?: string } | undefined;

export async function submitSpeedScores(
  batchId: string,
  playerId: string,
  _prev: SpeedScoresFormState,
  formData: FormData
): Promise<SpeedScoresFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  // Defense-in-depth: RLS already scopes five_s_results writes to the
  // coach's own batches, but checking here first gives a clear message
  // instead of a raw RLS-violation error bubbling up.
  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const submittedTestIds: string[] = [];
  for (const [key] of formData.entries()) {
    if (key.startsWith("score_")) submittedTestIds.push(key.slice("score_".length));
  }
  const lockedTestIds = await getLockedTestIds(supabase, playerId, coach.id, submittedTestIds);

  const rows: {
    player_id: string;
    test_id: string;
    centre_id: string;
    score: number;
    recorded_by: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("score_")) continue;
    const testId = key.slice("score_".length);
    if (lockedTestIds.has(testId)) continue;
    const score = Number(value);
    if (!Number.isFinite(score) || score <= 0) {
      return { error: "Enter a valid score for every test." };
    }
    rows.push({
      player_id: playerId,
      test_id: testId,
      centre_id: batch.centre_id,
      score,
      recorded_by: coach.id,
    });
  }

  if (rows.length === 0) {
    return { error: "No scores submitted." };
  }

  const { error } = await supabase
    .from("five_s_results")
    .upsert(rows, { onConflict: "player_id,test_id" });

  if (error) {
    logError(`Failed to save speed scores for player ${playerId}:`, error);
    return { error: "Failed to save scores." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

export type StrengthScoresFormState = { error?: string } | undefined;

export async function submitStrengthScores(
  batchId: string,
  playerId: string,
  _prev: StrengthScoresFormState,
  formData: FormData
): Promise<StrengthScoresFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const submittedTestIds: string[] = [];
  for (const [key] of formData.entries()) {
    if (key.startsWith("score_")) submittedTestIds.push(key.slice("score_".length));
  }
  const lockedTestIds = await getLockedTestIds(supabase, playerId, coach.id, submittedTestIds);

  const rows: {
    player_id: string;
    test_id: string;
    centre_id: string;
    score: number;
    recorded_by: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("score_")) continue;
    const testId = key.slice("score_".length);
    if (lockedTestIds.has(testId)) continue;
    const score = Number(value);
    if (!Number.isFinite(score) || score <= 0) {
      return { error: "Enter a valid score for every test." };
    }
    rows.push({
      player_id: playerId,
      test_id: testId,
      centre_id: batch.centre_id,
      score,
      recorded_by: coach.id,
    });
  }

  if (rows.length === 0) {
    return { error: "No scores submitted." };
  }

  const { error } = await supabase
    .from("five_s_results")
    .upsert(rows, { onConflict: "player_id,test_id" });

  if (error) {
    logError(`Failed to save strength scores for player ${playerId}:`, error);
    return { error: "Failed to save scores." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

export type StaminaScoresFormState = { error?: string } | undefined;

export async function submitStaminaScores(
  batchId: string,
  playerId: string,
  tests: { id: string; unit: string }[],
  _prev: StaminaScoresFormState,
  formData: FormData
): Promise<StaminaScoresFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const lockedTestIds = await getLockedTestIds(
    supabase,
    playerId,
    coach.id,
    tests.map((t) => t.id)
  );

  const rows: {
    player_id: string;
    test_id: string;
    centre_id: string;
    score: number;
    level: null;
    shuttle: null;
    vo2_max: null;
    remarks: string;
    recorded_by: string;
  }[] = [];

  // Both Stamina tests record a single number (Yo-Yo completed level, RSA
  // mean time). VO2 Max no longer applies to the new Stamina tests, so it's
  // left null; the server scores each raw value against the age band's
  // benchmark, not the client.
  for (const test of tests) {
    if (lockedTestIds.has(test.id)) continue;
    const remarks = String(formData.get(`remarks_${test.id}`) ?? "").trim();
    if (!remarks) {
      return { error: "Remarks are required for every test." };
    }

    const score = Number(formData.get(`score_${test.id}`));
    if (!Number.isFinite(score) || score <= 0) {
      return { error: "Enter a valid score for every test." };
    }

    rows.push({
      player_id: playerId,
      test_id: test.id,
      centre_id: batch.centre_id,
      score,
      level: null,
      shuttle: null,
      vo2_max: null,
      remarks,
      recorded_by: coach.id,
    });
  }

  const overallRemarks = String(formData.get("overall_remarks") ?? "").trim();
  if (!overallRemarks) {
    return { error: "Overall remarks are required." };
  }

  const { error: resultsError } = rows.length > 0
    ? await supabase.from("five_s_results").upsert(rows, { onConflict: "player_id,test_id" })
    : { error: null };

  if (resultsError) {
    logError(`Failed to save stamina scores for player ${playerId}:`, resultsError);
    return { error: "Failed to save scores." };
  }

  const { error: notesError } = await supabase.from("five_s_category_notes").upsert(
    {
      player_id: playerId,
      category: "stamina",
      centre_id: batch.centre_id,
      remarks: overallRemarks,
      recorded_by: coach.id,
    },
    { onConflict: "player_id,category" }
  );

  if (notesError) {
    logError(`Failed to save stamina overall remarks for player ${playerId}:`, notesError);
    return { error: "Failed to save overall remarks." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

const ANSWER_VALUES = ["rarely", "sometimes", "frequently", "always"] as const;
type Answer = (typeof ANSWER_VALUES)[number];

export type SpiritResponsesFormState = { error?: string } | undefined;

export async function submitSpiritResponses(
  batchId: string,
  playerId: string,
  questionIds: string[],
  _prev: SpiritResponsesFormState,
  formData: FormData
): Promise<SpiritResponsesFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const rows: {
    player_id: string;
    question_id: string;
    centre_id: string;
    answer: Answer;
    recorded_by: string;
  }[] = [];

  for (const questionId of questionIds) {
    const answer = formData.get(`answer_${questionId}`);
    if (typeof answer !== "string" || !ANSWER_VALUES.includes(answer as Answer)) {
      return { error: "Please answer every question." };
    }
    rows.push({
      player_id: playerId,
      question_id: questionId,
      centre_id: batch.centre_id,
      answer: answer as Answer,
      recorded_by: coach.id,
    });
  }

  const overallRating = validateCategoryRating(formData.get("overall_rating"));
  if (overallRating == null) {
    return { error: "Enter an overall spirit rating between 1 and 5 (half-star steps allowed)." };
  }

  const { error } = await supabase
    .from("five_s_question_responses")
    .upsert(rows, { onConflict: "player_id,question_id" });

  if (error) {
    logError(`Failed to save spirit responses for player ${playerId}:`, error);
    return { error: "Failed to save responses." };
  }

  // Spirit has no "overall remarks" concept in its own UI (unlike Skill/
  // Stamina) -- remarks stays empty rather than adding an unrequested
  // textarea just to satisfy this column's NOT NULL constraint.
  const { error: ratingError } = await supabase.from("five_s_category_notes").upsert(
    {
      player_id: playerId,
      category: "spirit",
      centre_id: batch.centre_id,
      remarks: "",
      rating: overallRating,
      recorded_by: coach.id,
    },
    { onConflict: "player_id,category" }
  );

  if (ratingError) {
    logError(`Failed to save spirit rating for player ${playerId}:`, ratingError);
    return { error: "Failed to save overall rating." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

export type SkillGroup = { label: string; testIds: string[]; requiredTestIds: string[] };
export type SkillScoresFormState = { error?: string } | undefined;

export async function submitSkillScores(
  batchId: string,
  playerId: string,
  groups: SkillGroup[],
  _prev: SkillScoresFormState,
  formData: FormData
): Promise<SkillScoresFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const windowError = await assertTestingWindowOpen(supabase, batch.centre_id);
  if (windowError) {
    return { error: windowError };
  }

  const lockedTestIds = await getLockedTestIds(
    supabase,
    playerId,
    coach.id,
    groups.flatMap((g) => g.testIds)
  );

  const resultRows: {
    player_id: string;
    test_id: string;
    centre_id: string;
    score: number;
    recorded_by: string;
  }[] = [];

  const groupNoteRows: {
    player_id: string;
    category: "skill";
    group_name: string;
    centre_id: string;
    remarks: string;
    recorded_by: string;
  }[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    for (const testId of group.testIds) {
      if (lockedTestIds.has(testId)) continue;
      const raw = formData.get(`score_${testId}`);
      const isRequired = group.requiredTestIds.includes(testId);

      if (raw === null || raw === "") {
        if (isRequired) {
          return { error: "Enter a rating for every required test." };
        }
        continue;
      }

      const score = Number(raw);
      if (!Number.isFinite(score) || score <= 0) {
        return { error: "Enter a valid rating for every test." };
      }
      resultRows.push({
        player_id: playerId,
        test_id: testId,
        centre_id: batch.centre_id,
        score,
        recorded_by: coach.id,
      });
    }

    const remarks = String(formData.get(`remarks_group_${i}`) ?? "").trim();
    if (!remarks) {
      return { error: "Remarks are required for every test group." };
    }
    groupNoteRows.push({
      player_id: playerId,
      category: "skill",
      group_name: group.label,
      centre_id: batch.centre_id,
      remarks,
      recorded_by: coach.id,
    });
  }

  const overallRemarks = String(formData.get("overall_remarks") ?? "").trim();
  if (!overallRemarks) {
    return { error: "Overall remarks are required." };
  }

  const overallRating = validateCategoryRating(formData.get("overall_rating"));
  if (overallRating == null) {
    return { error: "Enter an overall skill rating between 1 and 5 (half-star steps allowed)." };
  }

  // Results, group remarks, and the overall category note used to be three
  // separate .upsert() calls — a failure on the second or third left the
  // first already committed, with nothing to undo it. submit_skill_scores
  // does all three in one Postgres function call, so a failure on any of
  // them rolls back the whole submission instead of leaving it half-saved.
  const { error } = await supabase.rpc("submit_skill_scores", {
    p_results: resultRows,
    p_group_notes: groupNoteRows,
    p_category_note: {
      player_id: playerId,
      category: "skill",
      centre_id: batch.centre_id,
      remarks: overallRemarks,
      rating: overallRating,
      recorded_by: coach.id,
    },
  });

  if (error) {
    logError(`Failed to save skill assessment for player ${playerId}:`, error);
    return { error: "Failed to save skill assessment." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

export type PublishReportState = { error?: string } | { success: true };

// Publishing is the choke point that makes a player's 5S results visible
// to centre_admin/parent (see the RLS policies added alongside
// five_s_reports) — re-checks completeness server-side rather than
// trusting the disabled state of the button that triggered this.
export async function publishFiveSReport(
  batchId: string,
  playerId: string
): Promise<PublishReportState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .or(coachBatchFilter(coach.id))
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const { data: player } = await supabase
    .from("players")
    .select("id, player_batches!inner(batch_id)")
    .eq("id", playerId)
    .eq("player_batches.batch_id", batchId)
    .maybeSingle();

  if (!player) {
    return { error: "Player not found in this batch." };
  }

  const [tests, questions, { count: resultCount }, { count: responseCount }] = await Promise.all([
    getFiveSTests(),
    getFiveSQuestions(),
    supabase
      .from("five_s_results")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId),
    supabase
      .from("five_s_question_responses")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId),
  ]);

  const isComplete = (resultCount ?? 0) >= tests.length && (responseCount ?? 0) >= questions.length;
  if (!isComplete) {
    return { error: "Every test and question must be answered before publishing." };
  }

  const { error } = await supabase.from("five_s_reports").upsert(
    {
      player_id: playerId,
      centre_id: batch.centre_id,
      published_by: coach.id,
      published_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );

  if (error) {
    logError(`Failed to publish 5S report for player ${playerId}:`, error);
    return { error: "Failed to publish report." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  revalidatePath(`/coach/5s-model/${batchId}/${playerId}/results`);
  return { success: true };
}
