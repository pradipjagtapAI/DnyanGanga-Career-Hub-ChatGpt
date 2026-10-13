import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const origin = "https://dolphincreation.com", email = "candidate-worker@example.test", password = "Synthetic worker candidate password 826!";
await mkdir("outputs/candidate-worker", { recursive: true });
// Fixture-only mailbox/state routes exist solely in this ignored local test
// bundle. They are never added to the application or deployment source.
await build({ stdin: { contents: `
import {handleCandidateRequest,resolveCandidateCareerIdentity} from "./lib/career-candidate-auth.ts";
import {handleAdminRequest} from "./lib/career-admin-auth.ts";
import {CareerStore} from "./lib/career-store.ts";
const mail=[];
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==="/__fixture/mail")return Response.json(mail);
 if(path.startsWith("/api/admin/"))return handleAdminRequest(request,env);
 if(path.startsWith("/__fixture/private")){
  try{const identity=await resolveCandidateCareerIdentity(request,env),store=new CareerStore(identity,env.DB);await store.ensureAccount();
   if(request.method==="POST")return Response.json({id:await store.saveResume(await request.json())});
   return Response.json({identity,state:await store.state()});
  }catch(error){return Response.json({code:error.code??"unavailable"},{status:error.status??503});}
 }
 return handleCandidateRequest(request,env,{sendMail:async message=>{mail.push(message);return{id:"fixture-provider-accepted"};}});
}};`, resolveDir: process.cwd(), sourcefile: "candidate-test-worker.ts", loader: "ts" }, bundle: true, format: "esm", platform: "browser", target: "es2022", conditions: ["workerd", "worker", "browser"], external: ["node:*", "cloudflare:*"], outfile: "outputs/candidate-worker/worker.mjs", logLevel: "silent" });
const mf = new Miniflare(convertV4MiniflareOptions({ scriptPath: "outputs/candidate-worker/worker.mjs", modules: true, compatibilityDate: "2026-10-13", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "isolated-candidate-test" }, bindings: { CAREER_CANDIDATE_ENABLED: "true", CAREER_CANDIDATE_AUTH_SECRET: randomBytes(32).toString("base64url"), CAREER_PUBLIC_ORIGIN: origin, CAREER_CANDIDATE_EMAIL_ENABLED: "true", RESEND_API_KEY: "re_synthetic_worker_fixture", RESEND_FROM: "DnyanGanga <account@example.test>", RESEND_SENDER_VERIFIED: "true", CAREER_ADMIN_ENABLED: "true", CAREER_ADMIN_AUTH_SECRET: randomBytes(32).toString("base64url"), CAREER_ADMIN_EMAIL: "admin-worker@example.test" } }));
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) for (const statement of (await readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  let cookie = "", checks = 0;
  async function call(path, body) {
    const headers = { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { origin, "content-type": "application/json", "x-career-action": "1" }) };
    const response = await mf.dispatchFetch(origin + path, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const jar = new Map(cookie.split(";").filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i).trim(), c.slice(i + 1)]; }));
    for (const c of response.headers.getSetCookie()) { const p = c.split(";", 1)[0], i = p.indexOf("="); if (p.slice(i + 1)) jar.set(p.slice(0, i), p.slice(i + 1)); else jar.delete(p.slice(0, i)); }
    cookie = Array.from(jar, ([k, v]) => k + "=" + v).join("; ");
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  assert.equal((await call("/api/account/status")).data.configured, true); assert.equal((await call("/__fixture/private/state")).status, 401); checks++;
  let result = await call("/api/account/sign-up", { name: "First fixture candidate", email, password }); assert.equal(result.status, 202, JSON.stringify(result.data)); assert.equal(cookie, ""); assert.equal(Object.hasOwn(result.data, "token"), false); checks++;
  assert.equal((await call("/api/account/sign-in", { email, password })).status, 401); checks++;
  async function verifyLatest() { const messages = (await call("/__fixture/mail")).data, link = new URL(messages.at(-1).text.match(/https:\/\/[^\s]+/)[0]); const result = await call("/api/account/verify-email", { token: link.searchParams.get("token") }); assert.equal(result.status, 200, JSON.stringify(result.data)); return link.searchParams.get("token"); }
  const token = await verifyLatest(); assert.equal((await call("/api/account/verify-email", { token })).status, 401); checks++;
  result = await call("/api/account/sign-in", { email, password }); assert.equal(result.status, 200, JSON.stringify(result.data)); for (const c of result.headers.getSetCookie()) { assert.match(c, /Secure/); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Lax/i); assert.doesNotMatch(c, /Domain=/i); } checks++;
  const firstCookie = cookie, firstState = await call("/__fixture/private/state"); assert.equal(firstState.status, 200); assert.match(firstState.data.identity.userId, /^candidate:/); assert.equal(firstState.data.state.resumes.length, 0);
  result = await call("/__fixture/private/resume", { title: "Private synthetic resume", targetRole: "Engineer", text: "Synthetic private career record", source: "manual" }); assert.equal(result.status, 200); assert.equal((await call("/__fixture/private/state")).data.state.resumes.length, 1); checks++;
  assert.equal((await call("/api/admin/health")).status, 401); checks++;
  cookie = ""; const second = "second-candidate-worker@example.test"; assert.equal((await call("/api/account/sign-up", { name: "Second fixture candidate", email: second, password })).status, 202); await verifyLatest(); assert.equal((await call("/api/account/sign-in", { email: second, password })).status, 200); const secondState = await call("/__fixture/private/state"); assert.notEqual(secondState.data.identity.userId, firstState.data.identity.userId); assert.equal(secondState.data.state.resumes.length, 0); checks++;
  cookie = firstCookie; assert.equal((await call("/api/account/sign-out", {})).status, 200); cookie = firstCookie; assert.equal((await call("/__fixture/private/state")).status, 401); checks++;
  cookie = ""; assert.equal((await call("/api/account/social", { provider: "naukri" })).status, 503); assert.equal((await call("/api/account/update-role", { role: "admin" })).status, 404); checks++;
  console.log(JSON.stringify({ runtime: "actual local workerd/Miniflare with native D1", checks, result: "passed", realProviderDeliveryTested: false, realOAuthCredentialsUsed: false }));
} finally { await mf.dispose(); }
