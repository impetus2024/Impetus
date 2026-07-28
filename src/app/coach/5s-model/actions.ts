"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

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
    return { error: "Failed to save scores." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}

export type StaminaScoresFormState = { error?: string } | undefined;

export async function submitStaminaScores(
  batchId: string,
  playerId: string,
  testIds: string[],
  _prev: StaminaScoresFormState,
  formData: FormData
): Promise<StaminaScoresFormState> {
  const coach = await requireRole("coach");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("id, centre_id")
    .eq("id", batchId)
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

  const rows: {
    player_id: string;
    test_id: string;
    centre_id: string;
    score: number;
    vo2_max: number;
    remarks: string;
    recorded_by: string;
  }[] = [];

  for (const testId of testIds) {
    const score = Number(formData.get(`score_${testId}`));
    const vo2Max = Number(formData.get(`vo2max_${testId}`));
    const remarks = String(formData.get(`remarks_${testId}` ) ?? "").trim();

    if (!Number.isFinite(score) || score <= 0) {
      return { error: "Enter a valid score for every test." };
    }
    if (!Number.isFinite(vo2Max) || vo2Max <= 0) {
      return { error: "Enter a valid VO2 Max for every test." };
    }
    if (!remarks) {
      return { error: "Remarks are required for every test." };
    }

    rows.push({
      player_id: playerId,
      test_id: testId,
      centre_id: batch.centre_id,
      score,
      vo2_max: vo2Max,
      remarks,
      recorded_by: coach.id,
    });
  }

  const overallRemarks = String(formData.get("overall_remarks") ?? "").trim();
  if (!overallRemarks) {
    return { error: "Overall remarks are required." };
  }

  const { error: resultsError } = await supabase
    .from("five_s_results")
    .upsert(rows, { onConflict: "player_id,test_id" });

  if (resultsError) {
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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
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

  const { error } = await supabase
    .from("five_s_question_responses")
    .upsert(rows, { onConflict: "player_id,question_id" });

  if (error) {
    return { error: "Failed to save responses." };
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
    .eq("head_coach_id", coach.id)
    .maybeSingle();

  if (!batch) {
    return { error: "You don't have access to this batch." };
  }

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

  if (resultRows.length > 0) {
    const { error: resultsError } = await supabase
      .from("five_s_results")
      .upsert(resultRows, { onConflict: "player_id,test_id" });

    if (resultsError) {
      return { error: "Failed to save ratings." };
    }
  }

  const { error: groupNotesError } = await supabase
    .from("five_s_group_notes")
    .upsert(groupNoteRows, { onConflict: "player_id,category,group_name" });

  if (groupNotesError) {
    return { error: "Failed to save test group remarks." };
  }

  const { error: notesError } = await supabase.from("five_s_category_notes").upsert(
    {
      player_id: playerId,
      category: "skill",
      centre_id: batch.centre_id,
      remarks: overallRemarks,
      recorded_by: coach.id,
    },
    { onConflict: "player_id,category" }
  );

  if (notesError) {
    return { error: "Failed to save overall remarks." };
  }

  revalidatePath(`/coach/5s-model/${batchId}/${playerId}`);
  redirect(`/coach/5s-model/${batchId}/${playerId}`);
}
