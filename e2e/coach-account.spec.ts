import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  TEST_ACCOUNTS,
  TEST_PASSWORD,
  loginAs,
  assertSafeE2ETarget,
  adminClient,
  recoveryLinkFor,
  SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./helpers";

assertSafeE2ETarget();

// Coach profile management, coach login-email change and the password flows
// around it. Runs serially against one throwaway coach (plus a coach in a
// throwaway second centre for the scoping check), so it never changes the
// password or email of the shared TEST_ACCOUNTS other specs depend on.
test.describe.configure({ mode: "serial" });

test.describe("coach account management", () => {
  test.skip(
    !TEST_PASSWORD || !SERVICE_ROLE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY,
    "Needs DEV_DEFAULT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — see e2e/README.md"
  );
  test.setTimeout(90_000);

  const stamp = Date.now();
  const originalEmail = `coach-${stamp}@impetus.local`;
  // Mixed case on purpose: GoTrue stores it lowercased, and the comparison
  // must be case-insensitive.
  const changedEmailInput = `Coach-Moved-${stamp}@Impetus.local`;
  const changedEmail = changedEmailInput.toLowerCase();
  let coachPassword = "coach-initial-1234";

  let centreId: string;
  let centreAdminId: string;
  let coachId: string;
  let batchId: string;
  let playerId: string;
  let attendanceId: string;
  let otherCentreId: string;
  let otherCoachId: string;

  const admin = () => adminClient();

  async function signIn(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
  }

  async function signInAsCentreAdmin(page: Page) {
    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/);
  }

  async function newCoachPage(browser: Browser, email: string, password: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/coach/);
    return page;
  }

  // Whether the session held by this browser still exists server-side.
  // revoke_user_sessions deletes it from GoTrue, so its refresh token and any
  // server-side check (getUser) fail at once; the app's own getClaims() is a
  // local ES256 check, so an already-issued access token keeps passing that
  // until it expires (see the revoke_user_sessions migration). getUser is
  // therefore the accurate test of revocation.
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

  async function coachProfile() {
    const { data, error } = await admin()
      .from("profiles")
      .select("id, email, role, centre_id, full_name, must_change_password")
      .eq("id", coachId)
      .single();
    if (error) throw error;
    return data;
  }

  test.beforeAll(async () => {
    const db = admin();
    const { data: ca, error: caError } = await db
      .from("profiles")
      .select("id, centre_id")
      .eq("email", TEST_ACCOUNTS.centreAdmin)
      .single();
    if (caError || !ca?.centre_id) throw new Error(`Seeded centre admin not found: ${caError?.message}`);
    centreId = ca.centre_id;
    centreAdminId = ca.id;

    const { data: coach, error: coachError } = await db.auth.admin.createUser({
      email: originalEmail,
      password: coachPassword,
      email_confirm: true,
      app_metadata: { role: "coach", centre_id: centreId },
      user_metadata: { full_name: "Fixture Coach" },
    });
    if (coachError || !coach.user) throw new Error(`Could not create coach: ${coachError?.message}`);
    coachId = coach.user.id;
    await db.from("staff_profiles").insert({ profile_id: coachId, contact_number: "9900123417" });

    // Relationships that must survive every edit below.
    const { data: ageCategory } = await db
      .from("age_categories")
      .select("id")
      .eq("centre_id", centreId)
      .limit(1)
      .single();
    const { data: batch, error: batchError } = await db
      .from("batches")
      .insert({
        centre_id: centreId,
        name: `E2E Coach Batch ${stamp}`,
        head_coach_id: coachId,
        age_category_id: ageCategory!.id,
        start_time: "07:00",
        end_time: "08:00",
      })
      .select("id")
      .single();
    if (batchError) throw batchError;
    batchId = batch.id;

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Player ${stamp}`,
        date_of_birth: "2012-01-01",
        parent_email: `parent-${stamp}@impetus.local`,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (playerError) throw playerError;
    playerId = player.id;

    const { data: attendance, error: attendanceError } = await db
      .from("attendance")
      .insert({
        batch_id: batchId,
        player_id: playerId,
        attendance_date: "2026-09-01",
        status: "present",
        marked_by: coachId,
      })
      .select("id")
      .single();
    if (attendanceError) throw attendanceError;
    attendanceId = attendance.id;

    // A coach in a different centre, for the centre-scoping check.
    const { data: otherCentre, error: centreError } = await db
      .from("centres")
      .insert({
        name: `E2E Other Centre ${stamp}`,
        contact_number: "9900000000",
        email: `centre-${stamp}@impetus.local`,
        country: "India",
      })
      .select("id")
      .single();
    if (centreError) throw centreError;
    otherCentreId = otherCentre.id;
    const { data: otherCoach } = await db.auth.admin.createUser({
      email: `other-coach-${stamp}@impetus.local`,
      password: "other-coach-1234",
      email_confirm: true,
      app_metadata: { role: "coach", centre_id: otherCentreId },
      user_metadata: { full_name: "Other Centre Coach" },
    });
    otherCoachId = otherCoach.user!.id;
  });

  // Removes only the rows this spec created, in FK order.
  test.afterAll(async () => {
    const db = admin();
    if (attendanceId) await db.from("attendance").delete().eq("id", attendanceId);
    if (batchId) await db.from("batches").delete().eq("id", batchId);
    if (playerId) await db.from("players").delete().eq("id", playerId);
    if (coachId) await db.auth.admin.deleteUser(coachId);
    if (otherCoachId) await db.auth.admin.deleteUser(otherCoachId);
    if (otherCentreId) await db.from("centres").delete().eq("id", otherCentreId);
  });

  test("coaches and parents cannot open the centre admin coach editor", async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.coach);
    await expect(page).toHaveURL(/\/coach/);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await expect(page).not.toHaveURL(/\/centre-admin\/administrators/);

    await page.context().clearCookies();
    await loginAs(page, TEST_ACCOUNTS.parent);
    await expect(page).toHaveURL(/\/parent/);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await expect(page).not.toHaveURL(/\/centre-admin\/administrators/);
  });

  test("a centre admin cannot open a coach from another centre", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await page.goto(`/centre-admin/administrators/${otherCoachId}`);
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByText("Other Centre Coach")).toHaveCount(0);
  });

  test("a centre admin edits the coach's profile in place", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await page.getByRole("button", { name: "Edit" }).click();

    // Validation: rejected server-side, nothing saved.
    await page.getByLabel("Contact Number").fill("not-a-number");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Enter a valid contact number.")).toBeVisible();

    await page.getByLabel("Name").fill("Edited Coach");
    await page.getByLabel("Contact Number").fill("+91 98765 43210");
    await page.getByLabel("Date of Birth").fill("1990-05-06");
    await page.getByLabel("City").fill("Pune");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByText("Pune")).toBeVisible();

    const profile = await coachProfile();
    expect(profile).toMatchObject({
      id: coachId,
      full_name: "Edited Coach",
      role: "coach",
      centre_id: centreId,
      email: originalEmail,
    });
    const { data: staff } = await admin()
      .from("staff_profiles")
      .select("contact_number, date_of_birth, city")
      .eq("profile_id", coachId)
      .single();
    expect(staff).toEqual({ contact_number: "+91 98765 43210", date_of_birth: "1990-05-06", city: "Pune" });
  });

  test("a coach's role is locked in the centre admin editor and refused server-side", async ({
    page,
  }) => {
    await signInAsCentreAdmin(page);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await page.getByRole("button", { name: "Edit" }).click();

    // Locked in the UI: no role select, just the read-only value.
    await expect(page.getByLabel("Role")).toBeDisabled();
    await expect(page.getByLabel("Role")).toHaveValue("Coach");

    // And enforced server-side, not just by the disabled field: tamper with
    // the hidden input the form submits (the same value a hand-rolled POST
    // would send) and the action must refuse it.
    await page.evaluate(() => {
      const input = document.querySelector('input[name="role"]') as HTMLInputElement | null;
      if (input) input.value = "centre_admin";
    });
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("A coach's role can't be changed here.")).toBeVisible();

    // Role, centre and the batch/attendance relationships are all unchanged.
    expect(await coachProfile()).toMatchObject({ role: "coach", centre_id: centreId });
    const { data: batchAfter } = await admin()
      .from("batches")
      .select("head_coach_id")
      .eq("id", batchId)
      .single();
    expect(batchAfter?.head_coach_id).toBe(coachId);
    const { data: attendanceAfter } = await admin()
      .from("attendance")
      .select("marked_by")
      .eq("id", attendanceId)
      .single();
    expect(attendanceAfter?.marked_by).toBe(coachId);
  });

  // The Server Action check above is only the first half of the lock: a
  // hand-rolled client never calls it. This signs in with the centre admin's
  // own credentials and PATCHes profiles straight through PostgREST — the
  // exact request prevent_role_escalation (20260918010000) has to refuse on
  // its own, without the app in the path.
  test("the coach role lock holds against a raw Data API PATCH", async () => {
    const authed = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await authed.auth.signInWithPassword({
      email: TEST_ACCOUNTS.centreAdmin,
      password: TEST_PASSWORD!,
    });
    expect(signInError).toBeNull();

    const { error } = await authed
      .from("profiles")
      .update({ role: "centre_admin" })
      .eq("id", coachId);

    // Raised by the trigger (SQLSTATE P0001), not silently filtered out by
    // RLS — the caller gets an error back, and nothing is written.
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/coach's role cannot be changed/i);

    expect(await coachProfile()).toMatchObject({ role: "coach", centre_id: centreId });
    const { data: batchAfter } = await admin()
      .from("batches")
      .select("head_coach_id")
      .eq("id", batchId)
      .single();
    expect(batchAfter?.head_coach_id).toBe(coachId);
  });

  test("an email already used by another account is rejected", async ({ page }) => {
    await signInAsCentreAdmin(page);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await page.getByRole("button", { name: "Edit" }).click();
    // Different case from the stored address: the duplicate check must still match.
    await page.getByLabel("Login Email").fill(TEST_ACCOUNTS.medical.toUpperCase());
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText(/an account with this email already exists/i)).toBeVisible();
    expect((await coachProfile()).email).toBe(originalEmail);
  });

  test("the coach edits their own profile and cannot change role or centre", async ({ browser }) => {
    const page = await newCoachPage(browser, originalEmail, coachPassword);
    await page.goto("/coach/profile");
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Login Email")).toHaveCount(0);
    await expect(page.getByLabel("Role")).toHaveCount(0);

    // Smuggled fields are ignored: the action reads only the details schema,
    // and the profile id comes from the session.
    await page.evaluate(
      ({ otherId }) => {
        const form = document.querySelector("form")!;
        for (const [name, value] of [
          ["role", "centre_admin"],
          ["centre_id", "00000000-0000-0000-0000-000000000000"],
          ["email", "smuggled@impetus.local"],
          ["profileId", otherId],
        ]) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
      },
      { otherId: otherCoachId }
    );

    await page.getByLabel("Name").fill("Self Edited Coach");
    await page.getByLabel("Contact Number").fill("9812345678");
    await page.getByLabel("City").fill("Mumbai");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByText("Mumbai")).toBeVisible();

    expect(await coachProfile()).toMatchObject({
      id: coachId,
      full_name: "Self Edited Coach",
      role: "coach",
      centre_id: centreId,
      email: originalEmail,
    });
    const { data: other } = await admin()
      .from("profiles")
      .select("full_name")
      .eq("id", otherCoachId)
      .single();
    expect(other?.full_name).toBe("Other Centre Coach");
    await page.context().close();
  });

  test("an ordinary signed-in session cannot use /reset-password", async ({ browser }) => {
    const page = await newCoachPage(browser, originalEmail, coachPassword);
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/coach$/);
    await page.goto("/reset-password?required=1");
    await expect(page).toHaveURL(/\/coach$/);
    await page.context().close();
  });

  test("changing your own password signs out every other session", async ({ browser }) => {
    const active = await newCoachPage(browser, originalEmail, coachPassword);
    const other = await newCoachPage(browser, originalEmail, coachPassword);

    const newPassword = "coach-changed-5678";
    await active.getByRole("button", { name: "Account menu" }).click();
    await active.getByRole("menuitem", { name: "Reset Password" }).click();
    await active.getByLabel("Current Password").fill(coachPassword);
    await active.getByLabel("New Password", { exact: true }).fill(newPassword);
    await active.getByLabel("Confirm New Password").fill(newPassword);
    await active.getByRole("button", { name: "Save" }).click();
    await expect(active.getByRole("dialog")).toHaveCount(0);
    coachPassword = newPassword;

    // The session that made the change continues (on a fresh session); the
    // other one is revoked.
    await active.goto("/coach/profile");
    await expect(active).toHaveURL(/\/coach\/profile/);
    expect(await sessionStillValid(active)).toBe(true);
    expect(await sessionStillValid(other)).toBe(false);

    await active.context().close();
    await other.context().close();
  });

  test("a centre admin changes the coach's email: sessions revoked, relationships kept", async ({
    page,
    browser,
  }) => {
    const coachSession = await newCoachPage(browser, originalEmail, coachPassword);

    await signInAsCentreAdmin(page);
    await page.goto(`/centre-admin/administrators/${coachId}`);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Login Email").fill(changedEmailInput);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect.poll(async () => (await coachProfile()).email).toBe(changedEmail);

    // Updated in place: same id, role, centre and name; auth.users moved too.
    expect(await coachProfile()).toMatchObject({
      id: coachId,
      role: "coach",
      centre_id: centreId,
      full_name: "Self Edited Coach",
    });
    const { data: authUser } = await admin().auth.admin.getUserById(coachId);
    expect(authUser.user?.email).toBe(changedEmail);

    const { data: batch } = await admin().from("batches").select("head_coach_id").eq("id", batchId).single();
    expect(batch?.head_coach_id).toBe(coachId);
    const { data: attendance } = await admin()
      .from("attendance")
      .select("marked_by")
      .eq("id", attendanceId)
      .single();
    expect(attendance?.marked_by).toBe(coachId);

    // The existing email-changed notice (with its password setup link) went
    // to the new address only. "failed" is accepted: *.local can't be
    // delivered, but the attempt is recorded either way.
    await expect
      .poll(async () => {
        const { data } = await admin()
          .from("email_logs")
          .select("recipient_email")
          .eq("email_type", "email_changed")
          .eq("recipient_profile_id", coachId);
        return (data ?? []).map((row) => row.recipient_email.toLowerCase());
      })
      .toEqual([changedEmail]);

    // The coach's existing session was revoked.
    expect(await sessionStillValid(coachSession)).toBe(false);
    await coachSession.context().close();
  });

  test("the setup link works in a fresh browser and the new email signs in", async ({ browser }) => {
    const link = await recoveryLinkFor(changedEmail);
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password/);

    const newPassword = "coach-setup-9012";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(`${newPassword}-x`);
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(page.getByText(/don't match/i)).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(page).toHaveURL(/\/login\?reset=success/);
    coachPassword = newPassword;
    await context.close();

    // Reusing the link is rejected, even in yet another fresh browser.
    const replayContext = await browser.newContext();
    const replay = await replayContext.newPage();
    await replay.goto(link);
    await expect(replay).toHaveURL(/\/login\?error=invalid-reset-link/);

    // The old email no longer signs in; the new one does.
    await signIn(replay, originalEmail, coachPassword);
    await expect(replay.getByText(/invalid email or password/i)).toBeVisible();
    await signIn(replay, changedEmail, coachPassword);
    await expect(replay).toHaveURL(/\/coach/);
    await replayContext.close();
  });

  test("a forced password change continues to the dashboard and clears the flag", async ({ browser }) => {
    await admin().from("profiles").update({ must_change_password: true }).eq("id", coachId);

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, changedEmail, coachPassword);
    await expect(page).toHaveURL(/\/reset-password\?required=1/);
    await expect(page.getByText(/temporary password/i)).toBeVisible();

    // Re-submitting the current (temporary) password doesn't clear the flag.
    await page.getByLabel("New password", { exact: true }).fill(coachPassword);
    await page.getByLabel("Confirm new password").fill(coachPassword);
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(page.getByText(/different from your current one/i)).toBeVisible();
    expect((await coachProfile()).must_change_password).toBe(true);

    const newPassword = "coach-forced-3456";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: /save password/i }).click();
    await expect(page).toHaveURL(/\/coach$/);
    expect((await coachProfile()).must_change_password).toBe(false);
    expect(await sessionStillValid(page)).toBe(true);

    // Still signed in (fresh session), not bounced to /login.
    await page.goto("/coach/profile");
    await expect(page).toHaveURL(/\/coach\/profile/);
    await context.close();
  });
});
