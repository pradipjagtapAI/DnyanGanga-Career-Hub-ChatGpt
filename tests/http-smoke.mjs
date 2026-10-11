// Repeat after starting the local preview and applying its D1 migration.
// Uses only the starter's fixed localhost development identity, never a real account.
import assert from "node:assert/strict";

const base = new URL(process.env.CAREER_TEST_BASE_URL ?? "http://127.0.0.1:5173");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname) && base.protocol === "http:", "This smoke test must target the localhost development shim.");
const endpoint = (path) => new URL(`/api/career/${path}`, base).href;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const anonymous = await fetch(endpoint("state"));
check(anonymous.status === 401, "Anonymous state access must fail.");
check(anonymous.headers.get("cache-control")?.includes("no-store"), "Private API errors must be uncacheable.");
const spoofed = await fetch(endpoint("state"), { headers: { "oai-authenticated-user-id": "forged-admin", "oai-authenticated-user-email": "attacker@example.test" } });
check(spoofed.status === 401, "Injected identity headers must be stripped by the local shim.");
const signIn = await fetch(new URL("/signin-with-chatgpt?return_to=%2Fdashboard", base), { redirect: "manual" });
const cookie = signIn.headers.getSetCookie().find((value) => value.startsWith("__sites_local_auth="))?.split(";")[0];
assert.ok(cookie, "Local sign-in did not return the development cookie.");
async function get(path) { return fetch(endpoint(path), { headers: { cookie } }); }
async function call(method, path, body = {}, headers = {}) {
  // The localhost Vite/Miniflare bridge can fail its next pooled request after a
  // framework-level origin rejection. Isolate each test connection; see evidence.
  const response = await fetch(endpoint(path), { method, headers: { cookie, origin: base.origin, "content-type": "application/json", "x-career-action": "1", connection: "close", ...headers }, body: JSON.stringify(body) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = { error: "The framework rejected the request before the API handler.", status: response.status }; }
  return { response, data };
}
const initialResponse = await get("state");
assert.equal(initialResponse.status, 200, "Apply the D1 migration before running HTTP tests.");
const initial = await initialResponse.json();
assert.equal(initial.profile.email, "seedy@sites.test", "Refusing to mutate a real account.");
check(initialResponse.headers.get("cache-control")?.includes("no-store"), "Workspace data must be uncacheable.");
const createdResumes = []; let jobId; let taskId;
const nonce = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
try {
  const crossOrigin = await call("PUT", "profile", { profile: initial.profile, preferences: initial.preferences }, { origin: "https://attacker.example" });
  check(crossOrigin.response.status === 403, "Cross-origin mutations must fail.");
  const noAction = await call("PUT", "profile", {}, { "x-career-action": "" });
  check(noAction.response.status === 403, "Missing CSRF action header must fail.");
  const role = await call("PUT", "profile", { profile: { ...initial.profile, role: "admin" }, preferences: initial.preferences });
  check(role.response.status === 400, `Client role changes must fail (received ${role.response.status}, ${role.data.code ?? "framework"}).`);
  const saved = await call("POST", "resumes", { title: `HTTP test ${nonce}`, targetRole: "Engineer", text: "Synthetic HTTP test resume. Python SQL.", source: "manual" });
  check(saved.response.status === 201, "Resume save must succeed."); createdResumes.push(saved.data.id);
  const activated = await call("POST", `resumes/${saved.data.id}/active`);
  check(activated.data.state.activeResumeId === saved.data.id, "Explicit activation must select the saved version.");
  const restored = await call("POST", `resumes/${saved.data.id}/restore`);
  check(restored.response.status === 201 && restored.data.id !== saved.data.id, "Restore must create a new traceable version."); createdResumes.push(restored.data.id);
  check(restored.data.state.activeResumeId === saved.data.id, "Restore must not silently change the active resume.");
  const noDownload = await fetch(endpoint(`resumes/${saved.data.id}/download`));
  check(noDownload.status === 401, "Private downloads must reject anonymous visitors.");
  const download = await get(`resumes/${saved.data.id}/download`);
  check(download.status === 200 && (await download.text()).includes("Synthetic HTTP test"), "Owned plain-text download must return the saved version.");
  const disabledUpload = await call("POST", "upload", { filename: "unsafe.exe", status: "clean" });
  check(disabledUpload.response.status === 503, "Uploads must remain disabled without scanning and conversion.");
  const fakePaid = await call("POST", "payment/success", { orderId: "forged", status: "paid", amount: 1, currency: "INR", testMode: false });
  check(fakePaid.response.status === 503, "Browser payment claims must not unlock paid features.");
  const accountDelete = await call("DELETE", "account", { confirm: "DELETE" });
  check(accountDelete.response.status === 503, "Account deletion must require trusted recent authentication.");
  const job = await call("POST", "jobs", { title: `Synthetic test Engineer ${nonce}`, company: "Synthetic test company", location: "Bengaluru", workArrangement: "Hybrid", employmentType: "Full-time", minExperience: 0, maxExperience: null, salary: "", requirements: ["Python"], description: "Synthetic description for an authorized localhost test. This is not a live vacancy.", url: "https://careers.example.com/test" });
  check(job.response.status === 201, `Manual job import must succeed (received ${job.response.status}, ${job.data.code ?? "framework"}).`); jobId = job.data.id;
  const importedJob = job.data.state.jobs.find((value) => value.id === jobId);
  check(importedJob.source === "manual" && importedJob.lastCheckedAt === null, "Unverified imports must retain source attribution.");
  const application = await call("POST", "applications", { jobId, status: "Saved", notes: "Synthetic test" });
  check(application.response.status === 201, "Application tracking must succeed.");
  const notConfirmed = await call("PATCH", `applications/${application.data.id}`, { status: "Applied" });
  check(notConfirmed.response.status === 400, "Applied status must require user confirmation.");
  const confirmed = await call("PATCH", `applications/${application.data.id}`, { status: "Applied", confirmedApplied: true });
  check(confirmed.response.status === 200 && confirmed.data.state.applications.find((value) => value.id === application.data.id).submittedAt, "Confirmed submission must be recorded.");
  const task = await call("POST", "tasks", { title: `Synthetic HTTP test task ${nonce}` });
  check(task.response.status === 201, "Career task creation must succeed."); taskId = task.data.id;
  const finished = await call("PATCH", `tasks/${taskId}`, { completed: true });
  check(finished.data.state.tasks.find((value) => value.id === taskId).completed, "Task completion must persist.");
  const exported = await get("export");
  check(exported.status === 200 && exported.headers.get("content-disposition")?.includes("attachment"), "Owned export must be a private attachment.");
  const tooLarge = await call("POST", "resumes", { title: "Too big", text: "a".repeat(110000) });
  check(tooLarge.response.status === 413, "Oversized JSON must fail before storage.");
  console.log(`HTTP smoke passed ${checks} checks using the localhost test identity.`);
} finally {
  if (initial.activeResumeId) await call("POST", `resumes/${initial.activeResumeId}/active`);
  for (const id of createdResumes) await call("DELETE", `resumes/${id}`);
  if (jobId) await call("DELETE", `jobs/${jobId}`);
  if (taskId) await call("DELETE", `tasks/${taskId}`);
}
