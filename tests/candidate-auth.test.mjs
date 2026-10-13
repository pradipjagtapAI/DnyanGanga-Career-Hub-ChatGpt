import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import ts from "typescript";
const coreUrl = new URL("../lib/career-core.ts", import.meta.url).href;
async function load(file) {
  let source = await readFile(new URL(`../lib/${file}.ts`, import.meta.url), "utf8");
  source = source.replaceAll('"./career-core"', JSON.stringify(coreUrl)).replaceAll('"./career-auth-realm"', JSON.stringify(new URL("../lib/career-auth-realm.ts",import.meta.url).href));
  for (const dependency of ["better-auth", "better-auth/plugins", "better-auth/crypto", "better-auth/cookies", "resend"]) source = source.replaceAll(JSON.stringify(dependency), JSON.stringify(import.meta.resolve(dependency)));
  return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`);
}
const { handleCandidateRequest, resolveCandidateCareerIdentity, candidateAuthAvailability, consumeCandidateLimit } = await load("career-candidate-auth");
const { requireAdminSession } = await load("career-admin-auth");
const { CareerStore } = await load("career-store");
const { CareerError } = await import(coreUrl);
const migrations = await Promise.all((await readdir(new URL("../drizzle/", import.meta.url))).filter(f => f.endsWith(".sql")).sort().map(f => readFile(new URL(`../drizzle/${f}`, import.meta.url), "utf8")));
class SQLiteD1 {
  raw = new DatabaseSync(":memory:"); beforeQuery = null;
  constructor() { this.raw.exec("PRAGMA foreign_keys=ON"); for (const sql of migrations) this.raw.exec(sql); }
  exec(sql) { this.raw.exec(sql); return Promise.resolve({count:1,duration:0}); }
  prepare(sql) {
    const db = this.raw; const checkQuery = sql => this.beforeQuery?.(sql);
    const bound = (values = []) => {
      const execute = () => { const results = db.prepare(sql).all(...values); return { success: true, results, meta: { changes: Number(db.prepare("SELECT changes() AS count").get().count), last_row_id: Number(db.prepare("SELECT last_insert_rowid() AS id").get().id) } }; };
      const checked = async () => { await checkQuery(sql); return execute(); };
      return { sql, bind: (...v) => bound(v), execute, all: checked, run: checked, first: async () => (await checked()).results[0] ?? null };
    }; return bound();
  }
  async batch(statements) { this.raw.exec("BEGIN IMMEDIATE"); try { const results = statements.map(s => s.execute()); this.raw.exec("COMMIT"); return results; } catch (e) { this.raw.exec("ROLLBACK"); throw e; } }
}
const ORIGIN = "https://dolphincreation.com", EMAIL = "candidate@example.test", PW = "Synthetic candidate password 934!";
function fixture() {
  const db = new SQLiteD1(), mail = [];
  const env = { DB: db, CAREER_CANDIDATE_ENABLED: "true", CAREER_CANDIDATE_AUTH_SECRET: randomBytes(32).toString("base64url"), CAREER_PUBLIC_ORIGIN: ORIGIN, CAREER_CANDIDATE_EMAIL_ENABLED: "true", RESEND_API_KEY: "re_synthetic_fixture_only", RESEND_FROM: "DnyanGanga <account@example.test>", RESEND_SENDER_VERIFIED: "true" };
  const deps = { sendMail: async message => { mail.push(message); return { id: `fixture-mail-${mail.length}` }; } };
  let cookie = "";
  return { db, env, deps, mail, get cookie() { return cookie; }, setCookie: value => { cookie = value; }, async request(path, body, changes = {}) {
    const method = body === undefined ? "GET" : "POST", headers = { ...(method === "POST" ? { origin: ORIGIN, "x-career-action": "1", "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(changes.headers ?? {}) };
    const request = new Request(`${ORIGIN}/api/account/${path}`, { method, headers, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
    const result = await handleCandidateRequest(request, { ...env, ...changes.env }, { ...deps, ...changes.deps });
    const jar = new Map(cookie.split(";").filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i).trim(), c.slice(i + 1)]; }));
    for (const c of result.headers.getSetCookie()) { const pair = c.split(";", 1)[0], i = pair.indexOf("="); if (pair.slice(i + 1)) jar.set(pair.slice(0, i), pair.slice(i + 1)); else jar.delete(pair.slice(0, i)); }
    cookie = Array.from(jar, ([k, v]) => `${k}=${v}`).join("; ");
    return { response: result, data: result.status >= 300 && result.status < 400 ? null : await result.json() };
  } };
}
function linkToken(message) { const link = message.text.match(/https:\/\/[^\s]+/)[0]; return new URL(link).searchParams.get("token"); }
const codeIs = code => e => e instanceof CareerError && e.code === code;
const identityRequest = f => new Request(`${ORIGIN}/api/career/state`, { headers: { cookie: f.cookie } });
async function signup(f, email = EMAIL, password = PW) { const result = await f.request("sign-up", { name: "Synthetic candidate", email, password }); assert.equal(result.response.status, 202, JSON.stringify(result.data)); return result; }
async function verified(f, email = EMAIL, password = PW) { await signup(f, email, password); const result = await f.request("verify-email", { token: linkToken(f.mail.at(-1)) }); assert.equal(result.response.status, 200, JSON.stringify(result.data)); return result; }
async function login(f, email = EMAIL, password = PW) { const result = await f.request("sign-in", { email, password }); assert.equal(result.response.status, 200, JSON.stringify(result.data)); return result; }

test("missing candidate secret or sender fails closed and every provider reports honest setup status", async () => {
  const f = fixture();
  for (const env of [{ CAREER_CANDIDATE_AUTH_SECRET: undefined }, { CAREER_CANDIDATE_AUTH_SECRET: "x".repeat(40) }, { CAREER_CANDIDATE_ENABLED: "false" }, { DB: undefined }]) {
    const status = await f.request("status", undefined, { env }); assert.equal(status.data.configured, false); assert.equal(status.data.providers.length, 4); assert.ok(status.data.providers.every(p => !p.enabled)); assert.equal(status.data.authenticated, false);
    assert.equal((await f.request("sign-up", { name: "Candidate", email: EMAIL, password: PW }, { env })).response.status, 503);
  }
  for (const env of [{ RESEND_API_KEY: undefined }, { RESEND_SENDER_VERIFIED: "false" }, { CAREER_CANDIDATE_EMAIL_ENABLED: "false" }]) { const status = await f.request("status", undefined, { env }); assert.equal(status.data.configured, true); assert.equal(status.data.emailAvailable, false); assert.equal((await f.request("sign-up", { name: "Candidate", email: EMAIL, password: PW }, { env })).response.status, 503); }
  assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_candidate_users").get().count, 0);
});
test("signup hashes passwords, requires candidate verification, and never alters legacy or administrator records", async () => {
  const f = fixture(); f.db.raw.prepare("INSERT INTO career_accounts(user_id,profile,preferences,notifications,created_at,updated_at) VALUES('legacy-owner','{}','{}','{}','fixture','fixture')").run();
  const result = await signup(f); assert.equal(Object.hasOwn(result.data, "token"), false); assert.equal(f.cookie, ""); assert.equal(f.mail.length, 1);
  const account = f.db.raw.prepare("SELECT password FROM career_candidate_accounts").get(); assert.notEqual(account.password, PW); assert.ok(account.password.length > 64);
  assert.equal((await f.request("sign-in", { email: EMAIL, password: PW })).response.status, 401);
  assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_admin_users").get().count, 0); assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_accounts").get().count, 1);
  const repeated = await signup(f); assert.deepEqual(repeated.data, result.data); assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_candidate_users").get().count, 1);
});
test("verification is explicitly POST only, single use, bounded and atomic under replay", async () => {
  const f = fixture(); await signup(f); const token = linkToken(f.mail[0]);
  assert.equal((await f.request(`verify-email?token=${token}`)).response.status, 404);
  const results = await Promise.all([f.request("verify-email", { token }), f.request("verify-email", { token })]); assert.deepEqual(results.map(r => r.response.status).sort(), [200, 401]);
  assert.equal((await f.request("verify-email", { token })).response.status, 401);
  assert.equal(f.db.raw.prepare("SELECT email_verified FROM career_candidate_users").get().email_verified, 1);
  assert.equal((await f.request("verify-email", { token: "forged-token" })).response.status, 401); assert.equal(f.cookie, "");
  const g = fixture(); await signup(g); g.db.raw.prepare("UPDATE career_candidate_link_tokens SET expires_at=0").run(); assert.equal((await g.request("verify-email", { token: linkToken(g.mail[0]) })).response.status, 401);
});
test("verified login uses secure host-only expiring cookies and preserves password spaces", async () => {
  const f = fixture(), spaced = `  ${PW}  `; await verified(f, EMAIL, spaced); assert.equal((await f.request("sign-in", { email: EMAIL, password: PW })).response.status, 401);
  const result = await login(f, EMAIL, spaced); assert.match(f.cookie, /__Secure-career_candidate_session=/); assert.doesNotMatch(f.cookie, /career_admin/); assert.equal(Object.hasOwn(result.data, "token"), false);
  for (const c of result.response.headers.getSetCookie()) { assert.match(c, /Secure/); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Lax/i); assert.match(c, /Path=\//); assert.doesNotMatch(c, /Domain=/i); }
  assert.equal((await f.request("status")).data.authenticated, true);
  f.db.raw.prepare("UPDATE career_candidate_sessions SET expires_at=?").run(new Date(Date.now() - 1000).toISOString()); await assert.rejects(() => resolveCandidateCareerIdentity(identityRequest(f), f.env), codeIs("ACCOUNT_SIGN_IN_REQUIRED"));
});
test("two actual candidate sessions isolate resumes, exports, jobs, applications and conversations", async () => {
  const f = fixture(); await verified(f); await login(f); const aliceCookie = f.cookie, aliceIdentity = await resolveCandidateCareerIdentity(identityRequest(f), f.env);
  f.setCookie(""); await verified(f, "second@example.test"); await login(f, "second@example.test"); const bobIdentity = await resolveCandidateCareerIdentity(identityRequest(f), f.env);
  assert.notEqual(aliceIdentity.userId, bobIdentity.userId); assert.match(aliceIdentity.userId, /^candidate:[0-9a-f-]{36}$/i);
  const alice = new CareerStore(aliceIdentity, f.db), bob = new CareerStore(bobIdentity, f.db); await alice.ensureAccount(); await bob.ensureAccount();
  const resumeId = await alice.saveResume({ title: "Alice private version", targetRole: "Engineer", text: "Alice synthetic private resume", source: "manual" });
  assert.equal((await alice.state()).resumes.length, 1); assert.equal((await bob.state()).resumes.length, 0);
  await assert.rejects(() => bob.ownedResume(resumeId), codeIs("NOT_FOUND")); await assert.rejects(() => bob.deleteResume(resumeId), codeIs("NOT_FOUND"));
  const jobId = await alice.importJob({title:"Engineer",company:"Synthetic employer",location:"Pune",workArrangement:"Hybrid",employmentType:"Full-time",description:"Synthetic role",requirements:["Design"],url:"https://careers.example.com/job"});
  const applicationId = await alice.saveApplication({jobId,status:"Saved",resumeId}); await assert.rejects(() => bob.saveApplication({jobId,status:"Applied"},applicationId),codeIs("NOT_FOUND")); await assert.rejects(() => bob.ownedJob(jobId),codeIs("NOT_FOUND"));
  const privateSessionId = await alice.saveAISession({mode:"coach",reply:"Synthetic private conversation",context:{jobId:null,resumeId:null,resumeVersion:null,profileRevision:0}},"Synthetic private question"); await assert.rejects(() => bob.ownedAISession(privateSessionId),codeIs("NOT_FOUND"));
  assert.equal((await bob.export()).resumes.length, 0); f.setCookie(aliceCookie); assert.equal((await resolveCandidateCareerIdentity(identityRequest(f), f.env)).userId, aliceIdentity.userId);
});
test("matching administrator email never grants administrator role or legacy ownership", async () => {
  const f = fixture(), adminEmail = "admin-owner@example.test"; await verified(f, adminEmail); await login(f, adminEmail);
  const identity = await resolveCandidateCareerIdentity(identityRequest(f), f.env); assert.match(identity.userId, /^candidate:/); assert.notEqual(identity.userId, "legacy-owner");
  await assert.rejects(() => requireAdminSession(identityRequest(f), { ...f.env, CAREER_ADMIN_ENABLED: "true", CAREER_ADMIN_AUTH_SECRET: randomBytes(32).toString("base64url"), CAREER_ADMIN_EMAIL: adminEmail }), codeIs("ADMIN_SIGN_IN_REQUIRED"));
  for (const path of ["update-user", "update-role", "link-social", "get-session", "change-email", "sign-up/email", "two-factor/disable"]) assert.equal((await f.request(path, { role: "owner" })).response.status, 404);
  assert.equal((await f.request("sign-up", { name: "Candidate", email: "intruder@example.test", password: PW, role: "admin" })).response.status, 400);
});
test("CSRF, schema, JSON type and streamed size checks precede all credential operations", async () => {
  const f = fixture(); for (const headers of [{ origin: "https://evil.example" }, { origin: "" }, { "x-career-action": "" }, { "sec-fetch-site": "cross-site" }]) assert.equal((await f.request("sign-up", { name: "Candidate", email: EMAIL, password: PW }, { headers })).response.status, 403);
  assert.equal((await f.request("sign-up", {}, { headers: { "content-type": "text/plain" } })).response.status, 415); assert.equal((await f.request("sign-up", "{" )).response.status, 400); assert.equal((await f.request("sign-up", JSON.stringify({ padding: "x".repeat(6000) }), { headers: { "content-length": "2" } })).response.status, 413);
  assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_candidate_users").get().count, 0);
});
test("logout invalidates copied candidate cookies on the server and ignores admin cookies", async () => {
  const f = fixture(); await verified(f); await login(f); const copied = f.cookie;
  assert.equal((await f.request("sign-out", {})).response.status, 200); f.setCookie(copied); assert.equal((await f.request("status")).data.authenticated, false);
  assert.equal(f.db.raw.prepare("SELECT COUNT(*) AS count FROM career_candidate_sessions").get().count, 0);
});
test("recovery and resend give generic results, reset revokes sessions and rejects token replay", async () => {
  const f = fixture(); await verified(f); await login(f); const copied = f.cookie;
  const known = await f.request("forgot-password", { email: EMAIL }), unknown = await f.request("forgot-password", { email: "missing@example.test" }); assert.deepEqual(known.data, unknown.data); assert.equal(known.response.status, 202);
  const token = linkToken(f.mail.at(-1)), next = "New synthetic candidate password 975!";
  const reset = await f.request("reset-password", { token, password: next }); assert.equal(reset.response.status, 200, JSON.stringify(reset.data)); assert.equal(Object.hasOwn(reset.data, "token"), false);
  f.setCookie(copied); assert.equal((await f.request("status")).data.authenticated, false); assert.equal((await f.request("reset-password", { token, password: next })).response.status, 401); f.setCookie(""); await login(f, EMAIL, next);
  assert.equal((await f.request("sign-in", { email: EMAIL, password: PW })).response.status, 401);
  const g = fixture(); await verified(g); await g.request("forgot-password", { email: EMAIL }); g.db.raw.prepare("UPDATE career_candidate_link_tokens SET expires_at=0").run(); assert.equal((await g.request("reset-password", { token: linkToken(g.mail.at(-1)), password: next })).response.status, 401);
});
test("password login remains usable for verified accounts during an email service outage", async () => {
  const f = fixture(); await verified(f); const result = await f.request("sign-in", { email: EMAIL, password: PW }, { env: { RESEND_SENDER_VERIFIED: "false" } }); assert.equal(result.response.status, 200);
  assert.equal((await f.request("forgot-password", { email: EMAIL }, { env: { RESEND_SENDER_VERIFIED: "false" } })).response.status, 503);
});
test("overlapping reset links serialize and database failures leave a durable recovery barrier", async () => {
  const f = fixture(); await verified(f); await login(f); const copied = f.cookie; await f.request("forgot-password", { email: EMAIL }); const first = linkToken(f.mail.at(-1)); await f.request("forgot-password", { email: EMAIL }); const second = linkToken(f.mail.at(-1));
  let startedResolve, releaseResolve; const started = new Promise(resolve => { startedResolve = resolve; }), release = new Promise(resolve => { releaseResolve = resolve; }); let trapped = false;
  f.db.beforeQuery = async sql => { if (!trapped && /update.*career_candidate_accounts.*set.*password/i.test(sql)) { trapped = true; startedResolve(); await release; throw new Error("synthetic password write failure"); } };
  const running = f.request("reset-password", { token: first, password: "First new synthetic password 123!" });
  await started; assert.equal((await f.request("reset-password", { token: second, password: "Second new synthetic password 456!" })).response.status, 409); releaseResolve(); assert.equal((await running).response.status, 503);
  assert.equal(f.db.raw.prepare("SELECT recovery_pending FROM career_candidate_security_state").get().recovery_pending, 1); f.setCookie(copied); assert.equal((await f.request("status")).data.authenticated, false);
  f.db.beforeQuery = null; f.setCookie(""); const recovered = await f.request("reset-password", { token: second, password: "Second new synthetic password 456!" }, { deps: { now: () => Date.now() + 120001 } }); assert.equal(recovered.response.status, 200, JSON.stringify(recovered.data)); assert.equal(f.db.raw.prepare("SELECT recovery_pending FROM career_candidate_security_state").get().recovery_pending, 0);
});
test("provider configuration enforces approvals and Naukri is always disabled", async () => {
  const f = fixture(); for (const provider of ["google", "linkedin", "indeed", "naukri"]) assert.equal((await f.request("social", { provider })).response.status, 503);
  const env = { ...f.env, CAREER_GOOGLE_ENABLED: "true", CAREER_GOOGLE_CLIENT_ID: "fixture-client-id", CAREER_GOOGLE_CLIENT_SECRET: "fixture-client-secret", CAREER_LINKEDIN_ENABLED: "true", CAREER_LINKEDIN_CLIENT_ID: "fixture-linkedin-id", CAREER_LINKEDIN_CLIENT_SECRET: "fixture-linkedin-secret", CAREER_INDEED_ENABLED: "true", CAREER_INDEED_CLIENT_ID: "fixture-indeed-id", CAREER_INDEED_CLIENT_SECRET: "fixture-indeed-secret" };
  let status = candidateAuthAvailability(env); assert.equal(status.providers.find(p => p.id === "google").enabled, true); assert.equal(status.providers.find(p => p.id === "linkedin").enabled, false); assert.equal(status.providers.find(p => p.id === "indeed").enabled, false);
  status = candidateAuthAvailability({ ...env, CAREER_LINKEDIN_ACCESS_APPROVED: "true", CAREER_INDEED_ACCESS_APPROVED: "true" }); assert.equal(status.providers.filter(p => p.enabled).length, 3); assert.equal(status.providers.find(p => p.id === "naukri").enabled, false);
});
test("actual Google OAuth initiation fixes destinations, checks state and cancels copied state on logout", async () => {
  const f = fixture(), env = { CAREER_GOOGLE_ENABLED: "true", CAREER_GOOGLE_CLIENT_ID: "fixture-client-id", CAREER_GOOGLE_CLIENT_SECRET: "fixture-client-secret" };
  const start = await f.request("social", { provider: "google" }, { env }); assert.equal(start.response.status, 200, JSON.stringify(start.data)); const destination = new URL(start.data.url), state = destination.searchParams.get("state");
  assert.equal(destination.hostname, "accounts.google.com"); assert.equal(destination.searchParams.get("redirect_uri"), `${ORIGIN}/api/account/callback/google`); assert.match(f.cookie, /__Secure-career_candidate_state=/);
  assert.equal((await f.request(`callback/google?code=fake-code&state=${state}`, undefined, { env, headers: { cookie: "" } })).response.status, 401);
  assert.equal((await f.request(`callback/google?code=fake-code&state=${state}&redirect_uri=https://evil.example`, undefined, { env })).response.status, 400);
  const copied = f.cookie; assert.equal((await f.request("sign-out", {}, { env })).response.status, 200); f.setCookie(copied); assert.equal((await f.request(`callback/google?code=fake-code&state=${state}`, undefined, { env })).response.status, 401);
  const replay = await f.request("social", { provider: "google", callbackURL: "https://evil.example" }, { env }); assert.equal(replay.response.status, 400);
});
test("candidate throttles and security audit avoid unbounded keys or credential contents", async () => {
  const f = fixture(); const results = await Promise.all(Array.from({ length: 20 }, () => consumeCandidateLimit(f.db, "atomic", 60, 5, 900000))); assert.equal(results.filter(r => r.allowed).length, 5);
  for (let i = 0; i < 25; i++) await f.request("sign-in", { email: `random-${i}@example.test`, password: PW });
  const rows = f.db.raw.prepare("SELECT key FROM career_candidate_throttle").all(); assert.ok(rows.length < 8); assert.ok(rows.some(r => r.key === "login:unknown")); assert.ok(rows.every(r => !r.key.includes("@")));
  const evidence = JSON.stringify(f.db.raw.prepare("SELECT * FROM career_candidate_security_events").all()); assert.equal(evidence.includes(PW), false); assert.equal(evidence.includes(EMAIL), false); assert.equal(evidence.includes(f.env.CAREER_CANDIDATE_AUTH_SECRET), false);
});

test("local verified-email state is independently enforced after an established login", async () => {
  const f = fixture(); await verified(f); await login(f); f.db.raw.prepare("UPDATE career_candidate_users SET email_verified=0").run();
  await assert.rejects(() => resolveCandidateCareerIdentity(identityRequest(f), f.env), codeIs("ACCOUNT_EMAIL_NOT_VERIFIED"));
  assert.equal((await f.request("status")).data.authenticated, false);
});
test("selected workspace hints survive candidate logout and session expiry without authorizing an administrator", async () => {
  const {selectedWorkspaceRealm,hasCandidateSessionCookie} = await import("../lib/career-auth-realm.ts");
  const f = fixture(); await verified(f); await login(f); assert.equal(selectedWorkspaceRealm(identityRequest(f)),"candidate");
  const hint = f.cookie.split(";").find(cookie=>cookie.trim().startsWith("__Host-career_workspace="));
  f.setCookie(hint); assert.equal(selectedWorkspaceRealm(identityRequest(f)),"candidate"); assert.equal(hasCandidateSessionCookie(identityRequest(f)),false); await assert.rejects(()=>resolveCandidateCareerIdentity(identityRequest(f),f.env),codeIs("ACCOUNT_SIGN_IN_REQUIRED"));
  assert.equal((await f.request("sign-out",{})).response.status,200); assert.equal(selectedWorkspaceRealm(identityRequest(f)),"candidate");
  assert.equal(selectedWorkspaceRealm(new Headers({cookie:"__Host-career_workspace=forged"})),null);
});

test("candidate login status cannot auto-switch an explicitly selected owner workspace", async () => {
  const f = fixture(); await verified(f); await login(f); f.setCookie(f.cookie.replace("__Host-career_workspace=candidate","__Host-career_workspace=admin"));
  const status = await f.request("status"); assert.equal(status.data.authenticated,false); assert.equal(status.data.user,null);
});
