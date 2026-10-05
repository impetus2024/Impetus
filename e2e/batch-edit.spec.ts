import { test, expect, type Page } from "@playwright/test";
import {
  TEST_ACCOUNTS,
  TEST_PASSWORD,
  loginAs,
  assertSafeE2ETarget,
  adminClient,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./helpers";

assertSafeE2ETarget();

// Head / assistant coach management on the Edit Batch dialog: removing a
// coach, swapping one in, and the server-side checks behind both. Runs
// serially against throwaway coaches, batches and a throwaway second centre,
// so it never touches the seeded fixtures other specs read.
test.describe.configure({ mode: "serial" });

test.describe("batch coach management", () => {
  test.skip(
    !TEST_PASSWORD || !SERVICE_ROLE_KEY || !SUPABASE_URL,
    "Needs DEV_DEFAULT_PASSWORD, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL — see e2e/README.md"
  );
  test.setTimeout(90_000);

  const stamp = Date.now();
  const batchNames = {
    clearHead: `E2E Clear Head ${stamp}`,
    clearAssistant: `E2E Clear Assistant ${stamp}`,
    promote: `E2E Promote ${stamp}`,
    assign: `E2E Assign Both ${stamp}`,
    untouched: `E2E Untouched ${stamp}`,
  };
  const coachNames = {
    alpha: `Alpha Coach ${stamp}`,
    bravo: `Bravo Coach ${stamp}`,
    charlie: `Charlie Coach ${stamp}`,
    elsewhere: `Elsewhere Coach ${stamp}`,
  };

  let centreId: string;
  let alphaId: string;
  let bravoId: string;
  let charlieId: string;
  let parentId: string;
  let otherCentreId: string;
  let otherCoachId: string;
  let ageCategoryId: string;
  const batchIds: Record<keyof typeof batchNames, string> = {
    clearHead: "",
    clearAssistant: "",
    promote: "",
    assign: "",
    untouched: "",
  };

  const admin = () => adminClient();

  async function batchRow(id: string) {
    const { data, error } = await admin()
      .from("batches")
      .select("name, head_coach_id, assistant_coach_id, is_active")
      .eq("id", id)
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

    async function createStaff(role: "coach" | "parent", email: string, fullName: string, centre: string) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: `e2e-batch-${stamp}-1234`,
        email_confirm: true,
        app_metadata: { role, centre_id: centre },
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw new Error(`Could not create ${role} ${email}: ${error?.message}`);
      return data.user.id;
    }

    alphaId = await createStaff("coach", `alpha-${stamp}@impetus.local`, coachNames.alpha, centreId);
    bravoId = await createStaff("coach", `bravo-${stamp}@impetus.local`, coachNames.bravo, centreId);
    charlieId = await createStaff("coach", `charlie-${stamp}@impetus.local`, coachNames.charlie, centreId);
    // A same-centre non-coach, to prove the server re-checks the role rather
    // than trusting the id it is handed.
    parentId = await createStaff("parent", `batch-parent-${stamp}@impetus.local`, "Batch Parent", centreId);

    // A second centre, whose coach must not be assignable from this one.
    const { data: otherCentre, error: centreError } = await db
      .from("centres")
      .insert({
        name: `E2E Batch Centre ${stamp}`,
        contact_number: "9900000000",
        email: `batch-centre-${stamp}@impetus.local`,
        country: "India",
      })
      .select("id")
      .single();
    if (centreError) throw centreError;
    otherCentreId = otherCentre.id;
    otherCoachId = await createStaff(
      "coach",
      `elsewhere-${stamp}@impetus.local`,
      coachNames.elsewhere,
      otherCentreId
    );

    const { data: ageCategory, error: ageError } = await db
      .from("age_categories")
      .select("id")
      .eq("centre_id", centreId)
      .limit(1)
      .single();
    if (ageError || !ageCategory) {
      throw new Error(`No age category for the seeded centre — run 'npm run seed:mock-data' (${ageError?.message})`);
    }
    ageCategoryId = ageCategory.id;

    // One batch per scenario, so each test starts from a state it owns
    // instead of whatever the previous test left behind.
    async function createBatch(name: string, headCoachId: string | null, assistantCoachId: string | null) {
      const { data, error } = await db
        .from("batches")
        .insert({
          centre_id: centreId,
          name,
          head_coach_id: headCoachId,
          assistant_coach_id: assistantCoachId,
          age_category_id: ageCategoryId,
          start_time: "07:00",
          end_time: "08:00",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }

    batchIds.clearHead = await createBatch(batchNames.clearHead, alphaId, bravoId);
    batchIds.clearAssistant = await createBatch(batchNames.clearAssistant, alphaId, bravoId);
    batchIds.promote = await createBatch(batchNames.promote, alphaId, bravoId);
    batchIds.assign = await createBatch(batchNames.assign, null, null);
    batchIds.untouched = await createBatch(batchNames.untouched, alphaId, bravoId);
  });

  // Removes only what this spec created, in FK order (batches hold a RESTRICT
  // reference to profiles, so they have to go before the users).
  test.afterAll(async () => {
    const db = admin();
    const ids = Object.values(batchIds).filter(Boolean);
    if (ids.length) await db.from("batches").delete().in("id", ids);
    for (const id of [alphaId, bravoId, charlieId, parentId, otherCoachId]) {
      if (id) await db.auth.admin.deleteUser(id);
    }
    if (otherCentreId) await db.from("centres").delete().eq("id", otherCentreId);
  });

  // Opens Edit Batch for one batch, found by its (unique) name so paging and
  // the other seeded batches can't get in the way.
  async function openEdit(page: Page, batchName: string) {
    await page.goto(`/centre-admin/batches?q=${encodeURIComponent(batchName)}`);
    const row = page.getByRole("row", { name: batchName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog").getByText("Edit Batch")).toBeVisible();
    return row;
  }

  async function pick(page: Page, label: string, option: string) {
    await page.getByLabel(label).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }

  async function save(page: Page) {
    await page.getByRole("button", { name: "Save" }).click();
    // The dialog closes only on success — a rejected save leaves it open so
    // the error stays readable.
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  }

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/);
  });

  test("the head coach can be removed from a batch", async ({ page }) => {
    const row = await openEdit(page, batchNames.clearHead);
    // The dialog opens on what is stored, not on an empty slot. (The trigger's
    // text also carries the chevron icon, hence toContainText.)
    await expect(page.getByLabel("Head Coach")).toContainText(coachNames.alpha);
    await expect(page.getByLabel("Assistant Coach (optional)")).toContainText(coachNames.bravo);

    await pick(page, "Head Coach", "No head coach");
    await save(page);

    // The batch survives with its assistant intact — clearing one slot is not
    // a delete.
    await expect.poll(async () => (await batchRow(batchIds.clearHead)).head_coach_id).toBeNull();
    const stored = await batchRow(batchIds.clearHead);
    expect(stored.assistant_coach_id).toBe(bravoId);
    expect(stored.is_active).toBe(true);

    // …and the list shows the empty slot rather than a blank cell.
    await expect(row.getByRole("cell").nth(1)).toHaveText("—");
    await expect(row.getByRole("cell").nth(2)).toHaveText(coachNames.bravo);
  });

  test("the assistant coach can be cleared", async ({ page }) => {
    const row = await openEdit(page, batchNames.clearAssistant);
    await expect(page.getByLabel("Assistant Coach (optional)")).toContainText(coachNames.bravo);

    await pick(page, "Assistant Coach (optional)", "No assistant coach");
    await save(page);

    await expect.poll(async () => (await batchRow(batchIds.clearAssistant)).assistant_coach_id).toBeNull();
    expect((await batchRow(batchIds.clearAssistant)).head_coach_id).toBe(alphaId);

    await expect(row.getByRole("cell").nth(2)).toHaveText("—");
    await expect(row.getByRole("cell").nth(1)).toHaveText(coachNames.alpha);
  });

  test("promoting the assistant to head coach clears the assistant slot in one save", async ({ page }) => {
    await openEdit(page, batchNames.promote);

    // Bravo can't hold both slots (the DB CHECK forbids it), so picking him as
    // head drops him from assistant as part of the same save instead of
    // failing on submit.
    await pick(page, "Head Coach", coachNames.bravo);
    await expect(page.getByLabel("Assistant Coach (optional)")).toContainText("No assistant coach");
    await save(page);

    const stored = await batchRow(batchIds.promote);
    expect(stored.head_coach_id).toBe(bravoId);
    expect(stored.assistant_coach_id).toBeNull();
  });

  test("a batch with no head coach can be given one, plus an assistant", async ({ page }) => {
    await openEdit(page, batchNames.assign);
    // The empty slot reads as a real state, not as "nothing selected yet".
    await expect(page.getByLabel("Head Coach")).toContainText("No head coach");

    await pick(page, "Head Coach", coachNames.charlie);
    await pick(page, "Assistant Coach (optional)", coachNames.alpha);
    await save(page);

    const stored = await batchRow(batchIds.assign);
    expect(stored.head_coach_id).toBe(charlieId);
    expect(stored.assistant_coach_id).toBe(alphaId);
  });

  test("saving without touching either coach writes back exactly what is stored", async ({ page }) => {
    await openEdit(page, batchNames.untouched);
    await save(page);

    const stored = await batchRow(batchIds.untouched);
    expect(stored.head_coach_id).toBe(alphaId);
    expect(stored.assistant_coach_id).toBe(bravoId);
  });

  test("Add Batch still requires a head coach and offers no removal option", async ({ page }) => {
    await page.goto("/centre-admin/batches");
    await page.getByRole("button", { name: "Add Batch" }).click();
    await expect(page.getByRole("dialog").getByText("Add Batch")).toBeVisible();

    // "No head coach" is an edit-only affordance: a new batch has to start
    // with someone responsible for it.
    await page.getByLabel("Head Coach").click();
    await expect(page.getByRole("option", { name: "No head coach" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const name = `E2E Never Created ${stamp}`;
    await page.getByLabel("Batch Name").fill(name);
    await page.getByLabel("Start Time").fill("09:00");
    await page.getByLabel("End Time").fill("10:00");
    await page.getByRole("button", { name: "Save" }).click();

    // Blocked before or at the server — either way nothing is written.
    await expect(page.getByRole("dialog")).toBeVisible();
    const { data, error } = await admin().from("batches").select("id").eq("name", name);
    if (error) throw error;
    expect(data).toHaveLength(0);
  });

  // The Select only offers coaches from this centre, so a forged id is the
  // only way to reach the server-side check the UI itself can't produce.
  // Writing the value straight into the submitted field is what a crafted
  // request does, and React reads the form back out of the DOM on submit.
  async function saveWithForgedHeadCoach(page: Page, forgedId: string) {
    await page.evaluate((id) => {
      const input = document.querySelector<HTMLInputElement>('input[name="headCoachId"]');
      if (!input) throw new Error("head coach field not found");
      input.value = id;
    }, forgedId);
    await page.getByRole("button", { name: "Save" }).click();
  }

  test("a coach from another centre is rejected server-side", async ({ page }) => {
    await openEdit(page, batchNames.assign);
    await saveWithForgedHeadCoach(page, otherCoachId);

    await expect(page.getByText("Head coach must be a coach from your centre.")).toBeVisible();
    // The dialog stays open and the stored coach is untouched.
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await batchRow(batchIds.assign)).head_coach_id).toBe(charlieId);
  });

  test("a same-centre profile that is not a coach is rejected server-side", async ({ page }) => {
    await openEdit(page, batchNames.assign);
    await saveWithForgedHeadCoach(page, parentId);

    await expect(page.getByText("Head coach must be a coach from your centre.")).toBeVisible();
    expect((await batchRow(batchIds.assign)).head_coach_id).toBe(charlieId);
  });
});
