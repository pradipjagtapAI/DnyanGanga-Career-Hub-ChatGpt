import { getChatGPTUser } from "../../../chatgpt-auth";
import { env } from "cloudflare:workers";
import { CareerError, assertMutationRequest, disabledFeatureForPath, keys, readJsonBounded } from "../../../../lib/career-core";
import { CareerStore } from "../../../../lib/career-store";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
function json(data: unknown, status = 200, extra: Record<string, string> = {}) { return Response.json(data, { status, headers: { ...privateHeaders, ...extra } }); }

async function handle(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: "Sign in to use your private workspace.", code: "UNAUTHENTICATED" }, 401);
    const path = new URL(request.url).pathname.replace(/^\/api\/career\/?/, "").split("/").filter(Boolean);
    const mutation = request.method !== "GET";
    if (mutation) assertMutationRequest(request);
    // Integrations are always checked server-side, before any private-data reads.
    const blockedFeature = disabledFeatureForPath(path[0] ?? "", request.method);
    if (blockedFeature) {
      // Consume only bounded, same-origin JSON before replying. This also avoids
      // leaving an unread request stream in local Vite/Miniflare transport pools.
      if (mutation) await readJsonBounded(request);
      return json({ error: blockedFeature.reason, code: "FEATURE_NOT_CONFIGURED", integration: blockedFeature }, 503);
    }
    const store = new CareerStore(user, env.DB);
    await store.ensureAccount();
    if (!mutation && path.join("/") === "state") return json(await store.state());
    if (!mutation && path.join("/") === "export") return json(await store.export(), 200, { "Content-Disposition": "attachment; filename=dolphin-career-export.json" });
    if (!mutation && path[0] === "resumes" && path.length === 3 && path[2] === "download") {
      const resume = await store.ownedResume(path[1]);
      return new Response(resume.content, { headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename=resume-v${resume.version}.txt` } });
    }
    if (!mutation) return json({ error: "This page was not found.", code: "NOT_FOUND" }, 404);
    await store.rateLimit();
    const payload = await readJsonBounded(request);
    const resource = path[0]; const id = path[1]; const action = path[2];
    let createdId: string | undefined;
    if (request.method === "PUT" && resource === "profile" && path.length === 1) await store.saveProfile(payload);
    else if (request.method === "PUT" && resource === "draft" && path.length === 1) await store.saveDraft(payload);
    else if (request.method === "DELETE" && resource === "draft" && path.length === 1) await store.deleteDraft(payload);
    else if (request.method === "POST" && resource === "resumes" && path.length === 1) createdId = await store.saveResume(payload);
    else if (request.method === "POST" && resource === "resumes" && id && action === "active" && path.length === 3) { keys(payload, []); await store.setActiveResume(id); }
    else if (request.method === "POST" && resource === "resumes" && id && action === "restore" && path.length === 3) { keys(payload, []); createdId = await store.saveResume({}, await store.ownedResume(id)); }
    else if (request.method === "DELETE" && resource === "resumes" && id && path.length === 2) { keys(payload, []); await store.deleteResume(id); }
    else if (request.method === "POST" && resource === "jobs" && path.length === 1) createdId = await store.importJob(payload);
    else if (request.method === "DELETE" && resource === "jobs" && id && path.length === 2) { keys(payload, []); await store.deleteJob(id); }
    else if (request.method === "POST" && resource === "applications" && path.length === 1) createdId = await store.saveApplication(payload);
    else if (request.method === "PATCH" && resource === "applications" && id && path.length === 2) await store.saveApplication(payload, id);
    else if (request.method === "DELETE" && resource === "applications" && id && path.length === 2) { keys(payload, []); await store.deleteApplication(id); }
    else if (request.method === "PUT" && resource === "notifications" && path.length === 1) await store.saveNotifications(payload);
    else if (request.method === "POST" && resource === "tasks" && path.length === 1) createdId = await store.createTask(payload);
    else if (request.method === "PATCH" && resource === "tasks" && id && path.length === 2) await store.updateTask(id, payload);
    else if (request.method === "DELETE" && resource === "tasks" && id && path.length === 2) { keys(payload, []); await store.deleteTask(id); }
    else if (request.method === "DELETE" && resource === "account" && path.length === 1) { await store.deleteAccount(payload); return json({ deleted: true, message: "Your career workspace was deleted. Your platform sign-in account is managed separately." }); }
    else return json({ error: "This action was not found.", code: "NOT_FOUND" }, 404);
    return json({ ok: true, id: createdId, state: await store.state() }, createdId ? 201 : 200);
  } catch (error) {
    if (error instanceof CareerError) return json({ error: error.message, code: error.code }, error.status, error.status === 429 ? { "Retry-After": "60" } : {});
    // No raw errors, SQL, document text, private IDs, or credentials in visitor responses/logs.
    return json({ error: "This change could not be completed. Please retry, or contact support with the time of the error.", code: "WORKSPACE_UNAVAILABLE" }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
