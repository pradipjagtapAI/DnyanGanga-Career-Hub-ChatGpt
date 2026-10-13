import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Safe readiness checks: no accounts, credentials or candidate data are sent.
const origin = process.env.CAREER_BUILT_URL || "http://127.0.0.1:8787";
const results = [];
async function check(path, status) {
  const result = await fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  assert.ok((Array.isArray(status) ? status : [status]).includes(result.status), path + " returned " + result.status);
  assert.ok(result.headers.get("cache-control")?.includes("no-store"), path + " cache policy");
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  if (path === "/verify-email" || path === "/reset-password" || path.startsWith("/api/account/")) assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  results.push({ path, status: result.status });
  await result.body?.cancel();
}
for (const path of ["/", "/sign-up", "/login", "/forgot-password", "/reset-password", "/verify-email", "/admin/login"]) await check(path, 200);
await check("/dashboard", 307);
await check("/api/career/state", 401);
await check("/api/career/export", 401);
await check("/api/admin/health", [401, 503]);
await check("/api/account/get-session", 404);
await check("/api/account/update-user", 404);
const statusResponse = await fetch(origin + "/api/account/status", { signal: AbortSignal.timeout(15000) });
assert.equal(statusResponse.status, 200);
const readiness = await statusResponse.json();
assert.equal(readiness.authenticated, false);
assert.equal(readiness.user, null);
assert.deepEqual(readiness.providers.map(p => p.id), ["google", "linkedin", "naukri", "indeed"]);
assert.equal(readiness.providers.find(p => p.id === "naukri").enabled, false);
if (process.env.CAREER_EXPECT_UNCONFIGURED === "true") {
  assert.equal(readiness.configured, false);
  assert.equal(readiness.emailAvailable, false);
  assert.ok(readiness.providers.every(p => !p.enabled));
}
results.push({ path: "/api/account/status", status: 200, unauthenticated: true });
await mkdir("outputs", { recursive: true });
await writeFile("outputs/candidate-http-smoke.json", JSON.stringify({ origin, passed: true, results, scope: "Anonymous readiness, public pages and private access denial; no actual registration, email delivery or OAuth round trip." }, null, 2));
console.log(JSON.stringify({ passed: true, checks: results.length, scope: "anonymous access and signup readiness" }));
