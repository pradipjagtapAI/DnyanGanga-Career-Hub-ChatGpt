/** Separate deployment: Cloudflare Cron and a narrow signed-provider callback relay. */
export type SchedulerEnv = {
  CAREER_SITE_ORIGIN?: string;
  CAREER_SCHEDULER_SECRET?: string;
  SITES_PRIVATE_AUDIENCE?: string;
  SITES_SERVICE_BEARER?: string;
};
type SchedulerDependencies = { fetcher?: typeof fetch };
function origin(env: SchedulerEnv) {
  try { const url = new URL(env.CAREER_SITE_ORIGIN ?? ""); if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.port || url.hostname === "localhost" || /^[\d.]+$/.test(url.hostname) || !url.hostname.includes(".")) return null; return url.origin; } catch { return null; }
}
function serviceHeaders(env: SchedulerEnv) {
  // This token only reaches the configured Sites host. It grants no candidate identity.
  if (env.SITES_PRIVATE_AUDIENCE !== "false" && !env.SITES_SERVICE_BEARER) return null;
  const headers = new Headers();
  if (env.SITES_SERVICE_BEARER) headers.set("OAI-Sites-Authorization", `Bearer ${env.SITES_SERVICE_BEARER}`);
  return headers;
}
function response(message: string, status = 200) { return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } }); }
export async function runScheduled(env: SchedulerEnv, deps: SchedulerDependencies = {}) {
  const target = origin(env); const headers = serviceHeaders(env);
  if (!target || !headers || !env.CAREER_SCHEDULER_SECRET || env.CAREER_SCHEDULER_SECRET.length < 32) return { status: "not-configured" };
  headers.set("x-career-scheduler-secret", env.CAREER_SCHEDULER_SECRET);
  headers.set("content-type", "application/json");
  try {
    const result = await (deps.fetcher ?? fetch)(`${target}/api/career/internal/scheduler`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(55000), headers, body: "{}" });
    await result.body?.cancel();
    return { status: result.ok ? "accepted" : "failed", httpStatus: result.status };
  } catch { return { status: "unavailable" }; }
}
export async function relayCallback(request: Request, env: SchedulerEnv, deps: SchedulerDependencies = {}) {
  const url = new URL(request.url); const target = origin(env); const headers = serviceHeaders(env);
  const provider = url.pathname === "/webhooks/resend" ? "resend" : url.pathname === "/webhooks/whatsapp" ? "whatsapp" : null;
  const unsubscribe = url.pathname === "/unsubscribe";
  if (!provider && !unsubscribe) return response("Not found.", 404);
  if (!target || !headers) return response("Callback service is not configured.", 503);
  let query = ""; let body: Uint8Array<ArrayBuffer> | undefined;
  if (unsubscribe) {
    if (!["GET", "POST"].includes(request.method)) return response("Method not allowed.", 405);
    const token = url.searchParams.get("token"); if (!token || token.length > 700) return response("Invalid unsubscribe link.", 400);
    query = `?${new URLSearchParams({ token })}`;
  } else if (request.method === "GET" && provider === "whatsapp") {
    const params = new URLSearchParams();
    for (const name of ["hub.mode", "hub.verify_token", "hub.challenge"]) { const value = url.searchParams.get(name); if (value === null || value.length > 300) return response("Invalid callback verification.", 400); params.set(name, value); }
    query = `?${params}`;
  } else if (request.method === "POST") {
    const reader = request.body?.getReader(); if (!reader) return response("Missing callback payload.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 200000) { await reader.cancel(); return response("Callback payload too large.", 413); } chunks.push(part.value); }
    body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    headers.set("content-type", "application/json");
    for (const name of provider === "resend" ? ["svix-id", "svix-timestamp", "svix-signature"] : ["x-hub-signature-256"]) { const value = request.headers.get(name); if (!value || value.length > 1000) return response("Missing callback signature.", 403); headers.set(name, value); }
  } else return response("Method not allowed.", 405);
  try {
    // Original bytes and signature headers reach the authoritative server verifier.
    // Caller cookies, Authorization, arbitrary query fields and paths never do.
    const path = unsubscribe ? "notifications/unsubscribe" : `callbacks/${provider}`;
    const result = await (deps.fetcher ?? fetch)(`${target}/api/career/${path}${query}`, { method: request.method, redirect: "error", signal: AbortSignal.timeout(55000), headers, ...(body ? { body } : {}) });
    if (!result.ok) { await result.body?.cancel(); return response("Callback was not accepted; retry according to the provider policy.", result.status >= 500 ? 503 : 403); }
    if (unsubscribe) return new Response(result.body, { status: 200, headers: { "content-type": request.method === "GET" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'", "referrer-policy": "no-referrer" } });
    if (request.method === "GET") { const text = await result.text(); return /^\d{1,100}$/.test(text) ? response(text) : response("Invalid verification response.", 502); }
    await result.body?.cancel(); return response("Accepted.");
  } catch { return response("Callback service unavailable; retry according to the provider policy.", 503); }
}
const scheduledWorker = {
  async scheduled(_controller: ScheduledController, env: SchedulerEnv, context: ExecutionContext) { context.waitUntil(runScheduled(env).then((result) => { if (result.status !== "accepted") console.warn(JSON.stringify({ component: "career-alert-scheduler", ...result })); })); },
  fetch(request: Request, env: SchedulerEnv) { return relayCallback(request, env); },
};
export default scheduledWorker;
