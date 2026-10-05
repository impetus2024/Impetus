import { test, expect, type Page } from "@playwright/test";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
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

// Document behavior through the real Server Actions (updatePlayerProfile,
// createAdministrator) against real local storage: the app server started by
// Playwright inherits R2_ENDPOINT & co from this process's environment and so
// talks to local Supabase Storage's S3 endpoint instead of R2. A real upload
// failure is produced by shrinking the bucket's file size limit, which the
// storage server enforces on the S3 protocol like any other storage error.
//
// Both this file and documents-storage.spec.ts use the one bucket the server
// is configured with (R2_BUCKET_NAME) and the one dev server, so
// playwright.config.ts runs the suite with a single worker and keeps the two
// documents specs together, last — see e2e/README.md.
test.describe.configure({ mode: "serial" });

const ENDPOINT = process.env.R2_ENDPOINT;
const BUCKET = process.env.R2_BUCKET_NAME;

test.describe("document saves through the app", () => {
  test.skip(
    !TEST_PASSWORD || !SERVICE_ROLE_KEY || !SUPABASE_URL || !ENDPOINT || !BUCKET,
    "Needs DEV_DEFAULT_PASSWORD, the Supabase service role and R2_ENDPOINT/R2_BUCKET_NAME (local Supabase Storage S3) — see e2e/README.md"
  );
  test.setTimeout(90_000);

  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  const upload = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

  const stamp = Date.now();
  const admin = () => adminClient();
  let s3: S3Client;
  let centreId: string;
  let centreAdminId: string;
  let playerId: string;
  const createdAdminEmails: string[] = [];

  async function exists(key: string) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async function keysUnder(prefix: string) {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    return (out.Contents ?? []).map((o) => o.Key!).sort();
  }

  async function seedObject(key: string) {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: PNG, ContentType: "image/png" }));
  }

  async function pictureKey() {
    const { data, error } = await admin().from("players").select("profile_picture_path").eq("id", playerId).single();
    if (error) throw error;
    return data.profile_picture_path;
  }

  async function setUploadLimit(bytes: number | null) {
    const { error } = await admin().storage.updateBucket(BUCKET!, {
      public: false,
      fileSizeLimit: bytes ?? "50MB",
    });
    if (error) throw error;
  }

  async function openProfileEditor(page: Page) {
    await page.goto(`/centre-admin/players/${playerId}`);
    await page.getByRole("button", { name: "Edit" }).click();
  }

  test.beforeAll(async () => {
    const endpoint = new URL(ENDPOINT!);
    if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) {
      throw new Error(`Refusing to run document tests against non-local storage ${ENDPOINT}`);
    }
    s3 = new S3Client({
      region: process.env.R2_REGION ?? "auto",
      endpoint: ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const db = admin();
    const { error: bucketError } = await db.storage.createBucket(BUCKET!, { public: false });
    if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

    const { data: ca, error: caError } = await db
      .from("profiles")
      .select("id, centre_id")
      .eq("email", TEST_ACCOUNTS.centreAdmin)
      .single();
    if (caError || !ca?.centre_id) throw new Error(`Seeded centre admin not found: ${caError?.message}`);
    centreId = ca.centre_id;
    centreAdminId = ca.id;

    // Find an active, non-custom package for this centre to satisfy the
    // PlayerSchema validation in updatePlayerProfile (which requires a package).
    const { data: pkg, error: pkgError } = await db
      .from("packages")
      .select("id, player_type_id")
      .eq("centre_id", centreId)
      .eq("is_custom", false)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (pkgError || !pkg) throw new Error(`No active package found for centre ${centreId}: ${pkgError?.message}`);

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Docs UI Player ${stamp}`,
        date_of_birth: "2013-01-01",
        parent_email: `docs-ui-parent-${stamp}@impetus.local`,
        created_by: centreAdminId,
        package_id: pkg.id,
        player_type_id: pkg.player_type_id,
      })
      .select("id")
      .single();
    if (playerError) throw playerError;
    playerId = player.id;
  });

  test.afterAll(async () => {
    const db = admin();
    try {
      await setUploadLimit(null);
      if (playerId) await db.from("players").delete().eq("id", playerId);
      for (const email of createdAdminEmails) {
        const { data } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
        if (data) await db.auth.admin.deleteUser(data.id);
      }
      await db.storage.emptyBucket(BUCKET!);
      await db.storage.deleteBucket(BUCKET!);
    } catch (err) {
      console.warn("[e2e] document UI fixture cleanup failed:", err);
    }
  });

  test.beforeEach(async () => {
    await setUploadLimit(null);
    for (const key of await keysUnder(`player-documents/${playerId}/`)) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }
    await admin().from("players").update({ profile_picture_path: null }).eq("id", playerId);
  });

  test("replacing a document saves the new one and deletes the old one only afterwards", async ({ page }) => {
    const oldKey = `player-documents/${playerId}/old-picture.png`;
    await seedObject(oldKey);
    await admin().from("players").update({ profile_picture_path: oldKey }).eq("id", playerId);

    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/, { timeout: 30_000 });
    await openProfileEditor(page);
    await page.getByLabel("Upload Profile Picture").setInputFiles(upload("new.png"));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible({ timeout: 30_000 });

    const newKey = await pictureKey();
    expect(newKey).not.toBeNull();
    expect(newKey).not.toBe(oldKey);
    expect(await exists(newKey!)).toBe(true);
    await expect.poll(() => exists(oldKey)).toBe(false);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([newKey]);
  });

  test("a failed upload saves nothing, keeps the old document and shows an error", async ({ page }) => {
    const oldKey = `player-documents/${playerId}/keep-picture.png`;
    await seedObject(oldKey);
    await admin().from("players").update({ profile_picture_path: oldKey }).eq("id", playerId);

    // Storage now rejects any upload bigger than 10 bytes.
    await setUploadLimit(10);

    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/, { timeout: 30_000 });
    await openProfileEditor(page);
    await page.getByLabel("Name").fill("Renamed While Upload Fails");
    await page.getByLabel("Upload Profile Picture").setInputFiles(upload("new.png"));
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/couldn't be uploaded, so nothing was saved/i)).toBeVisible({ timeout: 30_000 });

    // Nothing was saved: not the picture, not the other edited field.
    expect(await pictureKey()).toBe(oldKey);
    const { data: row } = await admin().from("players").select("name").eq("id", playerId).single();
    expect(row?.name).toBe(`E2E Docs UI Player ${stamp}`);
    expect(await exists(oldKey)).toBe(true);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([oldKey]);
  });

  test("two simultaneous replacements never leave an orphaned or missing document", async ({ page, context }) => {
    const oldKey = `player-documents/${playerId}/old-picture.png`;
    await seedObject(oldKey);
    await admin().from("players").update({ profile_picture_path: oldKey }).eq("id", playerId);

    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/, { timeout: 30_000 });
    const other = await context.newPage();

    await openProfileEditor(page);
    await openProfileEditor(other);
    await page.getByLabel("Upload Profile Picture").setInputFiles(upload("first.png"));
    await other.getByLabel("Upload Profile Picture").setInputFiles(upload("second.png"));

    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      other.getByRole("button", { name: "Save" }).click(),
    ]);

    // Each request ends either saved (back in view mode) or rejected as stale.
    for (const p of [page, other]) {
      await expect(
        p.getByRole("button", { name: "Edit" }).or(p.getByText(/changed by someone else/i))
      ).toBeVisible({ timeout: 30_000 });
    }

    // Whichever ordering the two requests took (one rejected, or one after the
    // other), the row references an object that exists and it is the only
    // object left: no lost document, no orphan, and the old one is gone.
    const finalKey = await pictureKey();
    expect(finalKey).not.toBe(oldKey);
    expect(await exists(finalKey!)).toBe(true);
    await expect.poll(() => keysUnder(`player-documents/${playerId}/`)).toEqual([finalKey]);
    await other.close();
  });

  test("creating an administrator when the picture fails to upload saves no broken reference", async ({ page }) => {
    await setUploadLimit(10);

    await loginAs(page, TEST_ACCOUNTS.centreAdmin);
    await expect(page).toHaveURL(/\/centre-admin/, { timeout: 30_000 });
    await page.goto("/centre-admin/administrators");
    await page.getByRole("button", { name: "Add Administrator" }).click();

    const email = `docs-ui-admin-${stamp}@impetus.local`;
    createdAdminEmails.push(email);
    await page.getByLabel("Name").fill("Docs UI Administrator");
    await page.getByLabel("Email ID").fill(email);
    await page.getByLabel("Contact Number").fill("9999999999");
    await page.getByLabel("Role").click();
    await page.getByRole("option", { name: "Coach" }).click();
    await page.getByLabel("Upload Profile Picture").setInputFiles(upload("avatar.png"));
    await page.getByRole("button", { name: "Create Administrator" }).click();

    // The account exists, but the user is told its documents were not saved.
    await expect(page.getByText(/documents were not saved/i)).toBeVisible({ timeout: 30_000 });
    const { data: profile } = await admin().from("profiles").select("id").eq("email", email).single();
    const { data: staff } = await admin()
      .from("staff_profiles")
      .select("profile_picture_path")
      .eq("profile_id", profile!.id)
      .single();
    expect(staff?.profile_picture_path).toBeNull();
    expect(await keysUnder(`staff-documents/${profile!.id}/`)).toEqual([]);
  });
});
