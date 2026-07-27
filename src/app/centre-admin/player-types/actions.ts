"use server";

import {
  createLookupItem,
  renameLookupItem,
  setLookupItemActive,
  type LookupFormState,
} from "@/lib/lookup/service";

const PATH = "/centre-admin/player-types";

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
  return createLookupItem(
    "age_categories",
    String(formData.get("name") ?? ""),
    PATH
  );
}

export async function renameAgeCategory(
  id: string,
  _prev: LookupFormState,
  formData: FormData
): Promise<LookupFormState> {
  return renameLookupItem(
    "age_categories",
    id,
    String(formData.get("name") ?? ""),
    PATH
  );
}

export async function setAgeCategoryActive(id: string, active: boolean) {
  return setLookupItemActive("age_categories", id, active, PATH);
}
