import { CareerError, safePublicLink } from "./career-core";

/** Server configuration only. No credential is returned by integration-state APIs. */
export type CareerProviderEnv = {
  CAREER_JOBS_ENABLED?: string; GREENHOUSE_BOARDS_JSON?: string;
  CAREER_ALERTS_ENABLED?: string; CAREER_PUBLIC_ORIGIN?: string; CAREER_ALERT_RELAY_ORIGIN?: string; CAREER_VERIFICATION_SECRET?: string;
  RESEND_API_KEY?: string; RESEND_FROM?: string; RESEND_SENDER_VERIFIED?: string; RESEND_WEBHOOK_SECRET?: string;
  WHATSAPP_BUSINESS_TOKEN?: string; WHATSAPP_PHONE_NUMBER_ID?: string; WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_APP_SECRET?: string; WHATSAPP_VERIFY_TOKEN?: string; WHATSAPP_DIGEST_TEMPLATE?: string;
  WHATSAPP_VERIFICATION_TEMPLATE?: string; WHATSAPP_TEMPLATE_LANGUAGE?: string; WHATSAPP_TEMPLATES_APPROVED?: string;
  CAREER_SCHEDULER_SECRET?: string;
};
export type ApprovedBoard = { board: string; company: string; rightsConfigId: string; displayAllowed: true; digestAllowed: boolean; aiAllowed: boolean };
export type ProviderJob = {
  title: string; company: string; location: string | null; workArrangement: string | null; employmentType: string | null;
  minExperience: number | null; maxExperience: number | null; salary: string; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null; salaryBasis: "annual" | "monthly" | null;
  requirements: string[]; description: string; url: string; postedAt: string | null; closed: boolean;
  source: "greenhouse"; sourceJobId: string; sourceBoard: string; rightsConfigId: string;
  digestAllowed: boolean; aiAllowed: boolean; lastCheckedAt: string; sourceNote: string;
};
export type FeedResult = { board: ApprovedBoard; jobs: ProviderJob[]; checkedAt: string; errorCode: string | null };
export type Fetcher = typeof fetch;

export function approvedGreenhouseBoards(env: CareerProviderEnv): ApprovedBoard[] {
  if (env.CAREER_JOBS_ENABLED !== "true" || !env.GREENHOUSE_BOARDS_JSON) return [];
  try {
    const value: unknown = JSON.parse(env.GREENHOUSE_BOARDS_JSON);
    if (!Array.isArray(value) || !value.length || value.length > 10) return [];
    const result: ApprovedBoard[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") return [];
      const b = entry as Record<string, unknown>;
      if (typeof b.board !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(b.board) || typeof b.company !== "string" || !b.company.trim() || b.company.length > 200 || typeof b.rightsConfigId !== "string" || !/^[a-zA-Z0-9._-]{3,120}$/.test(b.rightsConfigId) || b.displayAllowed !== true || typeof b.digestAllowed !== "boolean" || typeof b.aiAllowed !== "boolean") return [];
      if (result.some((previous) => previous.board === b.board)) return [];
      result.push({ board: b.board, company: b.company.trim(), rightsConfigId: b.rightsConfigId, displayAllowed: true, digestAllowed: b.digestAllowed, aiAllowed: b.aiAllowed });
    }
    return result;
  } catch { return []; }
}
export function emailProviderReady(env: CareerProviderEnv) {
  return env.CAREER_ALERTS_ENABLED === "true" && env.RESEND_SENDER_VERIFIED === "true" && Boolean(env.RESEND_API_KEY?.startsWith("re_") && env.RESEND_WEBHOOK_SECRET?.startsWith("whsec_") && env.RESEND_FROM && /^[^\r\n]+@[^\r\n]+\.[^\r\n]+$/.test(env.RESEND_FROM) && publicOrigin(env) && relayOrigin(env));
}
export function whatsappProviderReady(env: CareerProviderEnv) {
  return env.CAREER_ALERTS_ENABLED === "true" && env.WHATSAPP_TEMPLATES_APPROVED === "true" && Boolean(env.WHATSAPP_BUSINESS_TOKEN && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN && /^\d{5,40}$/.test(env.WHATSAPP_PHONE_NUMBER_ID ?? "") && /^v\d{1,3}\.\d{1,2}$/.test(env.WHATSAPP_GRAPH_VERSION ?? "") && /^[a-z0-9_]{1,100}$/.test(env.WHATSAPP_DIGEST_TEMPLATE ?? "") && /^[a-z0-9_]{1,100}$/.test(env.WHATSAPP_VERIFICATION_TEMPLATE ?? "") && /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(env.WHATSAPP_TEMPLATE_LANGUAGE ?? "") && publicOrigin(env) && relayOrigin(env));
}
export function publicOrigin(env: CareerProviderEnv): string | null {
  try { const url = new URL(safePublicLink(env.CAREER_PUBLIC_ORIGIN)); return url.pathname === "/" && !url.search && !url.hash ? url.origin : null; } catch { return null; }
}
export function relayOrigin(env: CareerProviderEnv): string | null {
  return publicOrigin({ CAREER_PUBLIC_ORIGIN: env.CAREER_ALERT_RELAY_ORIGIN });
}
export function getProviderIntegrationState(env: CareerProviderEnv = {}) {
  const boards = approvedGreenhouseBoards(env);
  return {
    jobs: { status: boards.length ? "configured" : "not-connected", reason: boards.length ? `${boards.length} authorized employer board${boards.length === 1 ? "" : "s"} configured. Refresh jobs to check current availability.` : "Configure authorized Greenhouse employer boards and explicit display/digest rights. Naukri, Indeed and LoopCV remain awaiting approved access.", provider: boards.length ? "Greenhouse Job Board API" : null, live: false },
    email: { status: emailProviderReady(env) ? "configured" : "not-connected", reason: emailProviderReady(env) ? "Resend is configured. A verified destination, consent and an enabled server scheduler are still required." : "Configure Resend, a verified sender, signed callbacks and the public unsubscribe relay before delivery." },
    whatsapp: { status: whatsappProviderReady(env) ? "configured" : "not-connected", reason: whatsappProviderReady(env) ? "Official WhatsApp templates are configured. Verify your destination and opt in before delivery." : "Official sender, current API version, approved digest/verification templates, callback verification and destination verification are required." },
    loopcv: { status: "not-connected", reason: "LoopCV offers a partner API. Contract, permission and the current authoritative response schema must be verified before enabling it." },
    indeed: { status: "not-connected", reason: "Approved partnership and data-use rights are required; no scraping is performed." },
    naukri: { status: "not-connected", reason: "Licensed discovery access and data-use rights have not been configured." },
  };
}

const cleanText = (value: unknown, maximum = 30000) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maximum) : "";
/** Output is plain text rendered with React escaping; provider HTML is never injected. */
export function descriptionToText(value: unknown): string {
  let text = cleanText(value, 100000);
  for (let i = 0; i < 2; i++) text = text.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/gi, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&nbsp;": " " })[entity.toLowerCase()] ?? entity);
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "").replace(/<\/(?:p|li|div|h[1-6])\s*>|<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim().slice(0, 30000);
}
export function normalizeGreenhouseJob(value: unknown, board: ApprovedBoard, checkedAt: string): ProviderJob | null {
  if (!value || typeof value !== "object") throw new CareerError(502, "INVALID_FEED", "The job source returned an invalid listing.");
  const job = value as Record<string, unknown>;
  if (job.internal_job_id === null) return null; // Prospect pools are not actual vacancies.
  const id = typeof job.id === "number" && Number.isSafeInteger(job.id) && job.id > 0 ? String(job.id) : null;
  const title = cleanText(job.title, 200);
  let url = ""; try { url = safePublicLink(job.absolute_url); } catch { /* Fail the full board rather than expiring partially parsed listings. */ }
  if (!id || !title || !url) throw new CareerError(502, "INVALID_FEED", "The job source returned an incomplete listing.");
  const location = job.location && typeof job.location === "object" ? cleanText((job.location as Record<string, unknown>).name, 200) || null : null;
  const published = typeof job.first_published === "string" && Number.isFinite(Date.parse(job.first_published)) ? new Date(job.first_published).toISOString().slice(0, 10) : null;
  const deadline = typeof job.application_deadline === "string" && Number.isFinite(Date.parse(job.application_deadline)) ? Date.parse(job.application_deadline) : null;
  return { title, company: board.company, location, workArrangement: null, employmentType: null, minExperience: null, maxExperience: null, salary: "", salaryMin: null, salaryMax: null, salaryCurrency: null, salaryBasis: null, requirements: [], description: descriptionToText(job.content), url, postedAt: published, closed: deadline !== null && deadline <= Date.parse(checkedAt), source: "greenhouse", sourceJobId: id, sourceBoard: board.board, rightsConfigId: board.rightsConfigId, digestAllowed: board.digestAllowed, aiAllowed: board.aiAllowed, lastCheckedAt: checkedAt, sourceNote: "Published employer-board listing, checked through the official Greenhouse API. Missing fields remain unknown. Employer permission controls display, alerts and AI use; availability can change after this check." };
}
export async function boundedProviderJson(response: Response, limit = 4_000_000): Promise<unknown> {
  if (!response.ok) throw new CareerError(502, `SOURCE_HTTP_${response.status}`, "The job source is temporarily unavailable.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > limit) throw new CareerError(502, "FEED_TOO_LARGE", "The job source response exceeded its processing limit.");
  const reader = response.body?.getReader(); if (!reader) throw new CareerError(502, "INVALID_FEED", "The job source returned no content.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) { await reader.cancel(); throw new CareerError(502, "FEED_TOO_LARGE", "The job source response exceeded its processing limit."); } chunks.push(part.value); }
  const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)); } catch { throw new CareerError(502, "INVALID_FEED", "The job source returned invalid data."); }
}
export async function fetchGreenhouseJobs(env: CareerProviderEnv, fetcher: Fetcher = fetch, now = new Date(), beforeExternal?: (destination: string) => Promise<void>): Promise<FeedResult[]> {
  const boards = approvedGreenhouseBoards(env); if (!boards.length) throw new CareerError(503, "JOBS_NOT_CONFIGURED", "Authorized job feeds are not configured.");
  return Promise.all(boards.map(async (board) => {
    const checkedAt = now.toISOString();
    try {
      // Host/path are constructed only from server-approved board tokens. Redirects are rejected.
      const destination = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.board)}/jobs?content=true`;
      await beforeExternal?.(destination);
      const response = await fetcher(destination, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
      const body = await boundedProviderJson(response) as { jobs?: unknown[]; meta?: { total?: number } };
      if (!body || !Array.isArray(body.jobs) || body.jobs.length > 2000 || (typeof body.meta?.total === "number" && body.meta.total !== body.jobs.length)) throw new CareerError(502, "INCOMPLETE_FEED", "The job source returned an incomplete snapshot.");
      const jobs = body.jobs.map((job) => normalizeGreenhouseJob(job, board, checkedAt)).filter((job): job is ProviderJob => job !== null);
      const unique = new Map(jobs.map((job) => [job.sourceJobId, job]));
      return { board, jobs: [...unique.values()], checkedAt, errorCode: null };
    } catch (error) { return { board, jobs: [], checkedAt, errorCode: error instanceof CareerError ? error.code : "SOURCE_UNAVAILABLE" }; }
  }));
}

export async function persistOwnedFeedResults(db: D1Database, userId: string, feeds: FeedResult[]) {
  const exists = await db.prepare("SELECT user_id FROM career_accounts WHERE user_id=?").bind(userId).first();
  if (!exists) throw new CareerError(404, "NOT_FOUND", "Your career workspace was not found.");
  let count = 0; let closed = 0;
  for (const feed of feeds) {
    if (feed.errorCode) continue; // Failed/partial reads must never close the previous jobs.
    const existing = await db.prepare("SELECT id,data FROM career_jobs WHERE user_id=? AND source='greenhouse'").bind(userId).all<{ id: string; data: string }>();
    const seen = new Set(feed.jobs.map((job) => job.sourceJobId));
    const statements: D1PreparedStatement[] = [];
    for (const job of feed.jobs) statements.push(db.prepare("INSERT INTO career_jobs(id,user_id,fingerprint,data,source,source_job_id,last_checked_at,rights_config_id,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM career_jobs WHERE user_id=?)<500 OR EXISTS(SELECT 1 FROM career_jobs WHERE user_id=? AND source='greenhouse' AND source_job_id=?) ON CONFLICT(user_id,fingerprint) DO UPDATE SET data=excluded.data,last_checked_at=excluded.last_checked_at,rights_config_id=excluded.rights_config_id").bind(crypto.randomUUID(), userId, `greenhouse:${feed.board.board}:${job.sourceJobId}`, JSON.stringify(job), "greenhouse", `${feed.board.board}:${job.sourceJobId}`, feed.checkedAt, job.rightsConfigId, feed.checkedAt, userId, userId, `${feed.board.board}:${job.sourceJobId}`));
    for (const row of existing.results) {
      const previous = JSON.parse(row.data) as ProviderJob;
      if (previous.sourceBoard === feed.board.board && !seen.has(previous.sourceJobId) && !previous.closed) { statements.push(db.prepare("UPDATE career_jobs SET data=?,last_checked_at=? WHERE id=? AND user_id=?").bind(JSON.stringify({ ...previous, closed: true, lastCheckedAt: feed.checkedAt }), feed.checkedAt, row.id, userId)); closed++; }
    }
    // Bound batch size and preserve FK/owner controls in each statement.
    for (let index = 0; index < statements.length; index += 50) { const result = await db.batch(statements.slice(index, index + 50)); count += result.reduce((total, item) => total + (item.meta.changes ?? 0), 0); }
  }
  return { count, closed };
}
export async function refreshOwnedJobs(db: D1Database, userId: string, env: CareerProviderEnv, fetcher: Fetcher = fetch, beforeExternal?: (destination: string) => Promise<void>) {
  const feeds = await fetchGreenhouseJobs(env, fetcher, new Date(), beforeExternal); const persisted = await persistOwnedFeedResults(db, userId, feeds);
  const failedBoards = feeds.filter((feed) => feed.errorCode).map((feed) => ({ board: feed.board.board, code: feed.errorCode }));
  const checkedAt = new Date().toISOString();
  await db.prepare("INSERT INTO career_provider_health(provider,status,last_checked_at,error_code) VALUES('greenhouse',?,?,?) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,last_checked_at=excluded.last_checked_at,error_code=excluded.error_code").bind(failedBoards.length ? "degraded" : "healthy", checkedAt, failedBoards.length ? "SOURCE_UNAVAILABLE" : null).run();
  return { refreshed: feeds.some((feed) => !feed.errorCode), ...persisted, failedBoards, checkedAt };
}
