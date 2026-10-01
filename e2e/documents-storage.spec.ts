import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  TEST_ACCOUNTS,
  TEST_PASSWORD,
  SUPABASE_ANON_KEY,
  assertSafeE2ETarget,
  adminClient,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./helpers";

assertSafeE2ETarget();

// Document-integrity coverage for src/lib/storage/upload-doc-fields.ts against
// REAL storage and a REAL database: local Supabase Storage through its S3
// protocol (the same S3 client r2.ts uses, pointed there by R2_ENDPOINT) and
// the local Postgres. Nothing here can reach R2 or a deployed database.
//
// The "request" helpers below run the same sequence the Server Actions run —
// read the current document paths, uploadDocFields, a guardDocColumns UPDATE,
// then discardUploadedDocs or deleteReplacedDocs — but with explicit control
// of the interleaving, which a browser can't give. The Server Action wiring
// itself is covered end to end in documents-ui.spec.ts.
//
// Needs (see e2e/README.md): R2_ENDPOINT, R2_REGION, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME pointing at local Supabase Storage.
test.describe.configure({ mode: "serial" });

const SRC_DIR = path.resolve(__dirname, "../src");
const ENDPOINT = process.env.R2_ENDPOINT;
const BUCKET = process.env.R2_BUCKET_NAME;

test.describe("document upload integrity", () => {
  test.skip(
    !ENDPOINT || !BUCKET || !SERVICE_ROLE_KEY || !SUPABASE_URL,
    "Needs R2_ENDPOINT/R2_BUCKET_NAME (local Supabase Storage S3) and the Supabase service role — see e2e/README.md"
  );
  test.setTimeout(60_000);

  // 1x1 PNG: passes the upload's magic-byte sniffing.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  const png = (name: string) => new File([PNG], name, { type: "image/png" });

  const stamp = Date.now();
  const admin = () => adminClient();

  type Docs = typeof import("../src/lib/storage/upload-doc-fields");
  let docs: Docs;
  let s3: S3Client;

  let centreId: string;
  let centreAdminId: string;
  let playerId: string;
  let staffUserId: string;

  // Failure injection on the real S3 client, applied only while a test asks
  // for it. Everything else goes to real storage.
  const realSend = S3Client.prototype.send;
  let failPutNumber: number | null = null; // 1-based: fail this PutObject of the request
  let failDeletes = false;
  let putCount = 0;
  const errors: string[] = [];
  const realConsoleError = console.error;

  const playerDocFields = [
    { formKey: "aadhaarDoc", column: "aadhaar_doc_path" },
    { formKey: "medicalRecords", column: "medical_records_path" },
    { formKey: "profilePicture", column: "profile_picture_path" },
  ];
  const playerColumns = "aadhaar_doc_path, medical_records_path, profile_picture_path";

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

  async function playerDocs() {
    const { data, error } = await admin().from("players").select(playerColumns).eq("id", playerId).single();
    if (error) throw error;
    return data;
  }

  async function resetPlayerDocs(values: Record<string, string | null>) {
    await admin()
      .from("players")
      .update({ aadhaar_doc_path: null, medical_records_path: null, profile_picture_path: null, ...values })
      .eq("id", playerId);
  }

  function formWith(files: Record<string, File>) {
    const form = new FormData();
    for (const [key, file] of Object.entries(files)) form.set(key, file);
    return form;
  }

  // What every update action does before it writes: read the current paths,
  // then upload.
  async function beginRequest(files: Record<string, File>) {
    const { data: existing } = await admin().from("players").select(playerColumns).eq("id", playerId).single();
    const uploads = await docs.uploadDocFields(formWith(files), playerDocFields, `player-documents/${playerId}`);
    return { existing, uploads };
  }

  // The action's write: a guarded UPDATE, discarding this request's uploads if
  // it lost, deleting the replaced objects only if it won.
  async function commitRequest(req: Awaited<ReturnType<typeof beginRequest>>) {
    const { data } = await docs
      .guardDocColumns(
        admin().from("players").update(req.uploads.values).eq("id", playerId),
        req.existing,
        req.uploads.values
      )
      .select("id");
    if (!data?.length) {
      await docs.discardUploadedDocs(req.uploads.values);
      return "stale" as const;
    }
    docs.deleteReplacedDocs(req.existing ?? {}, req.uploads.values);
    return "saved" as const;
  }

  test.beforeAll(async () => {
    // r2.ts and upload-doc-fields.ts import "server-only", which throws outside
    // the Next server bundle. Pre-seed the module cache so it resolves to an
    // empty module in this Node process only.
    const serverOnly = require.resolve("server-only");
    require.cache[serverOnly] = { id: serverOnly, filename: serverOnly, loaded: true, exports: {} } as NodeModule;
    // The real logger pulls in @sentry/nextjs, which can't load outside Next.
    // Same behavior for these tests: it writes to console.error.
    const loggerPath = path.join(SRC_DIR, "lib", "logger.ts");
    require.cache[loggerPath] = {
      id: loggerPath,
      filename: loggerPath,
      loaded: true,
      exports: {
        logError: (message: string, error: unknown) => console.error(message, error),
        logWarning: (message: string, error?: unknown) => console.warn(message, error),
        logInfo: (message: string) => console.info(message),
      },
    } as unknown as NodeModule;
    // The "@/..." import alias isn't resolved for modules loaded this way.
    const nodeModule = require("module") as {
      _resolveFilename: (request: string, ...rest: unknown[]) => string;
    };
    const resolveFilename = nodeModule._resolveFilename;
    nodeModule._resolveFilename = function (request: string, ...rest: unknown[]) {
      const mapped = request.startsWith("@/") ? path.join(SRC_DIR, request.slice(2)) : request;
      return resolveFilename.call(this, mapped, ...rest);
    };
    docs = await import("../src/lib/storage/upload-doc-fields");

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

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Docs Player ${stamp}`,
        date_of_birth: "2013-01-01",
        parent_email: `docs-parent-${stamp}@impetus.local`,
        created_by: centreAdminId,
      })
      .select("id")
      .single();
    if (playerError) throw playerError;
    playerId = player.id;

    const { data: staff, error: staffError } = await db.auth.admin.createUser({
      email: `docs-coach-${stamp}@impetus.local`,
      password: "docs-coach-1234",
      email_confirm: true,
      app_metadata: { role: "coach", centre_id: centreId },
      user_metadata: { full_name: "Docs Fixture Coach" },
    });
    if (staffError || !staff.user) throw new Error(`Could not create staff user: ${staffError?.message}`);
    staffUserId = staff.user.id;

    S3Client.prototype.send = function (this: S3Client, command: unknown, ...rest: unknown[]) {
      if (command instanceof PutObjectCommand && failPutNumber !== null) {
        putCount += 1;
        if (putCount === failPutNumber) return Promise.reject(new Error("injected R2 upload failure"));
      }
      if (command instanceof DeleteObjectCommand && failDeletes) {
        return Promise.reject(new Error("injected R2 delete failure"));
      }
      return (realSend as (...a: unknown[]) => Promise<unknown>).call(this, command, ...rest);
    } as typeof S3Client.prototype.send;

    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
      realConsoleError(...args);
    };
  });

  test.afterAll(async () => {
    S3Client.prototype.send = realSend;
    console.error = realConsoleError;
    const db = admin();
    try {
      if (playerId) await db.from("players").delete().eq("id", playerId);
      if (staffUserId) await db.auth.admin.deleteUser(staffUserId);
      await db.storage.emptyBucket(BUCKET!);
      await db.storage.deleteBucket(BUCKET!);
    } catch (err) {
      console.warn("[e2e] document fixture cleanup failed:", err);
    }
  });

  // Every test starts from a player with no documents and an empty prefix.
  test.beforeEach(async () => {
    failPutNumber = null;
    failDeletes = false;
    putCount = 0;
    errors.length = 0;
    await resetPlayerDocs({});
    for (const prefix of [`player-documents/${playerId}/`, `staff-documents/${staffUserId}/`]) {
      for (const key of await keysUnder(prefix)) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      }
    }
  });

  test("one failed upload fails the whole batch, saves nothing and removes the other uploads", async () => {
    const oldKey = `player-documents/${playerId}/old-aadhaar.png`;
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });

    // Aadhaar, medical record and profile picture together; the 2nd PutObject fails.
    failPutNumber = 2;
    const { existing, uploads } = await beginRequest({
      aadhaarDoc: png("a.png"),
      medicalRecords: png("m.png"),
      profilePicture: png("p.png"),
    });

    expect(uploads.error).toMatch(/couldn't be uploaded, so nothing was saved/i);
    // No path for ANY document is handed back to the caller...
    expect(uploads.values).toEqual({});
    // ...the two uploads that succeeded were removed again...
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([oldKey]);
    // ...and the known-good document is untouched, in the DB and in storage.
    expect(existing?.aadhaar_doc_path).toBe(oldKey);
    expect((await playerDocs()).aadhaar_doc_path).toBe(oldKey);
    expect(await exists(oldKey)).toBe(true);
    expect(errors.some((line) => line.includes("Upload failed for"))).toBe(true);
  });

  test("every upload failing still saves nothing", async () => {
    await resetPlayerDocs({});
    // A single-file batch whose only upload fails.
    failPutNumber = 1;
    const { uploads } = await beginRequest({ aadhaarDoc: png("a.png") });
    expect(uploads.error).toMatch(/nothing was saved/i);
    expect(uploads.values).toEqual({});
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([]);
  });

  test("a validation rejection also removes the uploads that had succeeded", async () => {
    await resetPlayerDocs({});
    const notAnImage = new File([Buffer.from("plain text, not a document")], "notes.txt", { type: "text/plain" });
    const { uploads } = await beginRequest({ aadhaarDoc: png("a.png"), medicalRecords: notAnImage });
    expect(uploads.error).toMatch(/Unsupported file/);
    expect(uploads.values).toEqual({});
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([]);
  });

  test("a failed cleanup is logged as an orphaned object and never throws", async () => {
    await resetPlayerDocs({});
    failPutNumber = 2;
    failDeletes = true;
    const { uploads } = await beginRequest({ aadhaarDoc: png("a.png"), medicalRecords: png("m.png") });

    expect(uploads.error).toMatch(/nothing was saved/i);
    expect(uploads.values).toEqual({});
    expect(errors.some((line) => line.includes("Orphaned-object cleanup failed"))).toBe(true);

    failDeletes = false;
    // The leaked object is only in storage, never referenced by the row.
    const leaked = await keysUnder(`player-documents/${playerId}/`);
    expect(leaked).toHaveLength(1);
    expect(Object.values(await playerDocs())).not.toContain(leaked[0]);
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: leaked[0] }));
  });

  test("a fresh replacement deletes the old object only after the database points at the new one", async () => {
    const oldKey = `player-documents/${playerId}/old-aadhaar.png`;
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });

    const req = await beginRequest({ aadhaarDoc: png("new.png") });
    expect(req.uploads.error).toBeUndefined();
    const newKey = req.uploads.values.aadhaar_doc_path!;

    // Uploaded, database not yet updated: old is still the referenced document.
    expect(await exists(oldKey)).toBe(true);
    expect(await exists(newKey)).toBe(true);
    expect((await playerDocs()).aadhaar_doc_path).toBe(oldKey);

    const { data } = await docs
      .guardDocColumns(
        admin().from("players").update(req.uploads.values).eq("id", playerId),
        req.existing,
        req.uploads.values
      )
      .select("id");
    expect(data).toHaveLength(1);
    // Database updated, deletion not yet requested: nothing has been removed.
    expect((await playerDocs()).aadhaar_doc_path).toBe(newKey);
    expect(await exists(oldKey)).toBe(true);

    docs.deleteReplacedDocs(req.existing ?? {}, req.uploads.values);
    await expect.poll(() => exists(oldKey)).toBe(false);
    expect(await exists(newKey)).toBe(true);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([newKey]);
  });

  test("a failed upload leaves the old document referenced and present", async () => {
    const oldKey = `player-documents/${playerId}/keep-aadhaar.png`;
    await resetPlayerDocs({});
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });

    failPutNumber = 1;
    const { uploads } = await beginRequest({ aadhaarDoc: png("new.png") });
    expect(uploads.error).toBeDefined();

    expect((await playerDocs()).aadhaar_doc_path).toBe(oldKey);
    expect(await exists(oldKey)).toBe(true);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([oldKey]);
  });

  test("concurrent replacement of the same document: the loser is rejected and cleaned up, the winner stays", async () => {
    const oldKey = `player-documents/${playerId}/old-aadhaar.png`;
    await resetPlayerDocs({});
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });
    // Clear leftovers from earlier tests so the final listing is exact.
    for (const key of await keysUnder(`player-documents/${playerId}/`)) {
      if (key !== oldKey) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }

    // T0-T2: A and B both read the same state (old.png) and both upload.
    const [a, b] = await Promise.all([
      beginRequest({ aadhaarDoc: png("a.png") }),
      beginRequest({ aadhaarDoc: png("b.png") }),
    ]);
    const aKey = a.uploads.values.aadhaar_doc_path!;
    const bKey = b.uploads.values.aadhaar_doc_path!;
    expect(a.existing?.aadhaar_doc_path).toBe(oldKey);
    expect(b.existing?.aadhaar_doc_path).toBe(oldKey);

    // T3: A commits first and wins. T4: B's guard no longer matches.
    expect(await commitRequest(a)).toBe("saved");
    expect(await commitRequest(b)).toBe("stale");

    // The database references A's object; nothing was overwritten by B.
    expect((await playerDocs()).aadhaar_doc_path).toBe(aKey);
    // A's object exists, the old one is gone (A's deleteReplacedDocs), and B's
    // object was cleaned up. Nothing B did touched A's object or the old one
    // before A had replaced it.
    await expect.poll(() => exists(oldKey)).toBe(false);
    expect(await exists(aKey)).toBe(true);
    expect(await exists(bKey)).toBe(false);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([aKey]);
  });

  test("concurrent replacement of different documents: both are saved, nothing is lost", async () => {
    const oldAadhaar = `player-documents/${playerId}/old-aadhaar.png`;
    const oldMedical = `player-documents/${playerId}/old-medical.png`;
    for (const key of await keysUnder(`player-documents/${playerId}/`)) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }
    await seedObject(oldAadhaar);
    await seedObject(oldMedical);
    await resetPlayerDocs({ aadhaar_doc_path: oldAadhaar, medical_records_path: oldMedical });

    const [a, b] = await Promise.all([
      beginRequest({ aadhaarDoc: png("a.png") }),
      beginRequest({ medicalRecords: png("m.png") }),
    ]);

    // The guard only covers the columns a request replaces, so independent
    // documents are not treated as a conflict.
    expect(await commitRequest(a)).toBe("saved");
    expect(await commitRequest(b)).toBe("saved");

    const row = await playerDocs();
    expect(row.aadhaar_doc_path).toBe(a.uploads.values.aadhaar_doc_path);
    expect(row.medical_records_path).toBe(b.uploads.values.medical_records_path);
    await expect.poll(async () => (await keysUnder(`player-documents/${playerId}/`)).length).toBe(2);
    expect(await exists(row.aadhaar_doc_path!)).toBe(true);
    expect(await exists(row.medical_records_path!)).toBe(true);
    expect(await exists(oldAadhaar)).toBe(false);
    expect(await exists(oldMedical)).toBe(false);
  });

  test("staff documents: a concurrent replacement of the same document loses cleanly", async () => {
    const db = admin();
    const oldKey = `staff-documents/${staffUserId}/old-picture.png`;
    await seedObject(oldKey);
    await db.from("staff_profiles").delete().eq("profile_id", staffUserId);
    const { error } = await db
      .from("staff_profiles")
      .insert({ profile_id: staffUserId, contact_number: "9900123417", profile_picture_path: oldKey });
    expect(error).toBeNull();

    const staffFields = [{ formKey: "profilePicture", column: "profile_picture_path" }];
    const begin = async (name: string) => {
      const { data: existing } = await db
        .from("staff_profiles")
        .select("profile_picture_path")
        .eq("profile_id", staffUserId)
        .single();
      const uploads = await docs.uploadDocFields(
        formWith({ profilePicture: png(name) }),
        staffFields,
        `staff-documents/${staffUserId}`
      );
      return { existing, uploads };
    };
    const commit = async (req: Awaited<ReturnType<typeof begin>>) => {
      const { data } = await docs
        .guardDocColumns(
          db.from("staff_profiles").update(req.uploads.values).eq("profile_id", staffUserId),
          req.existing,
          req.uploads.values
        )
        .select("profile_id");
      if (!data?.length) {
        await docs.discardUploadedDocs(req.uploads.values);
        return "stale";
      }
      docs.deleteReplacedDocs(req.existing ?? {}, req.uploads.values);
      return "saved";
    };

    const [a, b] = await Promise.all([begin("a.png"), begin("b.png")]);
    expect(await commit(a)).toBe("saved");
    expect(await commit(b)).toBe("stale");

    const { data: row } = await db
      .from("staff_profiles")
      .select("profile_picture_path")
      .eq("profile_id", staffUserId)
      .single();
    expect(row?.profile_picture_path).toBe(a.uploads.values.profile_picture_path);
    await expect.poll(() => exists(oldKey)).toBe(false);
    expect(await keysUnder(`staff-documents/${staffUserId}/`)).toEqual([a.uploads.values.profile_picture_path]);
  });

  test("staff documents: a second first-time insert loses to the first instead of overwriting it", async () => {
    const db = admin();
    await db.from("staff_profiles").delete().eq("profile_id", staffUserId);
    for (const key of await keysUnder(`staff-documents/${staffUserId}/`)) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }

    const staffFields = [{ formKey: "profilePicture", column: "profile_picture_path" }];
    const upload = (name: string) =>
      docs.uploadDocFields(formWith({ profilePicture: png(name) }), staffFields, `staff-documents/${staffUserId}`);
    const [a, b] = await Promise.all([upload("a.png"), upload("b.png")]);

    const first = await db.from("staff_profiles").insert({ profile_id: staffUserId, ...a.values });
    const second = await db.from("staff_profiles").insert({ profile_id: staffUserId, ...b.values });
    expect(first.error).toBeNull();
    // Unique violation: the caller treats this as "changed by someone else".
    expect(second.error?.code).toBe("23505");
    await docs.discardUploadedDocs(b.values);

    expect(await keysUnder(`staff-documents/${staffUserId}/`)).toEqual([a.values.profile_picture_path]);
  });

  // ---------------------------------------------------------------------------
  // Signed document links (src/lib/storage/resolve-document-links.ts): "no
  // document", "available" and "exists but unavailable" stay distinct.

  type Links = typeof import("../src/lib/storage/resolve-document-links");
  const loadLinks = (): Promise<Links> => import("../src/lib/storage/resolve-document-links");

  test("signed links: a missing document is left out, an existing one gets a working URL", async () => {
    const links = await loadLinks();
    const key = `player-documents/${playerId}/linked.png`;
    await seedObject(key);

    const result = await links.resolveDocumentLinks({ aadhaar: key, medicalRecords: null, profilePicture: undefined });

    // No document: no entry at all, which the UI renders as "not uploaded".
    expect(Object.keys(result)).toEqual(["aadhaar"]);
    expect(await links.resolveDocumentLink("aadhaar", null)).toBeUndefined();

    // Existing document: a signed URL that really serves the object.
    expect(result.aadhaar?.status).toBe("available");
    const url = result.aadhaar?.status === "available" ? result.aadhaar.url : "";
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  });

  test("signed links: a signing failure keeps the document as 'unavailable' and leaks nothing", async () => {
    const links = await loadLinks();
    const key = `player-documents/${playerId}/secret-key-name.png`;
    await seedObject(key);

    // A real signing failure inside getSignedFileUrl (bucket not configured).
    const bucket = process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET_NAME;
    let result: Awaited<ReturnType<Links["resolveDocumentLinks"]>>;
    try {
      result = await links.resolveDocumentLinks({ aadhaar: key, medicalRecords: null });
    } finally {
      process.env.R2_BUCKET_NAME = bucket;
    }

    // The document is still known to exist — it is not turned into "no document"...
    expect(result).toEqual({ aadhaar: { status: "unavailable" } });
    // ...and what would be sent to the client carries no storage key or error detail.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(key);
    expect(serialized).not.toContain("secret-key-name");
    expect(serialized).not.toMatch(/R2_|bucket|error/i);
    // The failure is visible server-side.
    expect(errors.some((line) => line.includes("Failed to sign document URL") && line.includes(key))).toBe(true);
    // Nothing was touched in storage.
    expect(await exists(key)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Injury report documents (src/lib/injuries/report-document.ts), against the
  // real injuries table and real storage. Injuries are create-only — there is
  // no action that replaces report_doc_path — so these cover the create path.

  type Injuries = typeof import("../src/lib/injuries/report-document");
  type InjuryClient = Parameters<Injuries["insertInjuryWithReport"]>[0];
  const loadInjuries = (): Promise<Injuries> => import("../src/lib/injuries/report-document");
  const reportPrefix = () => `injury-reports/${playerId}/`;

  function injuryRow(description: string) {
    return {
      player_id: playerId,
      centre_id: centreId,
      date_of_injury: "2026-09-01",
      description,
      reported_by: centreAdminId,
    };
  }

  async function injuriesFor(description: string) {
    const { data, error } = await admin()
      .from("injuries")
      .select("id, report_doc_path")
      .eq("player_id", playerId)
      .eq("description", description);
    if (error) throw error;
    return data;
  }

  async function clearInjuries() {
    await admin().from("injuries").delete().eq("player_id", playerId);
    for (const key of await keysUnder(reportPrefix())) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    }
  }

  test("injury: a report upload is saved with the injury", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `ok-${stamp}`;

    const result = await injuries.insertInjuryWithReport(
      admin() as unknown as InjuryClient,
      formWith({ reportDocument: png("report.png") }),
      injuryRow(tag)
    );

    expect(result.error).toBeUndefined();
    const rows = await injuriesFor(tag);
    expect(rows).toHaveLength(1);
    expect(rows[0].report_doc_path).toMatch(new RegExp(`^${reportPrefix()}`));
    expect(await exists(rows[0].report_doc_path!)).toBe(true);
    expect(await keysUnder(reportPrefix())).toEqual([rows[0].report_doc_path]);
  });

  test("injury: without a report the injury saves with no document path", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `nodoc-${stamp}`;

    const result = await injuries.insertInjuryWithReport(admin() as unknown as InjuryClient, new FormData(), injuryRow(tag));

    expect(result.error).toBeUndefined();
    expect((await injuriesFor(tag))[0].report_doc_path).toBeNull();
  });

  test("injury: a failed report upload saves no injury and no path", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `upfail-${stamp}`;
    failPutNumber = 1;

    const result = await injuries.insertInjuryWithReport(
      admin() as unknown as InjuryClient,
      formWith({ reportDocument: png("report.png") }),
      injuryRow(tag)
    );

    expect(result.error).toMatch(/couldn't be uploaded, so nothing was saved/i);
    expect(await injuriesFor(tag)).toEqual([]);
    expect(await keysUnder(reportPrefix())).toEqual([]);
  });

  test("injury: a rejected report file saves no injury", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `invalid-${stamp}`;
    const notAnImage = new File([Buffer.from("plain text")], "notes.txt", { type: "text/plain" });

    const result = await injuries.insertInjuryWithReport(
      admin() as unknown as InjuryClient,
      formWith({ reportDocument: notAnImage }),
      injuryRow(tag)
    );

    expect(result.error).toMatch(/Unsupported file/);
    expect(await injuriesFor(tag)).toEqual([]);
    expect(await keysUnder(reportPrefix())).toEqual([]);
  });

  test("injury: an insert the database rejects removes this request's report", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `dbreject-${stamp}`;

    // reported_by points at no profile: a definite FK violation (23503).
    const result = await injuries.insertInjuryWithReport(
      admin() as unknown as InjuryClient,
      formWith({ reportDocument: png("report.png") }),
      { ...injuryRow(tag), reported_by: "00000000-0000-0000-0000-000000000000" }
    );

    expect(result.error).toBe(injuries.INJURY_SAVE_FAILED_MESSAGE);
    expect(await injuriesFor(tag)).toEqual([]);
    expect(await keysUnder(reportPrefix())).toEqual([]);
  });

  test("injury: a failed cleanup after a rejected insert is logged as an orphan and never throws", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `cleanupfail-${stamp}`;
    failDeletes = true;

    const result = await injuries.insertInjuryWithReport(
      admin() as unknown as InjuryClient,
      formWith({ reportDocument: png("report.png") }),
      { ...injuryRow(tag), reported_by: "00000000-0000-0000-0000-000000000000" }
    );
    failDeletes = false;

    expect(result.error).toBe(injuries.INJURY_SAVE_FAILED_MESSAGE);
    expect(errors.some((line) => line.includes("Orphaned-object cleanup failed"))).toBe(true);
    expect(await injuriesFor(tag)).toEqual([]);
    // The leaked object exists only in storage; no row references it.
    expect(await keysUnder(reportPrefix())).toHaveLength(1);
  });

  test("injury: an ambiguous database failure keeps the uploaded report", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const tag = `ambiguous-${stamp}`;

    // The insert request reaches the database, but the response is lost: the
    // row IS written, and the caller sees an error with no Postgres code.
    const lossyClient = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: async (input, init) => {
          await fetch(input, init);
          throw new TypeError("fetch failed: connection reset");
        },
      },
    });

    const result = await injuries.insertInjuryWithReport(
      lossyClient as unknown as InjuryClient,
      formWith({ reportDocument: png("report.png") }),
      injuryRow(tag)
    );

    expect(result.error).toBe(injuries.INJURY_SAVE_FAILED_MESSAGE);
    expect(errors.some((line) => line.includes("Injury insert outcome unknown"))).toBe(true);
    // The row that was in fact written still references an object that exists.
    const rows = await injuriesFor(tag);
    expect(rows).toHaveLength(1);
    expect(await exists(rows[0].report_doc_path!)).toBe(true);
    expect(await keysUnder(reportPrefix())).toEqual([rows[0].report_doc_path]);
  });

  test("injury: concurrent reports for the same player each keep their own document", async () => {
    const injuries = await loadInjuries();
    await clearInjuries();
    const [tagA, tagB] = [`concA-${stamp}`, `concB-${stamp}`];

    const [a, b] = await Promise.all([
      injuries.insertInjuryWithReport(
        admin() as unknown as InjuryClient,
        formWith({ reportDocument: png("a.png") }),
        injuryRow(tagA)
      ),
      injuries.insertInjuryWithReport(
        admin() as unknown as InjuryClient,
        formWith({ reportDocument: png("b.png") }),
        injuryRow(tagB)
      ),
    ]);

    expect(a.error).toBeUndefined();
    expect(b.error).toBeUndefined();
    const [rowA] = await injuriesFor(tagA);
    const [rowB] = await injuriesFor(tagB);
    expect(rowA.report_doc_path).not.toBe(rowB.report_doc_path);
    expect(await keysUnder(reportPrefix())).toEqual([rowA.report_doc_path, rowB.report_doc_path].sort());
    await clearInjuries();
  });

  // ---------------------------------------------------------------------------
  // Phase 3: document audit trail, entity deletion, reconciliation. Same real
  // database and real storage as above.

  type Lifecycle = typeof import("../src/lib/storage/document-lifecycle");
  type Reconcile = typeof import("../src/lib/storage/reconcile");
  type LifecycleClient = Parameters<Lifecycle["releaseDocuments"]>[0];
  type ReconcileDb = Parameters<Reconcile["reconcileDocuments"]>[0]["db"];
  const loadLifecycle = (): Promise<Lifecycle> => import("../src/lib/storage/document-lifecycle");
  const loadReconcile = (): Promise<Reconcile> => import("../src/lib/storage/reconcile");

  type AuditRow = {
    entity_type: string | null;
    entity_id: string | null;
    centre_id: string | null;
    document_field: string | null;
    action: string;
    old_key: string | null;
    new_key: string | null;
    reason: string | null;
    actor_id: string | null;
    created_at: string;
  };

  // Every audit event that mentions `key`, oldest first.
  async function auditFor(key: string): Promise<AuditRow[]> {
    const db = admin();
    const [asOld, asNew] = await Promise.all([
      db.from("document_audit_events").select("*").eq("old_key", key),
      db.from("document_audit_events").select("*").eq("new_key", key),
    ]);
    if (asOld.error) throw asOld.error;
    if (asNew.error) throw asNew.error;
    const rows = [...(asOld.data ?? []), ...(asNew.data ?? [])] as (AuditRow & { id: string })[];
    const unique = Array.from(new Map(rows.map((row) => [row.id, row])).values());
    return unique.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  const actions = async (key: string) => (await auditFor(key)).map((row) => `${row.action}:${row.reason ?? ""}`);

  // A client whose requests reach the server but whose responses are lost:
  // the operation happens, the caller sees an error with no Postgres code.
  function lossyAdmin() {
    return createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: async (input, init) => {
          await fetch(input, init);
          throw new TypeError("fetch failed: connection reset");
        },
      },
    });
  }

  // A client that cannot reach the database at all.
  function unreachableClient() {
    return createSupabaseClient("http://127.0.0.1:9", SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // A throwaway staff account with a staff_profiles row holding `docs`; every
  // key is also put in storage.
  async function createStaffWithDocs(tag: string, docKeys: Record<string, string>) {
    const db = admin();
    const { data, error } = await db.auth.admin.createUser({
      email: `docs-del-${tag}-${stamp}@impetus.local`,
      password: "docs-del-1234",
      email_confirm: true,
      app_metadata: { role: "coach", centre_id: centreId },
      user_metadata: { full_name: `Docs Delete ${tag}` },
    });
    if (error || !data.user) throw new Error(`Could not create staff user: ${error?.message}`);
    const userId = data.user.id;
    const { error: staffError } = await db
      .from("staff_profiles")
      .upsert({ profile_id: userId, contact_number: "9900123499", ...docKeys });
    if (staffError) throw staffError;
    for (const key of Object.values(docKeys)) await seedObject(key);
    return userId;
  }

  async function userExists(userId: string) {
    const { data } = await admin().from("profiles").select("id").eq("id", userId).maybeSingle();
    return Boolean(data);
  }

  const staffDocsOf = (lifecycle: Lifecycle, userId: string) => () =>
    lifecycle.collectDocumentReferences(admin() as unknown as LifecycleClient, "staff_profiles", "profile_id", [userId]);

  test("audit: a first upload and a replacement are recorded with their old and new keys", async () => {
    await resetPlayerDocs({});

    const first = await beginRequest({ aadhaarDoc: png("first.png") });
    expect(await commitRequest(first)).toBe("saved");
    const firstKey = first.uploads.values.aadhaar_doc_path!;

    const second = await beginRequest({ aadhaarDoc: png("second.png") });
    const { data } = await docs
      .guardDocColumns(
        admin().from("players").update(second.uploads.values).eq("id", playerId),
        second.existing,
        second.uploads.values
      )
      .select("id");
    expect(data).toHaveLength(1);
    docs.deleteReplacedDocs(second.existing ?? {}, second.uploads.values, {
      entityType: "player",
      entityId: playerId,
      centreId,
      actorId: centreAdminId,
    });
    const secondKey = second.uploads.values.aadhaar_doc_path!;

    // Written by the trigger, in the same transaction as each update.
    const [upload] = (await auditFor(firstKey)).filter((row) => row.action === "upload");
    expect(upload).toMatchObject({
      entity_type: "player",
      entity_id: playerId,
      centre_id: centreId,
      document_field: "aadhaar_doc_path",
      old_key: null,
      new_key: firstKey,
    });
    const [replace] = (await auditFor(secondKey)).filter((row) => row.action === "replace");
    expect(replace).toMatchObject({ entity_id: playerId, old_key: firstKey, new_key: secondKey });

    // Then the old object's cleanup, recorded by server code once it is gone.
    await expect.poll(() => actions(firstKey)).toEqual(["upload:", "replace:", "cleanup:replaced"]);
    const cleanup = (await auditFor(firstKey)).find((row) => row.action === "cleanup")!;
    expect(cleanup).toMatchObject({ entity_id: playerId, actor_id: centreAdminId, document_field: "aadhaar_doc_path" });
    expect(await exists(firstKey)).toBe(false);
  });

  test("audit: clearing a document column records a delete", async () => {
    const key = `player-documents/${playerId}/clear-me-${Date.now()}.png`;
    await resetPlayerDocs({ aadhaar_doc_path: key });
    await resetPlayerDocs({});
    expect(await actions(key)).toEqual(["upload:", "delete:"]);
  });

  test("audit: a lost save records no upload, only the discarded object's cleanup", async () => {
    const oldKey = `player-documents/${playerId}/cas-old.png`;
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });

    const [a, b] = await Promise.all([
      beginRequest({ aadhaarDoc: png("a.png") }),
      beginRequest({ aadhaarDoc: png("b.png") }),
    ]);
    expect(await commitRequest(a)).toBe("saved");
    expect(await commitRequest(b)).toBe("stale");

    const loserEvents = await auditFor(b.uploads.values.aadhaar_doc_path!);
    // Never presented as a saved document, only as an upload discarded again.
    expect(loserEvents.map((row) => `${row.action}:${row.reason}`)).toEqual(["cleanup:discarded_upload"]);
    expect(loserEvents[0]).toMatchObject({ entity_type: null, document_field: "aadhaar_doc_path" });
  });

  test("audit: a replaced object whose delete fails is recorded as an orphan", async () => {
    const oldKey = `player-documents/${playerId}/orphan-old.png`;
    await seedObject(oldKey);
    await resetPlayerDocs({ aadhaar_doc_path: oldKey });

    const req = await beginRequest({ aadhaarDoc: png("new.png") });
    failDeletes = true;
    try {
      const { data } = await docs
        .guardDocColumns(
          admin().from("players").update(req.uploads.values).eq("id", playerId),
          req.existing,
          req.uploads.values
        )
        .select("id");
      expect(data).toHaveLength(1);
      docs.deleteReplacedDocs(req.existing ?? {}, req.uploads.values, { entityType: "player", entityId: playerId });
      await expect.poll(() => actions(oldKey)).toContain("orphan:replaced_delete_failed");
    } finally {
      failDeletes = false;
    }

    expect(await actions(oldKey)).not.toContain("cleanup:replaced");
    // The save itself stands, and the old object is still in storage.
    expect((await playerDocs()).aadhaar_doc_path).toBe(req.uploads.values.aadhaar_doc_path);
    expect(await exists(oldKey)).toBe(true);
  });

  test("audit: an audit-trail failure never fails or reverts the document operation", async () => {
    await resetPlayerDocs({});
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let uploads: Awaited<ReturnType<Docs["uploadDocFields"]>>;
    // The audit writer's own service-role client now points nowhere.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    try {
      failPutNumber = 2;
      uploads = await docs.uploadDocFields(
        formWith({ aadhaarDoc: png("a.png"), medicalRecords: png("m.png") }),
        playerDocFields,
        `player-documents/${playerId}`
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    }

    // The batch still failed cleanly and its successful upload was removed...
    expect(uploads.error).toMatch(/nothing was saved/i);
    expect(await keysUnder(`player-documents/${playerId}/`)).toEqual([]);
    // ...and the audit failure was logged without the storage keys, not thrown.
    const auditErrors = errors.filter((line) => line.includes("document audit event"));
    expect(auditErrors).toHaveLength(1);
    expect(auditErrors[0]).not.toContain("player-documents/");
  });

  test("audit: centre users can neither read nor write audit events, and nobody can delete them", async () => {
    test.skip(!TEST_PASSWORD || !SUPABASE_ANON_KEY, "Needs DEV_DEFAULT_PASSWORD and the anon key");
    // Something in this centre to (not) see.
    const key = `player-documents/${playerId}/rls-probe-${Date.now()}.png`;
    await resetPlayerDocs({ aadhaar_doc_path: key });
    expect((await auditFor(key)).some((row) => row.centre_id === centreId)).toBe(true);

    const user = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await user.auth.signInWithPassword({
      email: TEST_ACCOUNTS.centreAdmin,
      password: TEST_PASSWORD!,
    });
    expect(signInError).toBeNull();

    try {
      const { data: visible, error: readError } = await user.from("document_audit_events").select("id");
      expect(readError).toBeNull();
      expect(visible).toEqual([]);

      const { error: insertError } = await user
        .from("document_audit_events")
        .insert({ action: "cleanup", old_key: "player-documents/forged.png" });
      expect(insertError).not.toBeNull();
    } finally {
      await user.auth.signOut();
    }

    // Append-only even for the service role.
    const { error: deleteError } = await admin().from("document_audit_events").delete().eq("new_key", key);
    expect(deleteError?.message).toMatch(/append-only/);
    const { error: updateError } = await admin()
      .from("document_audit_events")
      .update({ reason: "tampered" })
      .eq("new_key", key);
    expect(updateError?.message).toMatch(/append-only/);
  });

  test("delete: deleting a staff account removes its documents only after the database delete", async () => {
    const lifecycle = await loadLifecycle();
    const db = admin();
    const picture = `staff-documents/del-ok-${stamp}/picture.png`;
    const aadhaar = `staff-documents/del-ok-${stamp}/aadhaar.png`;
    const userId = await createStaffWithDocs("ok", { profile_picture_path: picture, aadhaar_doc_path: aadhaar });

    const result = await lifecycle.deleteWithDocumentCleanup(
      db as unknown as LifecycleClient,
      staffDocsOf(lifecycle, userId),
      async () => {
        // Nothing has been removed before the database delete.
        expect(await exists(picture)).toBe(true);
        return db.auth.admin.deleteUser(userId);
      },
      { actorId: centreAdminId, centreId, reason: "test_deleted" }
    );

    expect(result.deleted).toBe(true);
    expect(await userExists(userId)).toBe(false);
    expect(await exists(picture)).toBe(false);
    expect(await exists(aadhaar)).toBe(false);
    if (result.deleted) expect(result.cleanup.deleted.sort()).toEqual([aadhaar, picture].sort());
    // The cascade's reference removal (trigger), then the object cleanup.
    expect(await actions(picture)).toEqual(["upload:", "delete:row_deleted", "cleanup:test_deleted"]);
    const cleanup = (await auditFor(picture)).find((row) => row.action === "cleanup")!;
    expect(cleanup).toMatchObject({ entity_type: "staff_profile", entity_id: userId, actor_id: centreAdminId });
  });

  test("delete: a database delete that fails keeps every document", async () => {
    const lifecycle = await loadLifecycle();
    const db = admin();
    const picture = `staff-documents/del-fail-${stamp}/picture.png`;
    const userId = await createStaffWithDocs("fail", { profile_picture_path: picture });
    // players.created_by is ON DELETE RESTRICT: this account cannot be deleted.
    const { data: blocker, error: blockerError } = await db
      .from("players")
      .insert({
        centre_id: centreId,
        name: `E2E Delete Blocker ${stamp}`,
        date_of_birth: "2013-01-01",
        parent_email: `docs-blocker-${stamp}@impetus.local`,
        created_by: userId,
      })
      .select("id")
      .single();
    if (blockerError) throw blockerError;

    try {
      const result = await lifecycle.deleteWithDocumentCleanup(
        db as unknown as LifecycleClient,
        staffDocsOf(lifecycle, userId),
        () => db.auth.admin.deleteUser(userId),
        { reason: "test_deleted" }
      );

      expect(result.deleted).toBe(false);
      expect(await userExists(userId)).toBe(true);
      expect(await exists(picture)).toBe(true);
      expect(await actions(picture)).toEqual(["upload:"]);
    } finally {
      await db.from("players").delete().eq("id", blocker.id);
      await db.auth.admin.deleteUser(userId);
      await db.storage.from(BUCKET!).remove([picture]);
    }
  });

  test("delete: an unknown delete outcome keeps every document", async () => {
    const lifecycle = await loadLifecycle();
    const db = admin();
    const picture = `staff-documents/del-unknown-${stamp}/picture.png`;
    const userId = await createStaffWithDocs("unknown", { profile_picture_path: picture });
    const lossy = lossyAdmin();

    const result = await lifecycle.deleteWithDocumentCleanup(
      db as unknown as LifecycleClient,
      staffDocsOf(lifecycle, userId),
      () => lossy.auth.admin.deleteUser(userId),
      { reason: "test_deleted" }
    );

    expect(result.deleted).toBe(false);
    // The delete did happen; the caller could not know, so nothing was removed.
    expect(await userExists(userId)).toBe(false);
    expect(await exists(picture)).toBe(true);
    expect(await actions(picture)).toEqual(["upload:", "delete:row_deleted"]);
    await db.storage.from(BUCKET!).remove([picture]);
  });

  test("delete: a key another record still references is never deleted", async () => {
    const lifecycle = await loadLifecycle();
    const db = admin();
    const shared = `staff-documents/del-shared-${stamp}/shared.png`;
    const own = `staff-documents/del-shared-${stamp}/own.png`;
    const userId = await createStaffWithDocs("shared", { profile_picture_path: shared, aadhaar_doc_path: own });
    // The fixture player references the same object.
    await resetPlayerDocs({ profile_picture_path: shared });

    const result = await lifecycle.deleteWithDocumentCleanup(
      db as unknown as LifecycleClient,
      staffDocsOf(lifecycle, userId),
      () => db.auth.admin.deleteUser(userId),
      { reason: "test_deleted" }
    );

    expect(result.deleted).toBe(true);
    if (result.deleted) {
      expect(result.cleanup.kept).toEqual([shared]);
      expect(result.cleanup.deleted).toEqual([own]);
    }
    expect(await exists(shared)).toBe(true);
    expect(await exists(own)).toBe(false);
    expect((await playerDocs()).profile_picture_path).toBe(shared);
    expect(await actions(shared)).not.toContain("cleanup:test_deleted");
    await resetPlayerDocs({});
    await db.storage.from(BUCKET!).remove([shared]);
  });

  test("delete: a storage failure after the delete keeps the delete, is logged and recorded as an orphan", async () => {
    const lifecycle = await loadLifecycle();
    const db = admin();
    const picture = `staff-documents/del-r2fail-${stamp}/picture.png`;
    const userId = await createStaffWithDocs("r2fail", { profile_picture_path: picture });

    failDeletes = true;
    let result: Awaited<ReturnType<Lifecycle["deleteWithDocumentCleanup"]>>;
    try {
      result = await lifecycle.deleteWithDocumentCleanup(
        db as unknown as LifecycleClient,
        staffDocsOf(lifecycle, userId),
        () => db.auth.admin.deleteUser(userId),
        { reason: "test_deleted" }
      );
    } finally {
      failDeletes = false;
    }

    expect(result.deleted).toBe(true);
    expect(await userExists(userId)).toBe(false);
    if (result.deleted) expect(result.cleanup.orphaned).toEqual([picture]);
    expect(await exists(picture)).toBe(true);
    expect(errors.some((line) => line.includes("Orphaned-object cleanup failed") && line.includes(picture))).toBe(true);
    expect(await actions(picture)).toEqual(["upload:", "delete:row_deleted", "orphan:test_deleted_delete_failed"]);
    await db.storage.from(BUCKET!).remove([picture]);
  });

  test("delete: when references cannot be checked, nothing is deleted", async () => {
    const lifecycle = await loadLifecycle();
    const key = `staff-documents/del-nocheck-${stamp}/picture.png`;
    await seedObject(key);

    const summary = await lifecycle.releaseDocuments(
      unreachableClient() as unknown as LifecycleClient,
      [{ key, entityType: "staff_profile", entityId: staffUserId, column: "profile_picture_path" }],
      { reason: "test_deleted" }
    );

    expect(summary).toEqual({ deleted: [], kept: [], orphaned: [key] });
    expect(await exists(key)).toBe(true);
    expect(await actions(key)).toEqual(["orphan:test_deleted_reference_check_failed"]);
    await admin().storage.from(BUCKET!).remove([key]);
  });

  test("reconcile: referenced, missing and shared keys are classified from the database references", async () => {
    const rec = await loadReconcile();
    const referenced = `player-documents/${playerId}/rec-referenced.png`;
    const missing = `player-documents/${playerId}/rec-missing.png`;
    const shared = `player-documents/${playerId}/rec-shared.png`;
    await seedObject(referenced);
    await seedObject(shared);
    await resetPlayerDocs({ aadhaar_doc_path: referenced, medical_records_path: missing, profile_picture_path: shared });
    await clearInjuries();
    const { error } = await admin()
      .from("injuries")
      .insert({ ...injuryRow(`rec-shared-${stamp}`), report_doc_path: shared });
    if (error) throw error;

    try {
      const report = await rec.reconcileDocuments({
        db: admin() as unknown as ReconcileDb,
        inventory: rec.s3Inventory(s3, BUCKET!),
      });
      const entry = (key: string) => report.entries.find((e) => e.key === key);

      expect(entry(referenced)).toMatchObject({ status: "referenced", exists: true, referenceCount: 1 });
      expect(entry(referenced)?.references).toEqual([
        { entityType: "player", entityId: playerId, column: "aadhaar_doc_path" },
      ]);
      expect(entry(missing)).toMatchObject({ status: "missing", exists: false, referenceCount: 1 });
      expect(entry(shared)).toMatchObject({ status: "shared", exists: true, referenceCount: 2 });
      expect(entry(shared)?.references.map((r) => r.entityType).sort()).toEqual(["injury", "player"]);
      expect(report.summary.missing).toBeGreaterThanOrEqual(1);
      // Reported, never repaired: the reference and the objects are untouched.
      expect((await playerDocs()).medical_records_path).toBe(missing);
      expect(await exists(referenced)).toBe(true);
      expect(await exists(shared)).toBe(true);
    } finally {
      await clearInjuries();
    }
  });

  test("reconcile: an unreferenced object is only reported as orphaned once past the grace period", async () => {
    const rec = await loadReconcile();
    const orphan = `player-documents/${playerId}/rec-orphan.png`;
    await seedObject(orphan);
    await resetPlayerDocs({});
    const db = admin() as unknown as ReconcileDb;
    const inventory = rec.s3Inventory(s3, BUCKET!);

    const fresh = await rec.reconcileDocuments({ db, inventory });
    expect(fresh.entries.find((e) => e.key === orphan)).toMatchObject({
      status: "grace_period",
      exists: true,
      referenceCount: 0,
    });

    // The same object, two days later.
    const later = await rec.reconcileDocuments({ db, inventory, now: new Date(Date.now() + 48 * 3600 * 1000) });
    const entry = later.entries.find((e) => e.key === orphan)!;
    expect(entry.status).toBe("unreferenced");
    expect(entry.ageSeconds).toBeGreaterThan(47 * 3600);
    // Detection only: the object is still there.
    expect(await exists(orphan)).toBe(true);

    // An object of unknown age is never called orphaned.
    const [unknownAge] = rec.classifyDocuments([], [{ key: orphan, lastModified: null, size: null }], {
      now: new Date(),
      gracePeriodMs: 0,
    });
    expect(unknownAge.status).toBe("grace_period");
  });

  test("reconcile: objects outside the document prefixes are ignored, and a failed listing fails the report", async () => {
    const rec = await loadReconcile();
    const logo = `centre-logos/e2e-${stamp}.png`;
    const unrelated = `misc-${stamp}/file.png`;
    await seedObject(logo);
    await seedObject(unrelated);
    const db = admin() as unknown as ReconcileDb;

    try {
      const report = await rec.reconcileDocuments({ db, inventory: rec.s3Inventory(s3, BUCKET!) });
      const keys = report.entries.map((e) => e.key);
      expect(keys).not.toContain(logo);
      expect(keys).not.toContain(unrelated);
      // Even when handed such objects directly, they are not documents.
      expect(
        rec.classifyDocuments([], [{ key: logo, lastModified: new Date(0), size: 1 }], {
          now: new Date(),
          gracePeriodMs: 0,
        })
      ).toEqual([]);

      // Never "everything is missing" because storage could not be listed.
      await expect(
        rec.reconcileDocuments({ db, inventory: rec.s3Inventory(s3, `no-such-bucket-${stamp}`) })
      ).rejects.toThrow();
    } finally {
      await admin().storage.from(BUCKET!).remove([logo, unrelated]);
    }
  });
});
