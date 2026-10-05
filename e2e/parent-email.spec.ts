import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  TEST_ACCOUNTS,
  TEST_PASSWORD,
  loginAs,
  assertSafeE2ETarget,
  adminClient,
  SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./helpers";

assertSafeE2ETarget();

// Parent login-email safety: the parent email on a player doubles as the
// parent's login, and updateParentProfile must only move that login when the
// admin explicitly edits the field — never while saving unrelated profile
// fields, and never by "healing" a denormalized copy that has drifted from
// the real login. players.parent_email itself changes only on the player whose
// Parent Profile was explicitly edited: never on a sibling, never through a
// direct Data API write, and never from a Supabase Auth email change. Runs serially against throwaway parents/players so the
// seeded TEST_ACCOUNTS (and each other) are never touched.
test.describe.configure({ mode: "serial" });

test.describe("parent login email safety", () => {
  test.skip(
    !TEST_PASSWORD || !SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "Needs DEV_DEFAULT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — see e2e/README.md"
  );
  test.setTimeout(90_000);

  const stamp = Date.now();
  const parentOriginalEmail = `parent-${stamp}@impetus.local`;
  const parentChangedEmail = `parent-moved-${stamp}@impetus.local`;
  const parentPassword = "parent-initial-1234";

  // Divergence fixture: the login is divParentEmail, but the player's
  // denormalized parent_email is divStaleEmail.
  const divParentEmail = `div-parent-${stamp}@impetus.local`;
  const divParentNewEmail = `div-parent-moved-${stamp}@impetus.local`;
  const divStaleEmail = `stale-${stamp}@impetus.local`;

  // Case-insensitive link-resolution fixture: account lowercased by GoTrue,
  // player row holding a mixed-case copy and no parent link yet.
  const caseParentEmail = `caseparent-${stamp}@impetus.local`;
  const casePlayerMixedEmail = `CaseParent-${stamp}@Impetus.local`;

  let centreId: string;
  let centreAdminId: string;
  let otherCentreId: string;

  let parentId: string;
  let playerId: string;
  let siblingId: string;
  let otherCentrePlayerId: string;

  let divParentId: string;
  let divPlayerId: string;

  let caseParentId: string;
  let casePlayerId: string;

  // Throwaway row for the DELETE + re-INSERT regression test; deleted there,
  // and swept by cleanupFixtures in case that test dies mid-sequence.
  let reinsertFixtureId = "";

  const admin = () => adminClient();

  async function signIn(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
  }

  // 30s (Playwright's default URL-assertion timeout is 5s): on a cold dev
  // server the login itself succeeds but the first hit of /centre-admin
  // compiles the route after the redirect, which has been observed to take
  // >5s under Turbopack. The same applies to /parent in parentPage below.
  async function signInAsCentreAdmin(page: Page) {
    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/, { timeout: 30_000 });
  }

  async function parentPage(browser: Browser, email: string, password: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/parent/, { timeout: 30_000 });
    return page;
  }

  // Whether the session held by this browser still exists server-side (see
  // coach-account.spec.ts for why getUser is the accurate revocation check).
  async function sessionStillValid(page: Page) {
    const cookies = (await page.context().cookies())
      .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!cookies.length) return false;
    const raw = cookies.map((c) => c.value).join("");
    const json = raw.startsWith("base64-")
      ? Buffer.from(raw.slice("base64-".length), "base64url").toString()
      : decodeURIComponent(raw);
    const { access_token } = JSON.parse(json) as { access_token: string };
    const { error } = await admin().auth.getUser(access_token);
    return !error;
  }

  async function profileOf(userId: string) {
    const { data, error } = await admin()
      .from("profiles")
      .select("id, email, role, centre_id")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  }

  async function authEmailOf(userId: string) {
    const { data } = await admin().auth.admin.getUserById(userId);
    return data.user?.email;
  }

  async function playerParentEmail(playerId: string) {
    const { data, error } = await admin()
      .from("players")
      .select("parent_email")
      .eq("id", playerId)
      .single();
    if (error) throw error;
    return data.parent_email;
  }

  async function emailChangedLogsFor(userId: string) {
    const { data } = await admin()
      .from("email_logs")
      .select("recipient_email")
      .eq("email_type", "email_changed")
      .eq("recipient_profile_id", userId);
    return (data ?? []).map((row) => row.recipient_email.toLowerCase());
  }

  async function openParentEditor(page: Page, playerId: string) {
    await page.goto(`/centre-admin/players/${playerId}?section=parent`);
    await page.getByRole("button", { name: "Edit" }).click();
  }

  // The email field is read-only until "Change email" is clicked; only then
  // does the save carry the explicit change intent.
  async function changeParentEmail(page: Page, email: string) {
    await page.getByRole("button", { name: "Change email" }).click();
    await page.getByLabel("Parent / Guardian Email ID").fill(email);
  }

  // A Data API client holding the centre admin's own session — the requests
  // a hand-rolled client could send without going through the app.
  async function centreAdminDataClient() {
    const authed = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await authed.auth.signInWithPassword({
      email: TEST_ACCOUNTS.centreAdmin,
      password: TEST_PASSWORD!,
    });
    expect(error).toBeNull();
    return authed;
  }

  // Best-effort teardown, in FK-safe order. Each step is independently
  // guarded so one failure can't strand the rest, and it is also called from
  // the beforeAll catch below so a partially-seeded fixture still gets cleaned.
  async function cleanupFixtures() {
    const db = admin();
    const safeDelete = async (step: () => Promise<unknown>) => {
      try {
        await step();
      } catch (err) {
        console.warn("[e2e] fixture cleanup step failed:", err);
      }
    };
    await safeDelete(async () => {
      if (casePlayerId) await db.from("players").delete().eq("id", casePlayerId);
    });
    await safeDelete(async () => {
      if (divPlayerId) await db.from("players").delete().eq("id", divPlayerId);
    });
    await safeDelete(async () => {
      if (otherCentrePlayerId) await db.from("players").delete().eq("id", otherCentrePlayerId);
    });
    await safeDelete(async () => {
      if (siblingId) await db.from("players").delete().eq("id", siblingId);
    });
    await safeDelete(async () => {
      if (playerId) await db.from("players").delete().eq("id", playerId);
    });
    await safeDelete(async () => {
      if (reinsertFixtureId) await db.from("players").delete().eq("id", reinsertFixtureId);
    });
    await safeDelete(async () => {
      if (parentId) await db.auth.admin.deleteUser(parentId);
    });
    await safeDelete(async () => {
      if (divParentId) await db.auth.admin.deleteUser(divParentId);
    });
    await safeDelete(async () => {
      if (caseParentId) await db.auth.admin.deleteUser(caseParentId);
    });
    await safeDelete(async () => {
      if (otherCentreId) await db.from("centres").delete().eq("id", otherCentreId);
    });
  }

  async function seedFixtures() {
    const db = admin();
    const { data: ca, error: caError } = await db
      .from("profiles")
      .select("id, centre_id")
      .eq("email", TEST_ACCOUNTS.centreAdmin)
      .single();
    if (caError || !ca?.centre_id) {
      throw new Error(`Seeded centre admin not found: ${caError?.message}`);
    }
    centreId = ca.centre_id;
    centreAdminId = ca.id;

    const { data: otherCentre, error: centreError } = await db
      .from("centres")
      .insert({
        name: `E2E Parent Other Centre ${stamp}`,
        contact_number: "9900000000",
        email: `centre-${stamp}@impetus.local`,
        country: "India",
      })
      .select("id")
      .single();
    if (centreError) throw centreError;
    otherCentreId = otherCentre.id;

    // Main parent + its player in this centre.
    const { data: parent, error: parentError } = await db.auth.admin.createUser({
      email: parentOriginalEmail,
      password: parentPassword,
      email_confirm: true,
      app_metadata: { role: "parent", centre_id: null },
      user_metadata: { full_name: "Fixture Parent" },
    });
    if (parentError || !parent.user) throw new Error(`Could not create parent: ${parentError?.message}`);
    parentId = parent.user.id;

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Parent Player ${stamp}`,
        date_of_birth: "2013-01-01",
        parent_email: parentOriginalEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (playerError) throw playerError;
    playerId = player.id;
    await db.from("parent_player_links").insert({ parent_id: parentId, player_id: playerId, centre_id: centreId });

    // A same-centre sibling of that parent.
    const { data: sibling, error: siblingError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Parent Sibling ${stamp}`,
        date_of_birth: "2015-01-01",
        parent_email: parentOriginalEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (siblingError) throw siblingError;
    siblingId = sibling.id;
    await db.from("parent_player_links").insert({ parent_id: parentId, player_id: siblingId, centre_id: centreId });

    // A player in ANOTHER centre linked to the same parent — its parent_email
    // must never be rewritten by this centre's admin.
    const { data: otherPlayer, error: otherPlayerError } = await db
      .from("players")
      .insert({
        centre_id: otherCentreId,
        name: `E2E Parent Other Centre Player ${stamp}`,
        date_of_birth: "2014-01-01",
        parent_email: parentOriginalEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (otherPlayerError) throw otherPlayerError;
    otherCentrePlayerId = otherPlayer.id;
    await db.from("parent_player_links").insert({ parent_id: parentId, player_id: otherCentrePlayerId, centre_id: otherCentreId });

    // Divergence fixture.
    const { data: divParent, error: divParentError } = await db.auth.admin.createUser({
      email: divParentEmail,
      password: parentPassword,
      email_confirm: true,
      app_metadata: { role: "parent", centre_id: null },
      user_metadata: { full_name: "Fixture Divergent Parent" },
    });
    if (divParentError || !divParent.user) throw new Error(`Could not create divergent parent: ${divParentError?.message}`);
    divParentId = divParent.user.id;

    const { data: divPlayer, error: divPlayerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Divergent Parent Player ${stamp}`,
        date_of_birth: "2016-01-01",
        // Deliberately diverged from the real login (divParentEmail).
        parent_email: divStaleEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (divPlayerError) throw divPlayerError;
    divPlayerId = divPlayer.id;
    await db.from("parent_player_links").insert({ parent_id: divParentId, player_id: divPlayerId, centre_id: centreId });

    // Case-insensitive link-resolution fixture: no parent link yet.
    const { data: caseParent, error: caseParentError } = await db.auth.admin.createUser({
      email: caseParentEmail,
      password: parentPassword,
      email_confirm: true,
      app_metadata: { role: "parent", centre_id: null },
      user_metadata: { full_name: "Fixture Case Parent" },
    });
    if (caseParentError || !caseParent.user) throw new Error(`Could not create case parent: ${caseParentError?.message}`);
    caseParentId = caseParent.user.id;

    const { data: casePlayer, error: casePlayerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Case Parent Player ${stamp}`,
        date_of_birth: "2017-01-01",
        parent_email: casePlayerMixedEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (casePlayerError) throw casePlayerError;
    casePlayerId = casePlayer.id;
  }

  test.beforeAll(async () => {
    try {
      await seedFixtures();
    } catch (err) {
      await cleanupFixtures();
      throw err;
    }
  });

  test.afterAll(cleanupFixtures);

  test("saving unrelated parent fields does not change the login email", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: "Save" }).click();

    // Back in view mode (a successful, non-divergent save).
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

    // Login identity untouched.
    expect((await profileOf(parentId)).email).toBe(parentOriginalEmail);
    expect(await authEmailOf(parentId)).toBe(parentOriginalEmail);
    expect(await playerParentEmail(playerId)).toBe(parentOriginalEmail);

    // And no email-changed notice went out.
    expect(await emailChangedLogsFor(parentId)).toEqual([]);
  });

  test("an email value submitted without an explicit change is ignored", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    // What browser autofill (or a hand-edited DOM) would do: put a different
    // address in the read-only field without the admin clicking "Change email".
    await page.evaluate(() => {
      const input = document.querySelector('input[name="parentEmail"]') as HTMLInputElement | null;
      if (input) input.value = "autofilled-admin@impetus.local";
    });
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    expect((await admin().from("players").select("city").eq("id", playerId).single()).data?.city).toBe("Pune");
    expect(await playerParentEmail(playerId)).toBe(parentOriginalEmail);
    expect(await authEmailOf(parentId)).toBe(parentOriginalEmail);
    expect(await emailChangedLogsFor(parentId)).toEqual([]);
  });

  test("a centre admin cannot change parent_email through the Data API, but other fields still save", async () => {
    const authed = await centreAdminDataClient();

    const { error } = await authed
      .from("players")
      .update({ parent_email: `bypass-${stamp}@impetus.local` })
      .eq("id", siblingId);
    // Raised by prevent_parent_email_tamper, not silently filtered by RLS.
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/can only be changed from the Parent Profile/i);
    expect(await playerParentEmail(siblingId)).toBe(parentOriginalEmail);

    // Ordinary player updates through the same policy are unaffected.
    const { data: saved, error: cityError } = await authed
      .from("players")
      .update({ city: "Nashik" })
      .eq("id", siblingId)
      .select("city, parent_email")
      .single();
    expect(cityError).toBeNull();
    expect(saved).toEqual({ city: "Nashik", parent_email: parentOriginalEmail });
  });

  // Regression: prevent_parent_email_tamper guards UPDATE only, so the
  // previously identified bypass re-IMPLEMENTED the row instead of updating
  // it — DELETE the player, re-INSERT the same primary key with an arbitrary
  // parent_email, and the email changed in place without ever touching an
  // UPDATE trigger, the intent flag, or the version check. The supplied id is
  // the entire trick, so the database now refuses any client-supplied
  // players.id from an authenticated end-user (see migration
  // 20261004000000_prevent_player_id_reinsert.sql). This runs against the
  // real local Data API with the centre admin's own session — the exact
  // client a hand-rolled attack would use, no mocked database.
  test("a centre admin cannot change parent_email by DELETE + re-INSERT with the same id", async () => {
    const authed = await centreAdminDataClient();
    const forgedEmail = `bypass-reinsert-${stamp}@impetus.local`;

    // Seed a throwaway row with the service role so both halves of the attack
    // below are issued by the end-user client alone.
    const { data: seeded, error: seedError } = await admin()
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Reinsert Throwaway ${stamp}`,
        date_of_birth: "2014-05-05",
        parent_email: parentOriginalEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    expect(seedError).toBeNull();
    reinsertFixtureId = seeded!.id;

    // Step 1 of the bypass: the delete half still goes through — RLS is FOR
    // ALL for this centre's rows and deletion itself is not what's blocked.
    const { error: deleteError } = await authed.from("players").delete().eq("id", reinsertFixtureId);
    expect(deleteError).toBeNull();

    // Step 2: re-inserting that SAME id with a different parent_email must be
    // refused outright — no row, no in-place email rewrite.
    const { error: reinsertError } = await authed.from("players").insert({
      id: reinsertFixtureId,
      centre_id: centreId,
      name: `E2E Reinsert Throwaway ${stamp}`,
      date_of_birth: "2014-05-05",
      parent_email: forgedEmail,
      created_by: centreAdminId,
    });
    expect(reinsertError).not.toBeNull();
    expect(reinsertError?.message ?? "").toMatch(/cannot be supplied on insert/i);

    // The id stayed dead and the forged address exists nowhere in the table.
    expect((await admin().from("players").select("id").eq("id", reinsertFixtureId)).data ?? []).toEqual([]);
    expect((await admin().from("players").select("id").eq("parent_email", forgedEmail)).data ?? []).toEqual([]);

    // Legitimate creation is untouched: the same centre admin inserting with
    // NO supplied id — exactly what createPlayer does — still succeeds…
    const { data: fresh, error: freshError } = await authed
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Fresh Player ${stamp}`,
        date_of_birth: "2014-05-06",
        parent_email: parentOriginalEmail,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    expect(freshError).toBeNull();
    expect(fresh!.id).toBeTruthy();

    // …and so does deleting that fresh row: the fix blocks id re-use, not
    // player deletion itself.
    const { error: freshDeleteError } = await authed.from("players").delete().eq("id", fresh!.id);
    expect(freshDeleteError).toBeNull();
  });

  test("a case-only edit of the parent email is not an email change", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await changeParentEmail(page, parentOriginalEmail.toUpperCase());
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    expect((await profileOf(parentId)).email).toBe(parentOriginalEmail);
    expect(await authEmailOf(parentId)).toBe(parentOriginalEmail);
    expect(await emailChangedLogsFor(parentId)).toEqual([]);
  });

  test("a request without updatedAt is rejected as stale", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    // A hand-rolled request (or a form predating the guard) that omits the
    // version token must not be able to overwrite a newer save.
    await page.evaluate(() => {
      document.querySelector('input[name="updatedAt"]')?.remove();
    });
    await page.getByLabel("City").fill("Mumbai");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/changed by someone else/i)).toBeVisible();
    // Nothing was written: the earlier save's city still stands.
    expect((await admin().from("players").select("city").eq("id", playerId).single()).data?.city).toBe("Pune");
  });

  test("a request with a stale updatedAt is rejected", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await page.evaluate(() => {
      const input = document.querySelector('input[name="updatedAt"]') as HTMLInputElement | null;
      if (input) input.value = "2000-01-01T00:00:00.000Z";
    });
    await page.getByLabel("City").fill("Mumbai");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/changed by someone else/i)).toBeVisible();
    expect((await admin().from("players").select("city").eq("id", playerId).single()).data?.city).toBe("Pune");
  });

  test("an intentional email change moves the login, revokes sessions, and changes only this player", async ({
    page,
    browser,
  }) => {
    const parentSession = await parentPage(browser, parentOriginalEmail, parentPassword);

    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await changeParentEmail(page, parentChangedEmail);
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(async () => (await profileOf(parentId)).email).toBe(parentChangedEmail);
    expect(await authEmailOf(parentId)).toBe(parentChangedEmail);

    // Only the edited player's copy changed — no sibling, in this centre or
    // another, is touched by saving this Parent Profile.
    expect(await playerParentEmail(playerId)).toBe(parentChangedEmail);
    expect(await playerParentEmail(siblingId)).toBe(parentOriginalEmail);
    expect(await playerParentEmail(otherCentrePlayerId)).toBe(parentOriginalEmail);

    // The email-changed notice went to the new address only.
    await expect.poll(async () => emailChangedLogsFor(parentId)).toEqual([parentChangedEmail]);

    // The parent's existing session was revoked.
    expect(await sessionStillValid(parentSession)).toBe(false);
    await parentSession.context().close();
  });

  test("a retry after the login already moved repairs the copies without revoking sessions again", async ({
    page,
    browser,
  }) => {
    // Simulate the partial-failure state a retry lands in: the auth login has
    // moved (parentChangedEmail) but this player's denormalized copy is stale.
    await admin().from("players").update({ parent_email: parentOriginalEmail }).eq("id", playerId);

    const parentSession = await parentPage(browser, parentChangedEmail, parentPassword);

    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await changeParentEmail(page, parentChangedEmail);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

    // Copy repaired, login untouched, and no second revocation or notice.
    expect(await playerParentEmail(playerId)).toBe(parentChangedEmail);
    expect((await profileOf(parentId)).email).toBe(parentChangedEmail);
    expect(await authEmailOf(parentId)).toBe(parentChangedEmail);
    expect(await emailChangedLogsFor(parentId)).toEqual([parentChangedEmail]);
    expect(await sessionStillValid(parentSession)).toBe(true);
    await parentSession.context().close();
  });

  test("a diverged parent_email is never silently re-asserted as the login", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, divPlayerId);
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: "Save" }).click();

    // Saved the unrelated field, but reported the divergence instead of
    // silently moving the login back to the stale address.
    await expect(page.getByText(/doesn't match this parent's sign-in email/i)).toBeVisible();
    expect((await admin().from("players").select("city").eq("id", divPlayerId).single()).data?.city).toBe("Pune");

    // Login identity untouched, and the stale copy unchanged.
    expect((await profileOf(divParentId)).email).toBe(divParentEmail);
    expect(await authEmailOf(divParentId)).toBe(divParentEmail);
    expect(await playerParentEmail(divPlayerId)).toBe(divStaleEmail);

    // No account was provisioned for the stale address.
    const { data: staleProfile } = await admin()
      .from("profiles")
      .select("id")
      .eq("email", divStaleEmail)
      .maybeSingle();
    expect(staleProfile).toBeNull();
    expect(await emailChangedLogsFor(divParentId)).toEqual([]);
  });

  test("a same-address repair does not revoke sessions or send a notification", async ({
    page,
    browser,
  }) => {
    const parentSession = await parentPage(browser, divParentEmail, parentPassword);

    await signInAsCentreAdmin(page);
    await openParentEditor(page, divPlayerId);
    // Submitted address equals the linked parent's actual login (divParentEmail)
    // but differs from the stale denormalized copy — a repair, not a change.
    await changeParentEmail(page, divParentEmail);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

    // Copy repaired, login and sessions untouched, no notice sent.
    expect(await playerParentEmail(divPlayerId)).toBe(divParentEmail);
    expect((await profileOf(divParentId)).email).toBe(divParentEmail);
    expect(await authEmailOf(divParentId)).toBe(divParentEmail);
    expect(await emailChangedLogsFor(divParentId)).toEqual([]);
    expect(await sessionStillValid(parentSession)).toBe(true);
    await parentSession.context().close();
  });

  test("an explicit email edit on a diverged player still moves the login", async ({ page }) => {
    await signInAsCentreAdmin(page);
    // Fresh page load so the form carries the current updated_at.
    await openParentEditor(page, divPlayerId);
    await changeParentEmail(page, divParentNewEmail);
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(async () => (await profileOf(divParentId)).email).toBe(divParentNewEmail);
    expect(await authEmailOf(divParentId)).toBe(divParentNewEmail);
    expect(await playerParentEmail(divPlayerId)).toBe(divParentNewEmail);
  });

  // Stale-form race: an admin opens the parent editor (showing the current
  // email), somebody else then moves the login and the copies to a newer
  // address, and the admin saves. The submitted email now differs from the
  // database, which is exactly what used to be read as "change the login back"
  // -- updateParentProfile moved auth.users/profiles/siblings BEFORE its
  // updated_at check rejected the save. Everything must stay on the newer
  // address, and the parent's session must survive.
  async function staleParentSave(
    page: Page,
    browser: Browser,
    newerEmail: string,
    unrelatedEdit: { city: string } | null
  ) {
    const displayedEmail = await playerParentEmail(playerId);
    const cityBefore = (await admin().from("players").select("city").eq("id", playerId).single()).data?.city;
    const noticesBefore = await emailChangedLogsFor(parentId);

    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await expect(page.getByLabel("Parent / Guardian Email ID")).toHaveValue(displayedEmail);

    // The competing update lands after the form loaded: login, mirrored
    // profile and this centre's copies all move (bumping players.updated_at).
    const { error: moveError } = await admin().auth.admin.updateUserById(parentId, {
      email: newerEmail,
      email_confirm: true,
    });
    expect(moveError).toBeNull();
    await expect.poll(async () => (await profileOf(parentId)).email).toBe(newerEmail);
    await admin().from("players").update({ parent_email: newerEmail }).in("id", [playerId, siblingId]);

    const parentSession = await parentPage(browser, newerEmail, parentPassword);

    // The stale form explicitly submits the address it was loaded with — the
    // exact request that would revert the newer login if it got through.
    await page.getByRole("button", { name: "Change email" }).click();
    if (unrelatedEdit) await page.getByLabel("City").fill(unrelatedEdit.city);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/changed by someone else/i)).toBeVisible();

    // Nothing from the stale request took effect anywhere.
    expect(await authEmailOf(parentId)).toBe(newerEmail);
    expect((await profileOf(parentId)).email).toBe(newerEmail);
    expect(await playerParentEmail(playerId)).toBe(newerEmail);
    expect(await playerParentEmail(siblingId)).toBe(newerEmail);
    expect((await admin().from("players").select("city").eq("id", playerId).single()).data?.city).toBe(cityBefore);
    expect(await emailChangedLogsFor(parentId)).toEqual(noticesBefore);
    expect(await sessionStillValid(parentSession)).toBe(true);
    await parentSession.context().close();
  }

  const raceEmailOne = `parent-race1-${stamp}@impetus.local`;
  const raceEmailTwo = `parent-race2-${stamp}@impetus.local`;
  const parentFinalEmail = `parent-final-${stamp}@impetus.local`;

  test("a stale parent form cannot revert a newer email", async ({ page, browser }) => {
    await staleParentSave(page, browser, raceEmailOne, null);
  });

  test("a stale parent form with an unrelated edit is rejected whole", async ({ page, browser }) => {
    await staleParentSave(page, browser, raceEmailTwo, { city: "Stale City" });
  });

  test("a fresh email change still works after stale rejections", async ({ page, browser }) => {
    const parentSession = await parentPage(browser, raceEmailTwo, parentPassword);

    await signInAsCentreAdmin(page);
    await openParentEditor(page, playerId);
    await changeParentEmail(page, parentFinalEmail);
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(async () => (await profileOf(parentId)).email).toBe(parentFinalEmail);
    expect(await authEmailOf(parentId)).toBe(parentFinalEmail);
    expect(await playerParentEmail(playerId)).toBe(parentFinalEmail);
    // The sibling keeps the value it already had.
    expect(await playerParentEmail(siblingId)).toBe(raceEmailTwo);
    expect(await sessionStillValid(parentSession)).toBe(false);
    await parentSession.context().close();
  });

  test("case-insensitive parent link resolution reuses the existing account", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await openParentEditor(page, casePlayerId);
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

    // The mixed-case copy resolved to the existing (lowercased) account and
    // was linked to it — no duplicate parent was provisioned.
    const { data: link } = await admin()
      .from("parent_player_links")
      .select("parent_id")
      .eq("player_id", casePlayerId)
      .maybeSingle();
    expect(link?.parent_id).toBe(caseParentId);

    const { data: parents } = await admin()
      .from("profiles")
      .select("id")
      .eq("email", caseParentEmail)
      .eq("role", "parent");
    expect(parents?.length).toBe(1);
  });

  test("a Supabase Auth email change does not change players.parent_email", async () => {
    const movedEmail = `caseparent-moved-${stamp}@impetus.local`;
    const { error } = await admin().auth.admin.updateUserById(caseParentId, {
      email: movedEmail,
      email_confirm: true,
    });
    expect(error).toBeNull();

    // profiles.email still mirrors the login (handle_auth_user_sync)...
    await expect.poll(async () => (await profileOf(caseParentId)).email).toBe(movedEmail);
    // ...but the player's parent email is the app's own field and stays put.
    expect(await playerParentEmail(casePlayerId)).toBe(casePlayerMixedEmail);
  });
});
