import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import ts from "typescript";
import { CareerError, defaultNotifications, defaultPreferences, defaultProfile } from "../lib/career-core.ts";

// Injected provider responses and senders are test doubles. No live jobs or messages
// are used. The SQL below runs through every real checked-in schema migration.
const coreUrl = new URL("../lib/career-core.ts", import.meta.url).href;
async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = from === "resend" ? source.replace('from "resend"', `from ${JSON.stringify(to)}`) : source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}
const providersUrl = await moduleUrl("../lib/career-providers.ts", { "./career-core": coreUrl });
const providers = await import(providersUrl);
const alerts = await import(await moduleUrl("../lib/career-alerts.ts", { "./career-core": coreUrl, "./career-providers": providersUrl, resend: import.meta.resolve("resend") }));
const worker = await import(await moduleUrl("../worker/scheduler.ts"));
const { CareerStore } = await import(await moduleUrl("../lib/career-store.ts", { "./career-core": coreUrl }));
const migrationFiles = (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
const migrations = await Promise.all(migrationFiles.map((name) => readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8")));
class SQLiteD1 {
  db = new DatabaseSync(":memory:");
  failSql = null;
  constructor() { this.db.exec("PRAGMA foreign_keys=ON;"); for (const migration of migrations) this.db.exec(migration); }
  prepare(sql) {
    const db = this.db;
    const bound = (values) => ({
      sql, bind: (...next) => bound(next),
      rawRun: () => { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      run: async () => { const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      first: async () => db.prepare(sql).get(...values) ?? null,
      all: async () => ({ success: true, results: db.prepare(sql).all(...values) }),
    });
    return bound([]);
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const results = [];
      for (const statement of statements) { if (this.failSql && statement.sql.includes(this.failSql)) { this.failSql = null; throw new Error("Injected transaction failure"); } results.push(statement.rawRun()); }
      this.db.exec("COMMIT;"); return results;
    } catch (error) { this.db.exec("ROLLBACK;"); throw error; }
  }
}
const board = { board: "authorized_test_board", company: "Example authorized employer", rightsConfigId: "test-permission-2026", displayAllowed: true, digestAllowed: true, aiAllowed: false };
const env = {
  CAREER_JOBS_ENABLED: "true", GREENHOUSE_BOARDS_JSON: JSON.stringify([board]), CAREER_ALERTS_ENABLED: "true", CAREER_PUBLIC_ORIGIN: "https://dolphin.example", CAREER_ALERT_RELAY_ORIGIN: "https://scheduler.example",
  CAREER_VERIFICATION_SECRET: "test-verification-secret-32-characters-minimum", CAREER_SCHEDULER_SECRET: "test-scheduler-secret-32-characters-minimum",
  RESEND_API_KEY: "re_test_fixture_no_network", RESEND_FROM: "Dolphin <alerts@dolphin.example>", RESEND_SENDER_VERIFIED: "true", RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from("fake-svix-secret-with-sufficient-length").toString("base64")}`,
  WHATSAPP_BUSINESS_TOKEN: "test-no-network", WHATSAPP_PHONE_NUMBER_ID: "1234567890", WHATSAPP_GRAPH_VERSION: "v99.0", WHATSAPP_APP_SECRET: "fake-meta-app-secret", WHATSAPP_VERIFY_TOKEN: "fake-meta-verify-token", WHATSAPP_DIGEST_TEMPLATE: "approved_test_digest", WHATSAPP_VERIFICATION_TEMPLATE: "approved_test_verification", WHATSAPP_TEMPLATE_LANGUAGE: "en_US", WHATSAPP_TEMPLATES_APPROVED: "true",
};
const now = new Date("2026-10-12T02:30:00.000Z");
const code = (expected) => (error) => error instanceof CareerError && error.code === expected;
const rawJob = (id = 101, changes = {}) => ({ id, internal_job_id: id + 1000, title: "Software Engineer", location: { name: "Pune" }, absolute_url: `https://careers.example.com/jobs/${id}`, content: "<p>Python and SQL engineering responsibilities.</p>", updated_at: "2026-10-11T00:00:00Z", ...changes });
const response = (jobs = [rawJob()]) => new Response(JSON.stringify({ jobs, meta: { total: jobs.length } }), { headers: { "content-type": "application/json" } });
const fakeFetch = async () => response();
async function workspace(settings = {}) {
  const db = new SQLiteD1();
  for (const userId of ["alice", "bob"]) {
    const store = new CareerStore({ userId, email: `${userId}@example.test`, fullName: userId }, db); await store.ensureAccount();
    const preferences = { ...defaultPreferences(), targetRoles: ["Software Engineer"], mandatoryWorkArrangement: false, mandatoryEmploymentType: false };
    const profile = { ...defaultProfile(`${userId}@example.test`, userId), currentCity: "Pune", skills: ["Python", "SQL"] };
    const notifications = { ...defaultNotifications(), paused: false, emailEnabled: true, whatsappEnabled: true, emailConsent: true, whatsappConsent: true, emailVerified: true, whatsappVerified: true, ...settings };
    db.db.prepare("UPDATE career_accounts SET preferences=?,profile=?,notifications=? WHERE user_id=?").run(JSON.stringify(preferences), JSON.stringify(profile), JSON.stringify(notifications), userId);
    for (const channel of ["email", "whatsapp"]) db.db.prepare("INSERT INTO career_notification_destinations(id,user_id,channel,address,verified_at,created_at) VALUES(?,?,?,?,?,?)").run(`${userId}-${channel}`, userId, channel, channel === "email" ? `${userId}@example.test` : userId === "alice" ? "+919876543210" : "+919876543211", now.toISOString(), now.toISOString());
  }
  return db;
}
async function feedsAndJobs(db, userId = "alice", date = now, jobs = [rawJob()]) {
  const feeds = await providers.fetchGreenhouseJobs(env, async () => response(jobs), date);
  await providers.persistOwnedFeedResults(db, userId, feeds); return feeds;
}
function queue(db, channel = "email", userId = "alice", fields = {}) {
  const id = crypto.randomUUID(); const job = db.db.prepare("SELECT id FROM career_jobs WHERE user_id=? LIMIT 1").get(userId);
  const stamp = now.toISOString(); const destination = db.db.prepare("SELECT address FROM career_notification_destinations WHERE user_id=? AND channel=?").get(userId, channel);
  db.db.prepare("INSERT INTO career_alert_dispatches(id,user_id,local_date,channel,status,consent_revision,job_ids,destination_address,attempts,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?,0,?,?)").run(id, userId, "2026-10-12", channel, "queued", JSON.stringify(job ? [job.id] : []), destination.address, stamp, stamp);
  if (job) db.db.prepare("INSERT INTO career_alert_job_dedupe(id,user_id,channel,job_id,dispatch_id,status,created_at) VALUES(?,?,?,?,?,'reserved',?)").run(crypto.randomUUID(), userId, channel, job.id, id, stamp);
  for (const [field, value] of Object.entries(fields)) { assert.ok(["status", "provider_message_id", "consent_revision", "attempts", "lease_until", "created_at", "job_ids"].includes(field)); db.db.prepare(`UPDATE career_alert_dispatches SET ${field}=? WHERE id=?`).run(value, id); }
  return db.db.prepare("SELECT * FROM career_alert_dispatches WHERE id=?").get(id);
}
function signedResend(event, id = crypto.randomUUID(), secret = env.RESEND_WEBHOOK_SECRET) {
  const body = JSON.stringify({ created_at: new Date().toISOString(), ...event }); const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("https://dolphin.example/api/career/callbacks/resend", { method: "POST", headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` }, body });
}
function signedMeta(payload) { const body = JSON.stringify(payload); const signature = createHmac("sha256", env.WHATSAPP_APP_SECRET).update(body).digest("hex"); return new Request("https://dolphin.example/api/career/callbacks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": `sha256=${signature}` }, body }); }
const meta = (value) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID }, ...value } }] }] });

test("sources and outgoing channels fail closed with missing permissions or secrets", async () => {
  assert.deepEqual(providers.approvedGreenhouseBoards({}), []);
  assert.deepEqual(providers.approvedGreenhouseBoards({ ...env, GREENHOUSE_BOARDS_JSON: JSON.stringify([{ ...board, displayAllowed: false }]) }), []);
  assert.equal(providers.emailProviderReady({ ...env, RESEND_WEBHOOK_SECRET: undefined }), false);
  assert.equal(providers.whatsappProviderReady({ ...env, WHATSAPP_TEMPLATES_APPROVED: "false" }), false);
  assert.equal(providers.getProviderIntegrationState({}).jobs.live, false);
  assert.equal(providers.getProviderIntegrationState(env).loopcv.status, "not-connected");
  await assert.rejects(() => providers.fetchGreenhouseJobs({}), code("JOBS_NOT_CONFIGURED"));
  await assert.rejects(() => alerts.runAlertScheduler(awaitDb(), {}), code("ALERTS_NOT_CONFIGURED"));
});
function awaitDb() { return new SQLiteD1(); }
test("official board fetch uses a fixed origin, denies redirects and excludes prospect pools", async () => {
  const calls = []; const feeds = await providers.fetchGreenhouseJobs(env, async (url, options) => { calls.push({ url, options }); return response([rawJob(), rawJob(999, { internal_job_id: null })]); }, now);
  assert.equal(calls[0].url, "https://boards-api.greenhouse.io/v1/boards/authorized_test_board/jobs?content=true");
  assert.equal(calls[0].options.redirect, "error"); assert.equal(feeds[0].jobs.length, 1);
  assert.equal(feeds[0].jobs[0].salaryMin, null); assert.equal(feeds[0].jobs[0].minExperience, null); assert.equal(feeds[0].jobs[0].postedAt, null); assert.equal(feeds[0].jobs[0].workArrangement, null);
  assert.deepEqual(feeds[0].jobs[0].requirements, []); assert.equal(feeds[0].jobs[0].source, "greenhouse");
});
test("partial, malformed and oversized source responses cannot expire previous jobs", async () => {
  const db = await workspace(); await feedsAndJobs(db);
  const partial = await providers.fetchGreenhouseJobs(env, async () => new Response(JSON.stringify({ jobs: [], meta: { total: 1 } })), now);
  assert.equal(partial[0].errorCode, "INCOMPLETE_FEED"); await providers.persistOwnedFeedResults(db, "alice", partial);
  assert.equal(JSON.parse(db.db.prepare("SELECT data FROM career_jobs WHERE user_id='alice'").get().data).closed, false);
  await assert.rejects(() => providers.boundedProviderJson(new Response("x".repeat(101)), 100), code("FEED_TOO_LARGE"));
  const invalid = await providers.fetchGreenhouseJobs(env, async () => response([rawJob(101, { absolute_url: "https://127.0.0.1/private" })]), now); assert.equal(invalid[0].errorCode, "INVALID_FEED");
});
test("owned job upserts preserve IDs, deduplicate, close missing listings and isolate users", async () => {
  const db = await workspace(); await feedsAndJobs(db, "alice", now, [rawJob(), rawJob()]);
  const first = db.db.prepare("SELECT id FROM career_jobs WHERE user_id='alice'").get().id;
  await feedsAndJobs(db, "alice"); assert.equal(db.db.prepare("SELECT id FROM career_jobs WHERE user_id='alice'").get().id, first);
  await feedsAndJobs(db, "bob"); assert.notEqual(db.db.prepare("SELECT id FROM career_jobs WHERE user_id='bob'").get().id, first);
  await providers.persistOwnedFeedResults(db, "alice", await providers.fetchGreenhouseJobs(env, async () => response([]), now));
  assert.equal(JSON.parse(db.db.prepare("SELECT data FROM career_jobs WHERE user_id='alice'").get().data).closed, true);
  assert.equal(JSON.parse(db.db.prepare("SELECT data FROM career_jobs WHERE user_id='bob'").get().data).closed, false);
  await assert.rejects(() => providers.persistOwnedFeedResults(db, "missing-owner", []), code("NOT_FOUND"));
});
test("provider HTML becomes plain text and never executable markup", () => {
  assert.equal(providers.descriptionToText("&lt;p&gt;Python&lt;/p&gt;&lt;script&gt;steal()&lt;/script&gt;"), "Python");
  assert.equal(providers.descriptionToText("<img src=x onerror=steal()> SQL"), "SQL");
});
test("08:00 scheduling uses Asia/Kolkata and respects pause and IANA time zones", () => {
  const settings = { ...defaultNotifications(), paused: false, emailEnabled: true };
  assert.equal(alerts.scheduleDue(now, settings).due, true);
  assert.equal(alerts.scheduleDue(new Date("2026-10-12T02:29:00Z"), settings).due, false);
  assert.equal(alerts.scheduleDue(now, { ...settings, paused: true }).due, false);
  assert.equal(alerts.nextDispatchAt(settings, new Date("2026-10-12T02:29:00Z")), now.toISOString());
  assert.throws(() => alerts.scheduleParts(now, "not/a-timezone"), code("INVALID_TIMEZONE"));
});
test("destination verification stores only a bound token hash, enforces ownership and single use", async () => {
  const db = await workspace(); let sent;
  const result = await alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "alice@example.test", env, { now: () => now, sendEmail: async (message) => { sent = message; return { status: "accepted", providerMessageId: "fake-verification-message" }; } });
  assert.equal(result.token, undefined); assert.equal(result.status, "accepted");
  const row = db.db.prepare("SELECT * FROM career_destination_verifications WHERE id=?").get(result.verificationId);
  assert.notEqual(row.token_hash, sent.token); assert.equal(row.token_hash.length, 64); assert.ok(!JSON.stringify(row).includes(sent.token));
  await assert.rejects(() => alerts.confirmDestinationVerification(db, "bob", result.verificationId, sent.token, env, now), code("VERIFICATION_EXPIRED"));
  assert.equal((await alerts.confirmDestinationVerification(db, "alice", result.verificationId, sent.token, env, now)).verified, true);
  await assert.rejects(() => alerts.confirmDestinationVerification(db, "alice", result.verificationId, sent.token, env, now), code("VERIFICATION_EXPIRED"));
  const settings = JSON.parse(db.db.prepare("SELECT notifications FROM career_accounts WHERE user_id='alice'").get().notifications); assert.equal(settings.emailEnabled, false); assert.equal(settings.emailConsent, false); assert.equal(settings.emailConsentRecordedAt, null);
  await assert.rejects(() => alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "someone@example.test", env), code("IDENTITY_DESTINATION_REQUIRED"));
});
test("verification expiry, five attempts, request rate limits and provider rejection fail safely", async () => {
  const db = await workspace(); let sent;
  const deps = { now: () => now, sendEmail: async (message) => { sent = message; return { status: "accepted", providerMessageId: crypto.randomUUID() }; } };
  const first = await alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "alice@example.test", env, deps);
  const wrong = sent.token === "00000000" ? "00000001" : "00000000";
  for (let i = 0; i < 5; i++) await assert.rejects(() => alerts.confirmDestinationVerification(db, "alice", first.verificationId, wrong, env, now), code("INVALID_VERIFICATION"));
  await assert.rejects(() => alerts.confirmDestinationVerification(db, "alice", first.verificationId, sent.token, env, now), code("VERIFICATION_EXPIRED"));
  const second = await alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "alice@example.test", env, deps);
  await assert.rejects(() => alerts.confirmDestinationVerification(db, "alice", second.verificationId, sent.token, env, new Date(now.getTime() + 600001)), code("VERIFICATION_EXPIRED"));
  await alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "alice@example.test", env, deps);
  await assert.rejects(() => alerts.requestDestinationVerification(db, { userId: "alice", email: "alice@example.test" }, "email", "alice@example.test", env, deps), code("VERIFICATION_RATE_LIMIT"));
  await assert.rejects(() => alerts.requestDestinationVerification(db, { userId: "bob", email: "bob@example.test" }, "email", "bob@example.test", env, { now: () => now, sendEmail: async () => { throw new Error("fake rejection"); } }), code("VERIFICATION_SEND_FAILED"));
  assert.ok(db.db.prepare("SELECT consumed_at FROM career_destination_verifications WHERE user_id='bob'").get().consumed_at);
});
test("repeated and concurrent scheduler runs deduplicate daily and per-job per-channel alerts", async () => {
  const db = await workspace(); const sent = [];
  const deps = { now: () => now, fetcher: fakeFetch, sendEmail: async (message) => { sent.push({ channel: "email", message }); return { status: "accepted", providerMessageId: crypto.randomUUID() }; }, sendWhatsapp: async (message) => { sent.push({ channel: "whatsapp", message }); return { status: "accepted", providerMessageId: crypto.randomUUID() }; } };
  await Promise.all([alerts.runAlertScheduler(db, env, deps), alerts.runAlertScheduler(db, env, deps)]); await alerts.runAlertScheduler(db, env, deps);
  assert.equal(sent.length, 4); assert.equal(db.db.prepare("SELECT COUNT(*) n FROM career_alert_dispatches").get().n, 4);
  assert.equal(db.db.prepare("SELECT COUNT(*) n FROM career_alert_job_dedupe").get().n, 4);
  assert.ok(sent.every(({ message }) => message.idempotencyKey.startsWith("digest/")));
  assert.ok(sent.every(({ message }) => /No applications (?:have been )?submitted\./.test(message.text)));
  assert.ok(sent.filter(({ channel }) => channel === "whatsapp").every(({ message }) => message.text.length <= 1000));
  const state = await alerts.getAlertState(db, "alice", env); assert.equal(state.notificationHistory.length, 2); assert.ok(state.notificationHistory.every((item) => item.status === "accepted" && !item.deliveredAt)); assert.equal(state.verifiedDestinations[1].address.includes("9876543210"), false);
});
test("already-sent top matches do not hide lower-ranked new jobs; maxJobsPerDigest is respected", async () => {
  const db = await workspace({ maxJobsPerDigest: 1, whatsappEnabled: false }); const sent = [];
  const deps = { now: () => now, fetcher: fakeFetch, sendEmail: async (message) => { sent.push(message); return { status: "accepted", providerMessageId: crypto.randomUUID() }; } };
  await alerts.runAlertScheduler(db, env, deps);
  await alerts.runAlertScheduler(db, env, { ...deps, now: () => new Date(now.getTime() + 86400000), fetcher: async () => response([rawJob(), rawJob(102)]) });
  assert.equal(sent.length, 4); assert.ok(sent[2].text.includes("/jobs/102")); assert.ok(!sent[2].text.includes("/jobs/101"));
});
test("email failure does not stop WhatsApp and uncertain WhatsApp sends are never blindly retried", async () => {
  const db = await workspace(); await feedsAndJobs(db); const email = queue(db); const whatsapp = queue(db, "whatsapp"); let whatsappCalls = 0;
  const feeds = await providers.fetchGreenhouseJobs(env, fakeFetch, now);
  await Promise.all([alerts.processDispatch(db, email, env, { now: () => now, freshFeeds: feeds, sendEmail: async () => { throw new alerts.DeliveryError("EMAIL_REJECTED"); } }), alerts.processDispatch(db, whatsapp, env, { now: () => now, freshFeeds: feeds, sendWhatsapp: async () => { whatsappCalls++; return { status: "accepted", providerMessageId: "fake-whatsapp-accepted" }; } })]);
  assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(email.id).status, "failed"); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(whatsapp.id).status, "accepted"); assert.equal(whatsappCalls, 1);
  await feedsAndJobs(db, "bob"); const other = queue(db, "whatsapp", "bob"); await alerts.processDispatch(db, other, env, { now: () => now, freshFeeds: feeds, sendWhatsapp: async () => { whatsappCalls++; throw new alerts.DeliveryError("UNKNOWN", false, true); } });
  assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(other.id).status, "uncertain"); await alerts.processDispatch(db, other, env, { now: () => now, freshFeeds: feeds, sendWhatsapp: async () => { whatsappCalls++; throw new Error(); } }); assert.equal(whatsappCalls, 2);
});
test("final consent revision and destination ownership stop queued dispatch before provider call", async () => {
  const db = await workspace(); const feeds = await feedsAndJobs(db); const queued = queue(db); let calls = 0;
  db.db.prepare("UPDATE career_accounts SET notification_revision=notification_revision+1 WHERE user_id='alice'").run();
  await alerts.processDispatch(db, queued, env, { now: () => now, freshFeeds: feeds, sendEmail: async () => { calls++; return { status: "accepted", providerMessageId: "never" }; } });
  assert.equal(calls, 0); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "cancelled");
  const bob = queue(db, "email", "bob", { job_ids: queued.job_ids }); await alerts.processDispatch(db, bob, env, { now: () => now, freshFeeds: feeds, sendEmail: async () => { calls++; return { status: "accepted", providerMessageId: "never" }; } }); assert.equal(calls, 0);
});
test("failed source refresh stops cached job dispatch and distinguishes source_unavailable", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db); let calls = 0;
  await alerts.processDispatch(db, queued, env, { now: () => now, fetcher: async () => new Response("unavailable", { status: 503 }), sendEmail: async () => { calls++; return { status: "accepted", providerMessageId: "never" }; } });
  assert.equal(calls, 0); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "source_unavailable");
});
test("Resend callbacks verify original body, reject forged signatures and report delivery only after a valid callback", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db, "email", "alice", { status: "accepted", provider_message_id: "fake-accepted-id" });
  const event = { type: "email.delivered", data: { email_id: "fake-accepted-id" } };
  const request = signedResend(event); const replay = request.clone(); await alerts.handleProviderCallback(request, db, env, "resend"); await alerts.handleProviderCallback(replay, db, env, "resend");
  const row = db.db.prepare("SELECT * FROM career_alert_dispatches WHERE id=?").get(queued.id); assert.equal(row.status, "delivered"); assert.ok(row.delivered_at); assert.equal(db.db.prepare("SELECT COUNT(*) n FROM career_provider_events").get().n, 1);
  const forged = signedResend(event); forged.headers.set("svix-signature", "v1,forged"); await assert.rejects(() => alerts.handleProviderCallback(forged, db, env, "resend"), code("INVALID_SIGNATURE"));
  await alerts.handleProviderCallback(signedResend({ type: "email.failed", data: { email_id: "fake-accepted-id" }, created_at: "2026-01-01T00:00:00Z" }), db, env, "resend"); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "delivered");
});
test("callback transaction failure rolls back acceptance and is recoverable by retry", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db, "email", "alice", { status: "accepted", provider_message_id: "fake-rollback-id" });
  const request = signedResend({ type: "email.delivered", data: { email_id: "fake-rollback-id" } }); const retry = request.clone(); db.failSql = "UPDATE career_alert_dispatches SET status='delivered'";
  await assert.rejects(() => alerts.handleProviderCallback(request, db, env, "resend"), /Injected transaction failure/);
  assert.equal(db.db.prepare("SELECT COUNT(*) n FROM career_provider_events").get().n, 0); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "accepted");
  await alerts.handleProviderCallback(retry, db, env, "resend"); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "delivered");
});
test("failed delivery is terminal against a later success callback; unknown messages are retryable", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db, "email", "alice", { status: "accepted", provider_message_id: "fake-failed-id" });
  await alerts.handleProviderCallback(signedResend({ type: "email.failed", data: { email_id: "fake-failed-id" } }), db, env, "resend");
  await alerts.handleProviderCallback(signedResend({ type: "email.delivered", data: { email_id: "fake-failed-id" } }), db, env, "resend"); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "failed");
  await assert.rejects(() => alerts.handleProviderCallback(signedResend({ type: "email.delivered", data: { email_id: "unknown-before-acceptance" } }), db, env, "resend"), code("CALLBACK_NOT_READY"));
});
test("signed WhatsApp STOP cancels queued messages and replay does not repeatedly mutate consent", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db, "whatsapp"); const request = signedMeta(meta({ messages: [{ id: "fake-stop-1", from: "919876543210", text: { body: "STOP" } }] })); const replay = request.clone();
  await alerts.handleProviderCallback(request, db, env, "whatsapp"); await alerts.handleProviderCallback(replay, db, env, "whatsapp");
  const account = db.db.prepare("SELECT * FROM career_accounts WHERE user_id='alice'").get(); assert.equal(account.notification_revision, 1); assert.equal(JSON.parse(account.notifications).whatsappConsent, false); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "cancelled");
  const forged = signedMeta(meta({ messages: [] })); forged.headers.set("x-hub-signature-256", `sha256=${"0".repeat(64)}`); await assert.rejects(() => alerts.handleProviderCallback(forged, db, env, "whatsapp"), code("INVALID_SIGNATURE"));
});
test("signed email unsubscribe requires confirmation and cancels queued work", async () => {
  const db = await workspace(); const expiry = String(Math.floor(Date.now() / 1000) + 3600); const payload = `alice|email|${expiry}`; const sig = createHmac("sha256", env.CAREER_VERIFICATION_SECRET).update(payload).digest("hex"); const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  await feedsAndJobs(db); const queued = queue(db); const url = `https://dolphin.example/api/career/notifications/unsubscribe?token=${token}`;
  assert.equal((await alerts.handleUnsubscribe(new Request(url), db, env)).status, 200); assert.equal(JSON.parse(db.db.prepare("SELECT notifications FROM career_accounts WHERE user_id='alice'").get().notifications).emailConsent, true);
  await alerts.handleUnsubscribe(new Request(url, { method: "POST" }), db, env); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "cancelled"); assert.equal(JSON.parse(db.db.prepare("SELECT notifications FROM career_accounts WHERE user_id='bob'").get().notifications).emailConsent, true);
  await assert.rejects(() => alerts.handleUnsubscribe(new Request(`${url}invalid`, { method: "POST" }), db, env), code("INVALID_UNSUBSCRIBE"));
});
test("scheduler authentication rejects absent/wrong keys and unconfigured private deployment", async () => {
  await assert.rejects(() => alerts.assertSchedulerRequest(new Request("https://dolphin.example", { method: "POST" }), env), code("SCHEDULER_UNAUTHORIZED"));
  await alerts.assertSchedulerRequest(new Request("https://dolphin.example", { method: "POST", headers: { "x-career-scheduler-secret": env.CAREER_SCHEDULER_SECRET } }), env);
  let calls = 0; assert.equal((await worker.runScheduled({ CAREER_SITE_ORIGIN: "https://dolphin.example", CAREER_SCHEDULER_SECRET: env.CAREER_SCHEDULER_SECRET, SITES_PRIVATE_AUDIENCE: "true" }, { fetcher: async () => { calls++; return new Response(); } })).status, "not-configured"); assert.equal(calls, 0);
});
test("external relay forwards only fixed callback paths, untouched bytes and signature headers", async () => {
  const schedulerEnv = { CAREER_SITE_ORIGIN: "https://dolphin.example", CAREER_SCHEDULER_SECRET: env.CAREER_SCHEDULER_SECRET, SITES_PRIVATE_AUDIENCE: "true", SITES_SERVICE_BEARER: "fake-private-service-token" }; let captured;
  const fetcher = async (url, options) => { captured = { url, options }; return new Response("{}", { headers: { "content-type": "application/json" } }); };
  const request = signedResend({ type: "email.delivered", data: { email_id: "fake" } }); const original = await request.clone().text();
  const relay = new Request("https://scheduler.example/webhooks/resend?target=https://attacker.example", { method: "POST", headers: { ...Object.fromEntries(request.headers), cookie: "private=user", authorization: "Bearer caller-key" }, body: original });
  assert.equal((await worker.relayCallback(relay, schedulerEnv, { fetcher })).status, 200); assert.equal(captured.url, "https://dolphin.example/api/career/callbacks/resend"); assert.equal(new TextDecoder().decode(captured.options.body), original); assert.equal(captured.options.headers.get("cookie"), null); assert.equal(captured.options.headers.get("authorization"), null); assert.equal(captured.options.redirect, "error");
  assert.equal((await worker.relayCallback(new Request("https://scheduler.example/arbitrary"), schedulerEnv, { fetcher })).status, 404);
  await worker.runScheduled(schedulerEnv, { fetcher }); assert.equal(captured.url, "https://dolphin.example/api/career/internal/scheduler"); assert.equal(captured.options.headers.get("x-career-scheduler-secret"), env.CAREER_SCHEDULER_SECRET);
});
test("private-site unsubscribe relay preserves confirmation and never forwards browser identity", async () => {
  let captured; const schedulerEnv = { CAREER_SITE_ORIGIN: "https://dolphin.example", SITES_PRIVATE_AUDIENCE: "true", SITES_SERVICE_BEARER: "fake-private-service-token" };
  const result = await worker.relayCallback(new Request("https://scheduler.example/unsubscribe?token=fake-signed-token&user_id=bob", { headers: { cookie: "account=alice", authorization: "Bearer caller" } }), schedulerEnv, { fetcher: async (url, options) => { captured = { url, options }; return new Response("<form method=post><button>Unsubscribe</button></form>"); } });
  assert.equal(captured.url, "https://dolphin.example/api/career/notifications/unsubscribe?token=fake-signed-token"); assert.equal(captured.options.headers.get("cookie"), null); assert.equal(captured.options.headers.get("authorization"), null); assert.equal(result.headers.get("content-type"), "text/html; charset=utf-8"); assert.ok(result.headers.get("content-security-policy").includes("form-action 'self'"));
  assert.equal(providers.emailProviderReady({ ...env, CAREER_ALERT_RELAY_ORIGIN: undefined }), false);
});
test("uncertain email acceptance retries the same provider idempotency key within the controlled window", async () => {
  const db = await workspace(); const feeds = await feedsAndJobs(db); const queued = queue(db); const messages = [];
  await alerts.processDispatch(db, queued, env, { now: () => now, freshFeeds: feeds, sendEmail: async (message) => { messages.push(message); throw new alerts.DeliveryError("EMAIL_ACCEPTANCE_UNKNOWN", true, true); } });
  assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "retry");
  const later = new Date(now.getTime() + 120000); const refreshed = await providers.fetchGreenhouseJobs(env, fakeFetch, later);
  await alerts.processDispatch(db, queued, env, { now: () => later, freshFeeds: refreshed, sendEmail: async (message) => { messages.push(message); return { status: "accepted", providerMessageId: "fake-email-retried" }; } });
  assert.deepEqual(messages.map((message) => message.idempotencyKey), [`digest/${queued.id}`, `digest/${queued.id}`]); assert.deepEqual(messages[0], messages[1]); assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "accepted");
});
test("expired send leases at the retry ceiling become uncertain instead of stuck retries", async () => {
  const db = await workspace({ paused: true }); await feedsAndJobs(db); const queued = queue(db, "email", "alice", { status: "sending", attempts: 3, lease_until: new Date(now.getTime() - 1).toISOString() });
  await alerts.runAlertScheduler(db, env, { now: () => now, fetcher: fakeFetch });
  assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "uncertain"); assert.equal(db.db.prepare("SELECT status FROM career_alert_job_dedupe WHERE dispatch_id=?").get(queued.id).status, "uncertain");
});
test("no current suitable jobs and unavailable sources produce different history without messages", async () => {
  const emptyDb = await workspace(); let sends = 0; const deps = { now: () => now, sendEmail: async () => { sends++; throw new Error(); }, sendWhatsapp: async () => { sends++; throw new Error(); } };
  await alerts.runAlertScheduler(emptyDb, env, { ...deps, fetcher: async () => response([]) }); assert.equal(emptyDb.db.prepare("SELECT status FROM career_alert_dispatches LIMIT 1").get().status, "no_new_jobs");
  const unavailableDb = await workspace(); await alerts.runAlertScheduler(unavailableDb, env, { ...deps, fetcher: async () => new Response("unavailable", { status: 503 }) }); assert.equal(unavailableDb.db.prepare("SELECT status FROM career_alert_dispatches LIMIT 1").get().status, "source_unavailable"); assert.equal(sends, 0);
});
test("profile/preferences changed during refresh cancel the old-context digest before dispatch", async () => {
  const db = await workspace(); await feedsAndJobs(db); const queued = queue(db); let calls = 0;
  await alerts.processDispatch(db, queued, env, { now: () => now, fetcher: async () => { db.db.prepare("UPDATE career_accounts SET revision=revision+1 WHERE user_id='alice'").run(); return response(); }, sendEmail: async () => { calls++; return { status: "accepted", providerMessageId: "never" }; } });
  assert.equal(calls, 0); const row = db.db.prepare("SELECT status,error_code,profile_revision FROM career_alert_dispatches WHERE id=?").get(queued.id); assert.equal(row.status, "cancelled"); assert.equal(row.error_code, "CAREER_CONTEXT_CHANGED"); assert.equal(row.profile_revision, 0);
});
test("changed retry message is cancelled while uncertain reservations remain a duplicate fence", async () => {
  const db = await workspace(); const feeds = await feedsAndJobs(db); const queued = queue(db); let calls = 0;
  await alerts.processDispatch(db, queued, env, { now: () => now, freshFeeds: feeds, sendEmail: async () => { calls++; throw new alerts.DeliveryError("EMAIL_ACCEPTANCE_UNKNOWN", true, true); } });
  assert.equal(db.db.prepare("SELECT status FROM career_alert_job_dedupe WHERE dispatch_id=?").get(queued.id).status, "uncertain");
  const later = new Date(now.getTime() + 120000); const changed = await providers.fetchGreenhouseJobs(env, async () => response([rawJob(101, { title: "Software Engineer II" })]), later);
  await alerts.processDispatch(db, queued, env, { now: () => later, freshFeeds: changed, sendEmail: async () => { calls++; return { status: "accepted", providerMessageId: "never" }; } });
  assert.equal(calls, 1); assert.equal(db.db.prepare("SELECT error_code FROM career_alert_dispatches WHERE id=?").get(queued.id).error_code, "MESSAGE_CONTEXT_CHANGED"); assert.equal(db.db.prepare("SELECT status FROM career_alert_job_dedupe WHERE dispatch_id=?").get(queued.id).status, "uncertain");
});
test("official idempotency conflicts stay uncertain rather than freeing already-sent job reservations", async () => {
  const error = alerts.classifyResendError("invalid_idempotent_request"); assert.equal(error.uncertain, true); assert.equal(error.retryable, false);
  assert.equal(alerts.classifyResendError("concurrent_idempotent_requests").uncertain, true); assert.equal(alerts.classifyResendError("rate_limit_exceeded").retryable, true);
  const db = await workspace(); const feeds = await feedsAndJobs(db); const queued = queue(db);
  await alerts.processDispatch(db, queued, env, { now: () => now, freshFeeds: feeds, sendEmail: async () => { throw error; } });
  assert.equal(db.db.prepare("SELECT status FROM career_alert_dispatches WHERE id=?").get(queued.id).status, "uncertain"); assert.equal(db.db.prepare("SELECT status FROM career_alert_job_dedupe WHERE dispatch_id=?").get(queued.id).status, "uncertain");
});
