import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, PRODUCTION_PROJECT_REFS } from "./supabase-guard";

const PROD = PRODUCTION_PROJECT_REFS[0];
const STAGING = "stagingref";
const refused = (args: string[], ref: string | null) => decide(args, ref).action === "refuse";

test("db reset --linked is blocked on production, even with --confirm-ref", () => {
  assert.ok(refused(["db", "reset", "--linked"], PROD));
  assert.ok(refused(["db", "reset", "--linked", "--confirm-ref", PROD], PROD));
  assert.ok(refused(["db", "reset", "--linked=true", "--confirm-ref", PROD], PROD));
  assert.ok(refused(["db", "reset", "--confirm-ref", PROD, "--linked"], PROD));
});

test("db reset --linked on non-production still needs the typed ref", () => {
  assert.ok(refused(["db", "reset", "--linked"], STAGING));
  assert.ok(refused(["db", "reset", "--linked", "--confirm-ref", "wrong"], STAGING));
  const d = decide(["db", "reset", "--linked", "--confirm-ref", STAGING], STAGING);
  assert.deepEqual(d, { action: "run", args: ["db", "reset", "--linked"] });
});

test("db reset --linked refused when nothing is linked", () => {
  assert.ok(refused(["db", "reset", "--linked", "--confirm-ref", "x"], null));
});

test("plain local db reset passes through", () => {
  assert.deepEqual(decide(["db", "reset"], PROD), { action: "run", args: ["db", "reset"] });
});

test("--db-url is refused for reset and push", () => {
  assert.ok(refused(["db", "reset", "--db-url", "postgres://x"], STAGING));
  assert.ok(refused(["db", "push", "--db-url=postgres://x"], STAGING));
});

test("db push still needs --confirm-ref (production push allowed when confirmed)", () => {
  assert.ok(refused(["db", "push"], PROD));
  assert.deepEqual(decide(["db", "push", "--confirm-ref", PROD], PROD), { action: "run", args: ["db", "push"] });
});

test("unknown commands are refused, not passed through", () => {
  for (const args of [[], ["db", "dump"], ["db", "remote", "commit"], ["migration", "repair"], ["projects", "delete"], ["db"]]) {
    assert.ok(refused(args, STAGING), `expected refuse: ${args.join(" ")}`);
  }
});

test("link requires --yes", () => {
  assert.ok(refused(["link", "--project-ref", STAGING], null));
  assert.deepEqual(decide(["link", "--project-ref", STAGING, "--yes"], null), {
    action: "run",
    args: ["link", "--project-ref", STAGING],
  });
});
