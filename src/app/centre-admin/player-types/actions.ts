"use server";

import {
  createLookupItem,
  renameLookupItem,
  setLookupItemActive,
  type LookupFormState,
} from "@/lib/lookup/service";

const PATH = "/centre-admin/player-types";

// Age Category names (e.g. "Cubs", "U12") are an arbitrary label — the
// actual numeric age they represent is what the 5S Model needs, so it's
// captured separately as a required 4-20 dropdown.
const MIN_AGE = 4;
const MAX_AGE = 25;

function parseAgeCategoryAge(raw: FormDataEntryValue | null): { age: number } | { error: string } {
  const age = Number(raw);
  if (!raw || !Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    return { error: `Age must be between ${MIN_AGE} and ${MAX_AGE}.` };
  }
  return { age };
}

export async function createPlayerType(
  _prev: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  return createLookupItem("player_types", String(formData.get("name") ?? ""), PATH);
}

export async function renamePlayerType(
  id: string,
  _prev: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  return renameLookupItem(
    "player_types",
    id,
    String(formData.get("name") ?? ""),
    PATH
  );
}

export async function setPlayerTypeActive(id: string, active: boolean) {
  return setLookupItemActive("player_types", id, active, PATH);
}

export async function createAgeCategory(
  _prev: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  const parsed = parseAgeCategoryAge(formData.get("age"));
  if ("error" in parsed) return parsed;
  return createLookupItem(
    "age_categories",
    String(formData.get("name") ?? ""),
    PATH,
    { age: parsed.age }
  );
}

export async function renameAgeCategory(
  id: string,
  _prev: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  const parsed = parseAgeCategoryAge(formData.get("age"));
  if ("error" in parsed) return parsed;
  return renameLookupItem(
    "age_categories",
    id,
    String(formData.get("name") ?? ""),
    PATH,
    { age: parsed.age }
  );
}

export async function setAgeCategoryActive(id: string, active: boolean) {
  return setLookupItemActive("age_categories", id, active, PATH);
}
