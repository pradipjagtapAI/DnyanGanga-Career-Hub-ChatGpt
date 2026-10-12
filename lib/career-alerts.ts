import { Resend } from "resend";
import { CareerError } from "./career-core";
import { CareerStore } from "./career-store";
import { CareerAgentStore } from "./career-agent-store";
import { rankAgentJob } from "./career-agent-matching";
import type { ManualJob, NotificationSettings, Preferences, Profile } from "./career-core";
import { approvedGreenhouseBoards, boundedProviderJson, emailProviderReady, fetchGreenhouseJobs, persistOwnedFeedResults, publicOrigin, relayOrigin, whatsappProviderReady } from "./career-providers";
import type { CareerProviderEnv, FeedResult, Fetcher, ProviderJob } from "./career-providers";

export type AlertChannel = "email" | "whatsapp";
export type SendResult = { providerMessageId: string; status: "accepted" };
export type AlertMessage = { address: string; text: string; html?: string; from?: string; idempotencyKey: string; verification?: boolean; token?: string; unsubscribeUrl?: string };
export type AlertDependencies = { now?: () => Date; fetcher?: Fetcher; freshFeeds?: FeedResult[]; sendEmail?: (message: AlertMessage) => Promise<SendResult>; sendWhatsapp?: (message: AlertMessage) => Promise<SendResult> };
type Account = { user_id: string; profile: string; preferences: string; notifications: string; revision: number; notification_revision: number; active_resume_id: string | null };
type Destination = { id: string; user_id: string; channel: AlertChannel; address: string; verified_at: string | null };
type Dispatch = { id: string; user_id: string; channel: AlertChannel; local_date: string; status: string; consent_revision: number; profile_revision: number; resume_id: string | null; resume_version: number | null; job_ids: string; message_payload: string | null; destination_address: string; attempts: number; provider_message_id: string | null; lease_until: string | null; created_at: string; next_attempt_at: string | null };
export class DeliveryError extends Error {
  code: string; retryable: boolean; uncertain: boolean;
  constructor(code: string, retryable = false, uncertain = false) { super("The provider did not confirm acceptance."); this.code = code; this.retryable = retryable; this.uncertain = uncertain; }
}
const time = (deps: AlertDependencies) => (deps.now?.() ?? new Date()).toISOString();
const q = (db: D1Database, sql: string, ...values: (string | number | null)[]) => db.prepare(sql).bind(...values);
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function channelReady(channel: AlertChannel, env: CareerProviderEnv) { return channel === "email" ? emailProviderReady(env) : whatsappProviderReady(env); }
function normalizeAddress(channel: AlertChannel, input: string) {
  if (typeof input !== "string" || input.length > 254 || /[\r\n\u0000]/.test(input)) throw new CareerError(400, "INVALID_DESTINATION", "Enter a valid notification destination.");
  if (channel === "email") { const address = input.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new CareerError(400, "INVALID_DESTINATION", "Enter a valid email address."); return address; }
  const address = input.trim().replace(/[ ()-]/g, ""); if (!/^\+[1-9]\d{7,14}$/.test(address)) throw new CareerError(400, "INVALID_DESTINATION", "Use a WhatsApp number with its country code."); return address;
}
function requireVerificationSecret(env: CareerProviderEnv) { if (!env.CAREER_VERIFICATION_SECRET || env.CAREER_VERIFICATION_SECRET.length < 32) throw new CareerError(503, "VERIFICATION_NOT_CONFIGURED", "Destination verification is not configured."); return env.CAREER_VERIFICATION_SECRET; }
async function hmac(secret: string, value: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))); }
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
export async function verificationHash(secret: string, id: string, userId: string, channel: AlertChannel, address: string, token: string) { return hex(await hmac(secret, `${id}\n${userId}\n${channel}\n${address}\n${token}`)); }
function tokenCode() { const bytes = new Uint32Array(1); do { crypto.getRandomValues(bytes); } while (bytes[0] >= 4_200_000_000); return String(bytes[0] % 100_000_000).padStart(8, "0"); }
const mask = (channel: AlertChannel, address: string) => channel === "whatsapp" ? `••••${address.slice(-4)}` : `${address.slice(0, 1)}•••@${address.split("@")[1] ?? ""}`;

/** Missing settings preserve existing accounts. Each provider action reloads this. */
export async function notificationAgentGuard(db: D1Database, userId: string) {
  const row = await q(db, "SELECT paused_all,paused_categories,revision,vault_revision,answers_revision,feedback_revision FROM career_agent_settings WHERE user_id=?", userId).first<{ paused_all: number; paused_categories: string; revision: number; vault_revision: number; answers_revision: number; feedback_revision: number }>();
  if (!row) return { paused: false, jobsPaused: false, revision: 0, contextKey: "0:0:0:0", vaultRevision: 0, answersRevision: 0, feedbackRevision: 0 };
  const categories = JSON.parse(row.paused_categories) as string[];
  return { paused: row.paused_all === 1 || categories.includes("notifications"), jobsPaused: row.paused_all === 1 || categories.includes("jobs"), revision: row.revision, contextKey: `${row.revision}:${row.vault_revision}:${row.answers_revision}:${row.feedback_revision}`, vaultRevision: row.vault_revision, answersRevision: row.answers_revision, feedbackRevision: row.feedback_revision };
}
async function manifestStatement(db: D1Database, userId: string, agentId: "notification" | "job_discovery", phase: string, data: Record<string, unknown>, stamp: string, entityId: string | null = null) {
  // Private audit rows, never console/analytics. Codes are HMACs, not replayable secrets.
  const manifest = JSON.stringify({ phase, data }); const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest))));
  return q(db, "INSERT INTO career_agent_activity(id,user_id,agent_id,action,status,summary,run_id,entity_id,manifest,manifest_hash,created_at) VALUES(?,?,?,?,?,?,NULL,?,?,?,?)", crypto.randomUUID(), userId, agentId, `provider.${phase}`, phase, "Private provider request evidence recorded.", entityId, manifest, digest, stamp);
}
async function assertNotificationCurrent(db: D1Database, userId: string, revision?: number) {
  const guard = await notificationAgentGuard(db, userId);
  if (guard.paused || (revision !== undefined && guard.revision !== revision)) throw new CareerError(409, "AGENTS_PAUSED", "Notification work is paused or its permissions changed. Resume explicitly before continuing.");
  return guard;
}
export async function agentDigestSummary(db: D1Database, account: Account, localDate: string) {
  const settings = await notificationAgentGuard(db, account.user_id);
  const runs = await q(db, "SELECT r.id,r.context,r.settings_revision FROM career_agent_runs r LEFT JOIN career_saved_searches s ON s.id=r.search_id AND s.user_id=r.user_id WHERE r.user_id=? AND r.settings_revision=? AND (r.search_id IS NULL OR (s.enabled=1 AND s.revision=json_extract(r.context,'$.searchRevision'))) ORDER BY r.created_at DESC LIMIT 100", account.user_id, settings.revision).all<{ id: string; context: string; settings_revision: number }>();
  const relevant = runs.results.filter(row => { const context = JSON.parse(row.context) as Record<string, unknown>; return context.localDate === localDate && context.profileRevision === account.revision && (context.resumeId ?? null) === account.active_resume_id && context.vaultRevision === settings.vaultRevision && context.answersRevision === settings.answersRevision && context.feedbackRevision === settings.feedbackRevision; });
  if (!relevant.length) return null;
  const ids = new Set(relevant.map(row => row.id));
  const tasks = await q(db, "SELECT run_id,agent_id,status,output FROM career_agent_tasks WHERE user_id=? ORDER BY updated_at DESC LIMIT 2000", account.user_id).all<{ run_id: string; agent_id: string; status: string; output: string | null }>();
  const scoped = tasks.results.filter(task => ids.has(task.run_id)); const suitable = new Set<string>(); const packages = new Set<string>();
  for (const task of scoped) {
    const output = task.output ? JSON.parse(task.output) as Record<string, unknown> : {};
    if (task.agent_id === "job_matching" && task.status === "completed") for (const match of (output.results ?? []) as { jobId: string; relevance: { eligible: boolean } }[]) if (match.relevance?.eligible) suitable.add(match.jobId);
    if (task.agent_id === "application_preparation") for (const pkg of (output.packages ?? []) as { id: string }[]) if (pkg.id) packages.add(pkg.id);
  }
  return { runs: relevant.length, completedTasks: scoped.filter(task => task.status === "completed").length, tasksNeedingReview: scoped.filter(task => ["needs_input", "awaiting_approval"].includes(task.status)).length, tasksBlocked: scoped.filter(task => ["blocked", "failed", "uncertain", "unsupported"].includes(task.status)).length, suitableJobs: suitable.size, packagesPrepared: packages.size, submittedByAgents: 0 };
}

export function scheduleParts(now: Date, timeZone = "Asia/Kolkata") {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return { localDate: `${get("year")}-${get("month")}-${get("day")}`, minuteOfDay: Number(get("hour")) * 60 + Number(get("minute")) };
  } catch { throw new CareerError(400, "INVALID_TIMEZONE", "Choose a valid IANA time zone."); }
}
export function scheduleDue(now: Date, settings: NotificationSettings, catchupMinutes = 60) {
  const scheduled = /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.dispatchTime) ? settings.dispatchTime.split(":").map(Number) : [8, 0];
  const parts = scheduleParts(now, settings.timeZone || "Asia/Kolkata"); const target = scheduled[0] * 60 + scheduled[1];
  return { ...parts, due: !settings.paused && parts.minuteOfDay >= target && parts.minuteOfDay < Math.min(1440, target + catchupMinutes) };
}
export function nextDispatchAt(settings: NotificationSettings, now = new Date()) {
  if (settings.paused || (!settings.emailEnabled && !settings.whatsappEnabled)) return null;
  const target = (settings.dispatchTime || "08:00").split(":").map(Number); const expected = target[0] * 60 + target[1];
  const start = Math.floor(now.getTime() / 60000) * 60000 + 60000;
  for (let offset = 0; offset < 2880; offset++) { const candidate = new Date(start + offset * 60000); if (scheduleParts(candidate, settings.timeZone || "Asia/Kolkata").minuteOfDay === expected) return candidate.toISOString(); }
  return null;
}
async function sendEmail(env: CareerProviderEnv, message: AlertMessage): Promise<SendResult> {
  if (!emailProviderReady(env)) throw new DeliveryError("EMAIL_NOT_CONFIGURED");
  const client = new Resend(env.RESEND_API_KEY);
  try {
    const result = await client.emails.send({ from: message.from ?? env.RESEND_FROM!, to: [message.address], subject: message.verification ? "Verify your DnyanGanga Career Hub notification address" : "Your daily career matches", text: message.text, ...(message.html ? { html: message.html } : {}), ...(message.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${message.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) }, { idempotencyKey: message.idempotencyKey, signal: AbortSignal.timeout(15000) });
    if (result.error || !result.data?.id) throw classifyResendError(result.error?.name ?? "PROVIDER_REJECTED");
    return { status: "accepted", providerMessageId: result.data.id };
  } catch (error) { if (error instanceof DeliveryError) throw error; throw new DeliveryError("EMAIL_ACCEPTANCE_UNKNOWN", true, true); }
}
export function classifyResendError(name: string) {
  if (name === "rate_limit_exceeded") return new DeliveryError("EMAIL_RATE_LIMIT", true);
  if (name === "invalid_idempotent_request") return new DeliveryError("EMAIL_IDEMPOTENCY_CONFLICT", false, true);
  if (["concurrent_idempotent_requests", "application_error", "internal_server_error", "service_unavailable"].includes(name)) return new DeliveryError("EMAIL_ACCEPTANCE_UNKNOWN", true, true);
  return new DeliveryError("EMAIL_REJECTED");
}
async function sendWhatsapp(env: CareerProviderEnv, message: AlertMessage, fetcher: Fetcher): Promise<SendResult> {
  if (!whatsappProviderReady(env)) throw new DeliveryError("WHATSAPP_NOT_CONFIGURED");
  const template = message.verification ? env.WHATSAPP_VERIFICATION_TEMPLATE! : env.WHATSAPP_DIGEST_TEMPLATE!;
  // Digest template has one text variable; authentication template has body + copy-code button.
  if (!message.verification && message.text.length > 1000) throw new DeliveryError("WHATSAPP_MESSAGE_TOO_LONG");
  const components: unknown[] = [{ type: "body", parameters: [{ type: "text", text: message.verification ? message.token! : message.text }] }];
  if (message.verification) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: message.token! }] });
  try {
    const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${env.WHATSAPP_BUSINESS_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: message.address.slice(1), type: "template", template: { name: template, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE }, components } }) });
    if (!response.ok) throw new DeliveryError(response.status === 429 ? "WHATSAPP_RATE_LIMIT" : "WHATSAPP_REJECTED", response.status === 429, response.status >= 500);
    const result = await boundedProviderJson(response, 50000) as { messages?: { id?: string }[] };
    if (typeof result.messages?.[0]?.id !== "string" || result.messages[0].id.length > 300) throw new DeliveryError("WHATSAPP_ACCEPTANCE_UNKNOWN", false, true);
    return { status: "accepted", providerMessageId: result.messages[0].id };
  } catch (error) { if (error instanceof DeliveryError) throw error; throw new DeliveryError("WHATSAPP_ACCEPTANCE_UNKNOWN", false, true); }
}
async function deliver(env: CareerProviderEnv, channel: AlertChannel, message: AlertMessage, deps: AlertDependencies) { return channel === "email" ? (deps.sendEmail?.(message) ?? sendEmail(env, message)) : (deps.sendWhatsapp?.(message) ?? sendWhatsapp(env, message, deps.fetcher ?? fetch)); }

/** Called only from an authenticated, same-origin user action; never by background signup. */
export async function requestDestinationVerification(db: D1Database, identity: { userId: string; email: string }, channel: AlertChannel, addressValue: string, env: CareerProviderEnv, deps: AlertDependencies = {}) {
  if (channel !== "email" && channel !== "whatsapp") throw new CareerError(400, "INVALID_CHANNEL", "Choose email or WhatsApp.");
  const address = normalizeAddress(channel, addressValue); const secret = requireVerificationSecret(env);
  const permission = await assertNotificationCurrent(db, identity.userId);
  if (!channelReady(channel, env)) throw new CareerError(503, "PROVIDER_NOT_CONFIGURED", "This verification channel is not configured.");
  // Notification verification cannot be used as an arbitrary-email spam relay.
  if (channel === "email" && address !== identity.email.trim().toLowerCase()) throw new CareerError(400, "IDENTITY_DESTINATION_REQUIRED", "Email alerts use your signed-in account email.");
  const now = time(deps); const window = new Date(Date.parse(now) - 3600000).toISOString(); const id = crypto.randomUUID(); const token = tokenCode(); const tokenHash = await verificationHash(secret, id, identity.userId, channel, address, token); const expiresAt = new Date(Date.parse(now) + 600000).toISOString();
  const created = await q(db, "INSERT INTO career_destination_verifications(id,user_id,channel,address,token_hash,expires_at,attempts,created_at) SELECT ?,?,?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM career_destination_verifications WHERE user_id=? AND created_at>?)<3", id, identity.userId, channel, address, tokenHash, expiresAt, now, identity.userId, window).run();
  if (!created.meta.changes) throw new CareerError(429, "VERIFICATION_RATE_LIMIT", "You can request three verification messages per hour.");
  await q(db, "UPDATE career_destination_verifications SET consumed_at=? WHERE user_id=? AND channel=? AND id<>? AND consumed_at IS NULL", now, identity.userId, channel, id).run();
  try {
    const message = { address, verification: true, token, idempotencyKey: `verify/${id}`, text: `Your DnyanGanga Career Hub verification code is ${token}. It expires in 10 minutes. Enter it only in your account. If you did not request this code, ignore this message.` };
    await (await manifestStatement(db, identity.userId, "notification", "before", { channel, destination: address, idempotencyKey: message.idempotencyKey, tokenHmac: tokenHash, text: message.text.replace(token, "[verification code omitted]"), purpose: "destination-verification" }, now, id)).run();
    await assertNotificationCurrent(db, identity.userId, permission.revision);
    const sent = await deliver(env, channel, message, deps);
    await db.batch([q(db, "UPDATE career_destination_verifications SET provider_message_id=? WHERE id=? AND user_id=?", sent.providerMessageId, id, identity.userId), await manifestStatement(db, identity.userId, "notification", "accepted", { providerMessageId: sent.providerMessageId, deliveryConfirmed: false }, time(deps), id)]);
    return { verificationId: id, expiresAt, status: "accepted" as const };
  } catch (error) { await db.batch([q(db, "UPDATE career_destination_verifications SET consumed_at=? WHERE id=? AND user_id=?", now, id, identity.userId), await manifestStatement(db, identity.userId, "notification", "failed", { code: error instanceof CareerError ? error.code : "VERIFICATION_SEND_FAILED" }, time(deps), id)]); if (error instanceof CareerError && error.code === "AGENTS_PAUSED") throw error; throw new CareerError(503, "VERIFICATION_SEND_FAILED", "The provider did not confirm this verification message. No destination was verified."); }
}
export async function confirmDestinationVerification(db: D1Database, userId: string, id: string, token: string, env: CareerProviderEnv, now = new Date()) {
  const secret = requireVerificationSecret(env); if (typeof id !== "string" || id.length > 100 || !/^\d{8}$/.test(token)) throw new CareerError(400, "INVALID_VERIFICATION", "Enter the eight-digit verification code.");
  const stamp = now.toISOString();
  const row = await q(db, "UPDATE career_destination_verifications SET attempts=attempts+1 WHERE id=? AND user_id=? AND consumed_at IS NULL AND expires_at>? AND attempts<5 RETURNING *", id, userId, stamp).first<{ channel: AlertChannel; address: string; token_hash: string }>();
  if (!row) throw new CareerError(400, "VERIFICATION_EXPIRED", "This verification is expired, used, or has too many attempts.");
  const expected = await verificationHash(secret, id, userId, row.channel, row.address, token);
  if (expected !== row.token_hash) throw new CareerError(400, "INVALID_VERIFICATION", "The verification code is incorrect.");
  const consumed = await q(db, "UPDATE career_destination_verifications SET consumed_at=? WHERE id=? AND user_id=? AND token_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING id", stamp, id, userId, expected, stamp).first();
  if (!consumed) throw new CareerError(400, "VERIFICATION_EXPIRED", "This verification has already been used.");
  const field = row.channel === "email" ? "emailVerified" : "whatsappVerified"; const enabled = row.channel === "email" ? "emailEnabled" : "whatsappEnabled"; const consent = row.channel === "email" ? "emailConsent" : "whatsappConsent"; const consentAt = row.channel === "email" ? "emailConsentRecordedAt" : "whatsappConsentRecordedAt";
  await db.batch([
    q(db, "INSERT INTO career_notification_destinations(id,user_id,channel,address,verified_at,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,channel) DO UPDATE SET address=excluded.address,verified_at=excluded.verified_at", crypto.randomUUID(), userId, row.channel, row.address, stamp, stamp),
    q(db, `UPDATE career_accounts SET notifications=json_set(notifications,'$.${field}',json('true'),'$.${enabled}',json('false'),'$.${consent}',json('false'),'$.${consentAt}',NULL),notification_revision=notification_revision+1 WHERE user_id=?`, userId),
    q(db, "UPDATE career_alert_dispatches SET status='cancelled',error_code='DESTINATION_CHANGED',updated_at=? WHERE user_id=? AND status IN ('queued','retry')", stamp, userId),
  ]);
  return { channel: row.channel, verified: true, address: mask(row.channel, row.address) };
}

export async function getAlertState(db: D1Database, userId: string, env: CareerProviderEnv) {
  const [destinations, history, account] = await Promise.all([
    q(db, "SELECT channel,address,verified_at FROM career_notification_destinations WHERE user_id=?", userId).all<Destination>(),
    q(db, "SELECT id,channel,local_date,status,job_ids,profile_revision,resume_id,resume_version,attempts,error_code,created_at,accepted_at,delivered_at FROM career_alert_dispatches WHERE user_id=? ORDER BY created_at DESC LIMIT 100", userId).all(),
    q(db, "SELECT notifications FROM career_accounts WHERE user_id=?", userId).first<{ notifications: string }>(),
  ]);
  const settings = account ? JSON.parse(account.notifications) as NotificationSettings : null;
  const eligibleChannel = settings && destinations.results.some((row) => row.verified_at && channelReady(row.channel, env) && (row.channel === "email" ? settings.emailEnabled && settings.emailConsent && settings.emailVerified : settings.whatsappEnabled && settings.whatsappConsent && settings.whatsappVerified));
  const schedulerConfigured = Boolean(env.CAREER_SCHEDULER_SECRET && env.CAREER_SCHEDULER_SECRET.length >= 32);
  const agentGuard = await notificationAgentGuard(db, userId);
  return { verifiedDestinations: destinations.results.map((row) => ({ channel: row.channel, address: mask(row.channel, row.address), verified: Boolean(row.verified_at), verifiedAt: row.verified_at })), notificationHistory: history.results.map((row: Record<string, unknown>) => ({ id: row.id, channel: row.channel, localDate: row.local_date, status: row.status, jobCount: typeof row.job_ids === "string" ? (JSON.parse(row.job_ids) as string[]).length : null, profileRevision: row.profile_revision, resumeId: row.resume_id, resumeVersion: row.resume_version, attempts: row.attempts, errorCode: row.error_code, createdAt: row.created_at, acceptedAt: row.accepted_at, deliveredAt: row.delivered_at })), nextAlert: settings && eligibleChannel && schedulerConfigured && !agentGuard.paused && !agentGuard.jobsPaused ? nextDispatchAt(settings) : null };
}
export function canDispatch(account: Account, dispatch: Dispatch, destination: Destination | null, env: CareerProviderEnv) {
  const settings = JSON.parse(account.notifications) as NotificationSettings;
  return !settings.paused && channelReady(dispatch.channel, env) && account.notification_revision === dispatch.consent_revision && Boolean(destination?.verified_at) && destination?.address === dispatch.destination_address && (dispatch.channel === "email" ? settings.emailConsent && settings.emailEnabled && settings.emailVerified : settings.whatsappConsent && settings.whatsappEnabled && settings.whatsappVerified);
}
async function suitableJobs(db: D1Database, account: Account, env: CareerProviderEnv, now: Date, successfulBoards: Set<string>, ids?: string[]) {
  const prefs = JSON.parse(account.preferences) as Preferences; const storedProfile = JSON.parse(account.profile) as Profile;
  const owned = new CareerAgentStore(new CareerStore({ userId: account.user_id, email: storedProfile.email, fullName: storedProfile.fullName }, db));
  const profile = await owned.confirmedProfile();
  const vault = await owned.getVault();
  if (!prefs.targetRoles.length) return [];
  const resume = account.active_resume_id ? await q(db, "SELECT content FROM career_resume_versions WHERE id=? AND user_id=?", account.active_resume_id, account.user_id).first<{ content: string }>() : null;
  const rows = await q(db, "SELECT id,data FROM career_jobs WHERE user_id=? AND source='greenhouse' ORDER BY last_checked_at DESC LIMIT 500", account.user_id).all<{ id: string; data: string }>();
  const boards = approvedGreenhouseBoards(env);
  return rows.results.map((row) => ({ id: row.id, job: JSON.parse(row.data) as ProviderJob })).filter(({ id, job }) => (!ids || ids.includes(id)) && successfulBoards.has(job.sourceBoard) && !job.closed && job.digestAllowed && boards.some((board) => board.board === job.sourceBoard && board.rightsConfigId === job.rightsConfigId && board.digestAllowed) && Number.isFinite(Date.parse(job.lastCheckedAt)) && now.getTime() - Date.parse(job.lastCheckedAt) <= 120000 && Date.parse(job.lastCheckedAt) <= now.getTime() + 60000).map(({ id, job }) => ({ id, job, match: rankAgentJob(job as ManualJob, profile, prefs, resume?.content, vault) })).filter(({ job, match }) => match.relevance.eligible && prefs.targetRoles.some((role) => job.title.toLowerCase().includes(role.toLowerCase()))).sort((a, b) => (b.match.relevance.score ?? 0) - (a.match.relevance.score ?? 0));
}

async function enqueueForAccount(db: D1Database, account: Account, localDate: string, env: CareerProviderEnv, sourceAvailable: boolean, deps: AlertDependencies) {
  const settings = JSON.parse(account.notifications) as NotificationSettings; const stamp = time(deps);
  const agentGuard = await notificationAgentGuard(db, account.user_id); if (agentGuard.paused || agentGuard.jobsPaused) return;
  const active = account.active_resume_id ? await q(db, "SELECT version FROM career_resume_versions WHERE id=? AND user_id=?", account.active_resume_id, account.user_id).first<{ version: number }>() : null;
  const jobs = sourceAvailable ? await suitableJobs(db, account, env, new Date(stamp), new Set((deps.freshFeeds ?? []).filter((feed) => !feed.errorCode).map((feed) => feed.board.board))) : [];
  for (const channel of ["email", "whatsapp"] as const) {
    const destination = await q(db, "SELECT * FROM career_notification_destinations WHERE user_id=? AND channel=?", account.user_id, channel).first<Destination>();
    if (!destination?.verified_at || !channelReady(channel, env) || settings.paused || !(channel === "email" ? settings.emailEnabled && settings.emailConsent && settings.emailVerified : settings.whatsappEnabled && settings.whatsappConsent && settings.whatsappVerified)) continue;
    const existing = await q(db, "SELECT job_id FROM career_alert_job_dedupe WHERE user_id=? AND channel=?", account.user_id, channel).all<{ job_id: string }>();
    const sent = new Set(existing.results.map((row) => row.job_id));
    const available = jobs.filter((job) => !sent.has(job.id)).slice(0, Math.max(1, Math.min(10, settings.maxJobsPerDigest ?? 5))).map((job) => job.id);
    const id = crypto.randomUUID(); const status = !sourceAvailable ? "source_unavailable" : available.length ? "queued" : "no_new_jobs";
    // Dispatch and per-job reservations commit together. A duplicate daily dispatch
    // cannot reserve another dispatch's jobs, even when requests race.
    await db.batch([
      q(db, "INSERT OR IGNORE INTO career_alert_dispatches(id,user_id,local_date,channel,status,consent_revision,profile_revision,resume_id,resume_version,job_ids,destination_address,attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,?)", id, account.user_id, localDate, channel, status, account.notification_revision, account.revision, active ? account.active_resume_id : null, active?.version ?? null, "[]", destination.address, stamp, stamp),
      ...available.map((jobId) => q(db, "INSERT OR IGNORE INTO career_alert_job_dedupe(id,user_id,channel,job_id,dispatch_id,status,created_at) SELECT ?,?,?,?,?,'reserved',? WHERE EXISTS(SELECT 1 FROM career_alert_dispatches WHERE id=? AND user_id=? AND status='queued')", crypto.randomUUID(), account.user_id, channel, jobId, id, stamp, id, account.user_id)),
      q(db, "UPDATE career_alert_dispatches SET job_ids=(SELECT json_group_array(job_id) FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=?),status=CASE WHEN status='queued' AND NOT EXISTS(SELECT 1 FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=?) THEN 'no_new_jobs' ELSE status END WHERE id=? AND user_id=?", id, account.user_id, id, account.user_id, id, account.user_id),
    ]);
  }
}
async function unsubscribeUrl(env: CareerProviderEnv, dispatch: Dispatch) {
  const expiry = String(Math.floor(Date.parse(dispatch.created_at) / 1000) + 30 * 86400); const payload = `${dispatch.user_id}|${dispatch.channel}|${expiry}`; const token = `${btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${hex(await hmac(requireVerificationSecret(env), payload))}`;
  return `${relayOrigin(env)}/unsubscribe?token=${encodeURIComponent(token)}`;
}
export async function processDispatch(db: D1Database, row: Dispatch, env: CareerProviderEnv, deps: AlertDependencies = {}) {
  const stamp = time(deps); const lease = new Date(Date.parse(stamp) + 120000).toISOString();
  const claimed = await q(db, "UPDATE career_alert_dispatches SET status='sending',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('queued','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND attempts<3 RETURNING *", lease, stamp, row.id, row.user_id, stamp).first<Dispatch>();
  if (!claimed) return;
  const account = await q(db, "SELECT * FROM career_accounts WHERE user_id=?", row.user_id).first<Account>(); const destination = await q(db, "SELECT * FROM career_notification_destinations WHERE user_id=? AND channel=?", row.user_id, row.channel).first<Destination>();
  if (account) { const profile = JSON.parse(account.profile) as Profile; await new CareerAgentStore(new CareerStore({ userId: row.user_id, email: profile.email, fullName: profile.fullName }, db)).ensureSettings(); }
  const permission = await notificationAgentGuard(db, row.user_id);
  if (permission.paused || permission.jobsPaused) { await cancelDispatch(db, claimed, stamp, "AGENTS_PAUSED"); return; }
  if (!account || !canDispatch(account, claimed, destination, env)) { await cancelDispatch(db, claimed, stamp, "CONSENT_OR_DESTINATION_CHANGED"); return; }
  if (claimed.profile_revision !== account.revision || claimed.resume_id !== account.active_resume_id) { await cancelDispatch(db, claimed, stamp, "CAREER_CONTEXT_CHANGED"); return; }
  let feeds = deps.freshFeeds;
  if (!feeds) { try { feeds = await fetchGreenhouseJobs(env, deps.fetcher ?? fetch, new Date(stamp), async (url) => { await (await manifestStatement(db, row.user_id, "job_discovery", "before", { destination: url, sentData: { method: "GET", personalData: [] } }, time(deps), row.id)).run(); const current = await assertNotificationCurrent(db, row.user_id, permission.revision); if (current.jobsPaused) throw new CareerError(409, "AGENTS_PAUSED", "Job discovery is paused."); }); await (await manifestStatement(db, row.user_id, "job_discovery", "after", { sources: feeds.map(feed => ({ board: feed.board.board, checkedAt: feed.checkedAt, errorCode: feed.errorCode, observed: feed.errorCode ? null : feed.jobs.length })) }, time(deps), row.id)).run(); } catch { feeds = []; } }
  const refreshedPermission = await notificationAgentGuard(db, row.user_id);
  if (refreshedPermission.paused || refreshedPermission.jobsPaused || refreshedPermission.contextKey !== permission.contextKey) { await cancelDispatch(db, claimed, stamp, "AGENTS_PAUSED"); return; }
  const successfulBoards = new Set(feeds.filter((feed) => !feed.errorCode).map((feed) => feed.board.board));
  if (successfulBoards.size) await persistOwnedFeedResults(db, account.user_id, feeds);
  const jobs = (await suitableJobs(db, account, env, new Date(stamp), successfulBoards, JSON.parse(claimed.job_ids) as string[])).slice(0, Math.max(1, Math.min(10, (JSON.parse(account.notifications) as NotificationSettings).maxJobsPerDigest ?? 5)));
  if (!successfulBoards.size) { await db.batch([q(db, "UPDATE career_alert_dispatches SET status='source_unavailable',error_code='SOURCE_UNAVAILABLE',lease_until=NULL,updated_at=? WHERE id=? AND user_id=? AND status='sending'", stamp, claimed.id, claimed.user_id), q(db, "DELETE FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=? AND status='reserved'", claimed.id, claimed.user_id)]); return; }
  if (!jobs.length) {
    const ownedRows = await q(db, "SELECT id,data FROM career_jobs WHERE user_id=? AND source='greenhouse'", claimed.user_id).all<{ id: string; data: string }>();
    const selected = new Set(JSON.parse(claimed.job_ids) as string[]);
    const failedBoard = ownedRows.results.some((job) => selected.has(job.id) && !successfulBoards.has((JSON.parse(job.data) as ProviderJob).sourceBoard));
    if (failedBoard) await db.batch([q(db, "UPDATE career_alert_dispatches SET status='source_unavailable',error_code='SOURCE_UNAVAILABLE',lease_until=NULL,updated_at=? WHERE id=? AND user_id=? AND status='sending'", stamp, claimed.id, claimed.user_id), q(db, "DELETE FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=? AND status='reserved'", claimed.id, claimed.user_id)]);
    else await cancelDispatch(db, claimed, stamp, "NO_CURRENT_SUITABLE_JOBS");
    return;
  }
  const dashboard = `${publicOrigin(env)}/dashboard`; const unsubscribe = await unsubscribeUrl(env, claimed);
  const lines = jobs.map(({ job, match }) => `${job.title} — ${job.company}\n${job.location ?? "Location not supplied"}\n${match.matchedSkills.length ? `Confirmed skill keywords: ${match.matchedSkills.join(", ")}` : "Target title matches; requirements need review."}\n${job.url}`).join("\n\n");
  let text = `Your new career matches\n\n${lines}\n\nReview source details and unknown requirements before applying: ${dashboard}\nManage or unsubscribe from alerts: ${unsubscribe}\nNo applications have been submitted.`;
  const workflow = await agentDigestSummary(db, account, claimed.local_date);
  const workflowText = workflow ? `Today's career workflow: ${workflow.suitableJobs} suitable owned jobs; ${workflow.packagesPrepared} packages prepared; ${workflow.tasksNeedingReview} tasks need review; ${workflow.tasksBlocked} blocked/unsupported/uncertain tasks. No agent submissions.` : "";
  if (workflowText) text += `\n\n${workflowText}`;
  if (row.channel === "whatsapp") {
    const footer = `\n${workflow ? `Workflow: ${workflow.packagesPrepared} prepared; ${workflow.tasksNeedingReview} need review; ${workflow.tasksBlocked} blocked/unsupported.\n` : ""}Review all current jobs and unknown requirements: ${dashboard}\nStop alerts: ${unsubscribe}\nReply STOP to unsubscribe. No applications submitted.`;
    const brief = jobs.map(({ job, match }) => `${job.title.slice(0, 65)} — ${job.company.slice(0, 40)} (${(job.location ?? "location unknown").slice(0, 30)}). ${match.matchedSkills[0] ? `Skill keyword: ${match.matchedSkills[0].slice(0, 25)}.` : "Target title matches."}`);
    text = "New career matches\n";
    for (const line of brief) { if (text.length + line.length + footer.length + 1 > 950) break; text += `${line}\n`; }
    text += footer;
  }
  const proposed: AlertMessage = { address: destination!.address, text, html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`, from: row.channel === "email" ? env.RESEND_FROM : undefined, unsubscribeUrl: unsubscribe, idempotencyKey: `digest/${row.id}` };
  let message = proposed;
  if (claimed.message_payload) {
    try { message = JSON.parse(claimed.message_payload) as AlertMessage; } catch { await cancelDispatch(db, claimed, stamp, "INVALID_MESSAGE_RECORD"); return; }
    if (message.text !== proposed.text || message.address !== proposed.address || message.from !== proposed.from || message.idempotencyKey !== proposed.idempotencyKey) { await cancelDispatch(db, claimed, stamp, "MESSAGE_CONTEXT_CHANGED"); return; }
  } else {
    // Durably freeze the body before any external side effect. Stable provider
    // keys only prevent duplicate email when the request body is also identical.
    await q(db, "UPDATE career_alert_dispatches SET message_payload=? WHERE id=? AND user_id=? AND status='sending' AND message_payload IS NULL", JSON.stringify(proposed), claimed.id, claimed.user_id).run();
  }
  // Reload immediately before the provider call. Unsending an already initiated provider request is impossible.
  const latest = await q(db, "SELECT * FROM career_accounts WHERE user_id=?", row.user_id).first<Account>(); const latestDestination = await q(db, "SELECT * FROM career_notification_destinations WHERE user_id=? AND channel=?", row.user_id, row.channel).first<Destination>();
  if (latest && (latest.revision !== account.revision || latest.active_resume_id !== account.active_resume_id)) { await cancelDispatch(db, claimed, stamp, "CAREER_CONTEXT_CHANGED"); return; }
  const finalPermission = await notificationAgentGuard(db, row.user_id);
  if (finalPermission.paused || finalPermission.jobsPaused || finalPermission.contextKey !== permission.contextKey) { await cancelDispatch(db, claimed, stamp, "AGENTS_PAUSED"); return; }
  if (!latest || !canDispatch(latest, claimed, latestDestination, env)) { await cancelDispatch(db, claimed, stamp, "CONSENT_OR_DESTINATION_CHANGED"); return; }
  if (latest.revision !== account.revision || latest.active_resume_id !== account.active_resume_id) { await cancelDispatch(db, claimed, stamp, "CAREER_CONTEXT_CHANGED"); return; }
  try {
    await (await manifestStatement(db, row.user_id, "notification", "before", { channel: row.channel, sentData: message, profileRevision: account.revision, resumeId: claimed.resume_id, localDate: claimed.local_date }, time(deps), row.id)).run();
    await assertNotificationCurrent(db, row.user_id, permission.revision);
    const sendPermission = await notificationAgentGuard(db, row.user_id); if (sendPermission.jobsPaused || sendPermission.contextKey !== permission.contextKey) { await cancelDispatch(db, claimed, stamp, "AGENTS_PAUSED"); return; }
    const finalAccount = await q(db, "SELECT * FROM career_accounts WHERE user_id=?", row.user_id).first<Account>();
    if (!finalAccount || !canDispatch(finalAccount, claimed, latestDestination, env) || finalAccount.revision !== account.revision || finalAccount.active_resume_id !== account.active_resume_id) { await cancelDispatch(db, claimed, stamp, "CONSENT_OR_CONTEXT_CHANGED"); return; }
    const result = await deliver(env, row.channel, message, deps);
    await (await manifestStatement(db, row.user_id, "notification", "accepted", { providerMessageId: result.providerMessageId, status: result.status, deliveryConfirmed: false }, time(deps), row.id)).run();
    await db.batch([q(db, "UPDATE career_alert_dispatches SET status='accepted',provider_message_id=?,accepted_at=?,updated_at=?,lease_until=NULL,error_code=NULL WHERE id=? AND user_id=? AND status='sending'", result.providerMessageId, time(deps), time(deps), row.id, row.user_id), q(db, "UPDATE career_alert_job_dedupe SET status='accepted' WHERE dispatch_id=? AND user_id=? AND status<>'delivered' AND EXISTS(SELECT 1 FROM career_alert_dispatches WHERE id=? AND user_id=? AND status='accepted')", row.id, row.user_id, row.id, row.user_id), providerHealthStatement(db, row.channel === "email" ? "resend" : "whatsapp", "healthy", time(deps), null)]);
  } catch (error) {
    if (error instanceof CareerError && error.code === "AGENTS_PAUSED") { await cancelDispatch(db, claimed, stamp, "AGENTS_PAUSED"); return; }
    const failure = error instanceof DeliveryError ? error : new DeliveryError("ACCEPTANCE_UNKNOWN", row.channel === "email", true);
    const withinIdempotencyWindow = Date.parse(stamp) - Date.parse(claimed.created_at) < 20 * 3600000;
    const retry = claimed.attempts < 3 && failure.retryable && withinIdempotencyWindow && (!failure.uncertain || row.channel === "email");
    const status = retry ? "retry" : failure.uncertain ? "uncertain" : "failed";
    await (await manifestStatement(db, row.user_id, "notification", status, { errorCode: failure.code, mayHaveBeenAccepted: failure.uncertain }, time(deps), row.id)).run();
    await db.batch([
      q(db, "UPDATE career_alert_dispatches SET status=?,error_code=?,next_attempt_at=?,lease_until=NULL,updated_at=? WHERE id=? AND user_id=? AND status='sending'", status, failure.code, retry ? new Date(Date.parse(stamp) + (2 ** claimed.attempts) * 60000).toISOString() : null, stamp, row.id, row.user_id),
      ...(status === "failed" ? [q(db, "DELETE FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=? AND status='reserved' AND EXISTS(SELECT 1 FROM career_alert_dispatches WHERE id=? AND user_id=? AND status='failed')", row.id, row.user_id, row.id, row.user_id)] : []),
      ...(failure.uncertain ? [q(db, "UPDATE career_alert_job_dedupe SET status='uncertain' WHERE dispatch_id=? AND user_id=? AND status<>'delivered' AND EXISTS(SELECT 1 FROM career_alert_dispatches WHERE id=? AND user_id=? AND status IN ('retry','uncertain','failed') AND error_code=?)", row.id, row.user_id, row.id, row.user_id, failure.code)] : []),
      providerHealthStatement(db, row.channel === "email" ? "resend" : "whatsapp", "degraded", stamp, failure.code),
    ]);
  }
}
async function cancelDispatch(db: D1Database, row: Dispatch, stamp: string, code: string) { await db.batch([q(db, "UPDATE career_alert_dispatches SET status='cancelled',error_code=?,lease_until=NULL,updated_at=? WHERE id=? AND user_id=? AND status='sending'", code, stamp, row.id, row.user_id), q(db, "DELETE FROM career_alert_job_dedupe WHERE dispatch_id=? AND user_id=? AND status='reserved'", row.id, row.user_id)]); }
function providerHealthStatement(db: D1Database, provider: string, status: string, stamp: string, code: string | null) { return q(db, "INSERT INTO career_provider_health(provider,status,last_checked_at,error_code) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,last_checked_at=excluded.last_checked_at,error_code=excluded.error_code", provider, status, stamp, code); }

/** Durable D1 outbox, bounded worker scans, no dependence on an open browser. */
export async function runAlertScheduler(db: D1Database, env: CareerProviderEnv, deps: AlertDependencies = {}) {
  if (env.CAREER_ALERTS_ENABLED !== "true" || !publicOrigin(env) || !env.CAREER_VERIFICATION_SECRET || env.CAREER_VERIFICATION_SECRET.length < 32) throw new CareerError(503, "ALERTS_NOT_CONFIGURED", "Server alert delivery is not configured.");
  const stamp = time(deps); const now = new Date(stamp); const lease = new Date(now.getTime() + 120000).toISOString();
  await q(db, "INSERT OR IGNORE INTO career_scheduler_state(key,cursor,updated_at) VALUES('alerts',NULL,?)", stamp).run();
  const lock = await q(db, "UPDATE career_scheduler_state SET lease_until=? WHERE key='alerts' AND (lease_until IS NULL OR lease_until<?) RETURNING cursor", lease, stamp).first<{ cursor: string | null }>();
  if (!lock) return { status: "busy", usersChecked: 0 };
  try {
    // Explicit pauses cancel pending work, including queued digests created before
    // the command center existed. Uncertain provider reservations remain fenced.
    await db.batch([q(db, "UPDATE career_alert_dispatches SET status='cancelled',error_code='AGENTS_PAUSED',lease_until=NULL,updated_at=? WHERE status IN ('queued','retry') AND EXISTS(SELECT 1 FROM career_agent_settings s WHERE s.user_id=career_alert_dispatches.user_id AND (s.paused_all=1 OR EXISTS(SELECT 1 FROM json_each(s.paused_categories) WHERE value IN ('notifications','jobs'))))", stamp), q(db, "DELETE FROM career_alert_job_dedupe WHERE status='reserved' AND dispatch_id IN (SELECT id FROM career_alert_dispatches WHERE status='cancelled' AND error_code='AGENTS_PAUSED')")]);
    // A crashed send is uncertain; only Resend can safely replay its durable idempotency key.
    await db.batch([q(db, "UPDATE career_alert_dispatches SET status=CASE WHEN channel='email' AND attempts<3 AND created_at>? THEN 'retry' ELSE 'uncertain' END,error_code='SEND_LEASE_EXPIRED',lease_until=NULL,next_attempt_at=?,updated_at=? WHERE status='sending' AND lease_until<?", new Date(now.getTime() - 20 * 3600000).toISOString(), stamp, stamp, stamp), q(db, "UPDATE career_alert_job_dedupe SET status='uncertain' WHERE status='reserved' AND dispatch_id IN (SELECT id FROM career_alert_dispatches WHERE status='uncertain' OR error_code='SEND_LEASE_EXPIRED')")]);
    const accounts = await q(db, "SELECT * FROM career_accounts WHERE user_id>? ORDER BY user_id LIMIT 50", lock.cursor ?? "").all<Account>();
    const dueCandidates = accounts.results.filter((account) => scheduleDue(now, JSON.parse(account.notifications) as NotificationSettings).due);
    const due: Account[] = []; const permissions = new Map<string, number>();
    for (const account of dueCandidates) { const guard = await notificationAgentGuard(db, account.user_id); if (!guard.paused && !guard.jobsPaused) { due.push(account); permissions.set(account.user_id, guard.revision); } }
    const pendingOwners = await q(db, "SELECT DISTINCT user_id FROM career_alert_dispatches WHERE status IN ('queued','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?) LIMIT 30", stamp).all<{ user_id: string }>();
    for (const owner of pendingOwners.results) { const guard = await notificationAgentGuard(db, owner.user_id); if (!guard.paused && !guard.jobsPaused) permissions.set(owner.user_id, guard.revision); }
    let feeds: FeedResult[] = [];
    if (permissions.size) {
      try { feeds = await fetchGreenhouseJobs(env, deps.fetcher ?? fetch, now, async (url) => {
        for (const [owner, revision] of permissions) { const guard = await notificationAgentGuard(db, owner); if (guard.paused || guard.jobsPaused || guard.revision !== revision) { permissions.delete(owner); continue; } await (await manifestStatement(db, owner, "job_discovery", "before", { destination: url, sentData: { method: "GET", personalData: [] }, purpose: "daily-digest-source-refresh" }, time(deps))).run(); }
        // Last awaited boundary before network access. A paused owner gets no
        // source result or message even when another opted-in owner continues.
        for (const [owner, revision] of permissions) { const guard = await notificationAgentGuard(db, owner); if (guard.paused || guard.jobsPaused || guard.revision !== revision) permissions.delete(owner); }
        if (!permissions.size) throw new CareerError(409, "AGENTS_PAUSED", "All scheduled source refreshes were paused.");
      }); } catch { /* Source unavailable is recorded distinctly below. */ }
      const available = feeds.some((feed) => !feed.errorCode);
      for (const [owner, revision] of permissions) { const guard = await notificationAgentGuard(db, owner); if (guard.paused || guard.jobsPaused || guard.revision !== revision) continue; await (await manifestStatement(db, owner, "job_discovery", "after", { sources: feeds.map(feed => ({ board: feed.board.board, checkedAt: feed.checkedAt, errorCode: feed.errorCode, listingCount: feed.errorCode ? null : feed.jobs.length })) }, time(deps))).run(); }
      for (const account of due) { if (!permissions.has(account.user_id)) continue; const guard = await notificationAgentGuard(db, account.user_id); if (guard.paused || guard.jobsPaused || guard.revision !== permissions.get(account.user_id)) continue; if (available) await persistOwnedFeedResults(db, account.user_id, feeds); await enqueueForAccount(db, account, scheduleParts(now, (JSON.parse(account.notifications) as NotificationSettings).timeZone).localDate, env, available, { ...deps, freshFeeds: feeds }); }
      await q(db, "INSERT INTO career_provider_health(provider,status,last_checked_at,error_code) VALUES('greenhouse',?,?,?) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,last_checked_at=excluded.last_checked_at,error_code=excluded.error_code", available && feeds.every((feed) => !feed.errorCode) ? "healthy" : "degraded", stamp, available ? null : "SOURCE_UNAVAILABLE").run();
    }
    const pending = await q(db, "SELECT * FROM career_alert_dispatches WHERE status IN ('queued','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at LIMIT 30", stamp).all<Dispatch>();
    // Individual failures do not prevent the other channel from progressing.
    const processing = await Promise.allSettled(pending.results.map((dispatch) => processDispatch(db, dispatch, env, { ...deps, freshFeeds: feeds })));
    await q(db, "UPDATE career_scheduler_state SET cursor=?,lease_until=NULL,updated_at=? WHERE key='alerts' AND lease_until=?", accounts.results.length === 50 ? accounts.results[49].user_id : null, time(deps), lease).run();
    await providerHealthStatement(db, "scheduler", processing.some((item) => item.status === "rejected") ? "degraded" : "healthy", time(deps), processing.some((item) => item.status === "rejected") ? "DISPATCH_PROCESSING_FAILED" : null).run();
    return { status: "processed", usersChecked: accounts.results.length, usersDue: due.length, dispatchesChecked: pending.results.length, processingErrors: processing.filter((item) => item.status === "rejected").length };
  } finally { await q(db, "UPDATE career_scheduler_state SET lease_until=NULL WHERE key='alerts' AND lease_until=?", lease).run(); }
}
export async function assertSchedulerRequest(request: Request, env: CareerProviderEnv) {
  const secret = env.CAREER_SCHEDULER_SECRET;
  if (!secret || secret.length < 32) throw new CareerError(503, "SCHEDULER_NOT_CONFIGURED", "The server scheduler is not configured.");
  const supplied = request.headers.get("x-career-scheduler-secret") ?? "";
  const expectedHash = await hmac(secret, secret); const suppliedHash = await hmac(secret, supplied); let mismatch = 0; for (let i = 0; i < expectedHash.length; i++) mismatch |= expectedHash[i] ^ suppliedHash[i];
  if (request.method !== "POST" || mismatch || supplied.length !== secret.length) throw new CareerError(403, "SCHEDULER_UNAUTHORIZED", "Scheduler access denied.");
}

async function rawCallback(request: Request) { const reader = request.body?.getReader(); if (!reader) throw new CareerError(400, "INVALID_CALLBACK", "Missing callback payload."); let size = 0; const chunks: Uint8Array[] = []; while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 200000) { await reader.cancel(); throw new CareerError(413, "CALLBACK_TOO_LARGE", "Callback payload too large."); } chunks.push(next.value); } const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
export async function verifyMetaSignature(body: string, signature: string, secret: string) { if (!/^sha256=[0-9a-f]{64}$/.test(signature) || !secret) return false; const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); const bytes = new Uint8Array(signature.slice(7).match(/../g)!.map((x) => parseInt(x, 16))); return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body)); }
async function recordDelivery(db: D1Database, provider: string, eventId: string, messageId: string, channel: AlertChannel, status: string, stamp: string, reportedAt: string) {
  const dispatch = await q(db, "SELECT id,user_id,status FROM career_alert_dispatches WHERE provider_message_id=? AND channel=?", messageId, channel).first<{ id: string; user_id: string; status: string }>();
  if (!dispatch) { const verification = await q(db, "SELECT id FROM career_destination_verifications WHERE provider_message_id=? AND channel=?", messageId, channel).first(); if (verification) return; throw new CareerError(503, "CALLBACK_NOT_READY", "The message record is not ready. Retry this callback."); }
  // Acceptance, state transition and processing marker form one durable transaction.
  // A failed transaction leaves the event retryable. Replays cannot undo terminal states.
  const unprocessed = "EXISTS(SELECT 1 FROM career_provider_events WHERE provider=? AND event_id=? AND processed_at IS NULL)";
  await db.batch([
    q(db, "INSERT OR IGNORE INTO career_provider_events(provider,event_id,created_at) VALUES(?,?,?)", provider, eventId, stamp),
    status === "delivered" ? q(db, `UPDATE career_alert_dispatches SET status='delivered',delivered_at=?,updated_at=?,error_code=NULL WHERE id=? AND user_id=? AND status IN ('sending','accepted','retry','uncertain') AND ${unprocessed}`, reportedAt, stamp, dispatch.id, dispatch.user_id, provider, eventId) : q(db, `UPDATE career_alert_dispatches SET status='failed',error_code='PROVIDER_DELIVERY_FAILED',updated_at=? WHERE id=? AND user_id=? AND status IN ('sending','accepted','retry','uncertain') AND ${unprocessed}`, stamp, dispatch.id, dispatch.user_id, provider, eventId),
    q(db, `UPDATE career_alert_job_dedupe SET status='delivered' WHERE dispatch_id=? AND user_id=? AND EXISTS(SELECT 1 FROM career_alert_dispatches WHERE id=? AND user_id=? AND status='delivered') AND ${unprocessed}`, dispatch.id, dispatch.user_id, dispatch.id, dispatch.user_id, provider, eventId),
    q(db, "UPDATE career_provider_events SET processed_at=? WHERE provider=? AND event_id=? AND processed_at IS NULL", stamp, provider, eventId),
  ]);
}
async function stopWhatsapp(db: D1Database, address: string, stamp: string, eventId: string) {
  const rows = await q(db, "SELECT user_id FROM career_notification_destinations WHERE channel='whatsapp' AND address=? AND verified_at IS NOT NULL", address).all<{ user_id: string }>();
  const pending = " AND EXISTS(SELECT 1 FROM career_provider_events WHERE provider='whatsapp' AND event_id=? AND processed_at IS NULL)";
  await db.batch([q(db, "INSERT OR IGNORE INTO career_provider_events(provider,event_id,created_at) VALUES('whatsapp',?,?)", eventId, stamp), ...rows.results.flatMap((row) => unsubscribeStatements(db, row.user_id, "whatsapp", stamp, pending, [eventId])), q(db, "UPDATE career_provider_events SET processed_at=? WHERE provider='whatsapp' AND event_id=? AND processed_at IS NULL", stamp, eventId)]);
}
function unsubscribeStatements(db: D1Database, userId: string, channel: AlertChannel, stamp: string, condition = "", args: string[] = []) {
  const consent = channel === "email" ? "emailConsent" : "whatsappConsent"; const enabled = channel === "email" ? "emailEnabled" : "whatsappEnabled";
  return [q(db, `UPDATE career_accounts SET notifications=json_set(notifications,'$.${consent}',json('false'),'$.${enabled}',json('false')),notification_revision=notification_revision+1 WHERE user_id=?${condition}`, userId, ...args), q(db, `UPDATE career_alert_dispatches SET status='cancelled',error_code='UNSUBSCRIBED',updated_at=? WHERE user_id=? AND channel=? AND status IN ('queued','retry')${condition}`, stamp, userId, channel, ...args), q(db, `DELETE FROM career_alert_job_dedupe WHERE user_id=? AND channel=? AND status='reserved' AND dispatch_id IN (SELECT id FROM career_alert_dispatches WHERE user_id=? AND status='cancelled')${condition}`, userId, channel, userId, ...args)];
}
async function unsubscribeChannel(db: D1Database, userId: string, channel: AlertChannel, stamp: string) { await db.batch(unsubscribeStatements(db, userId, channel, stamp)); }
export async function handleUnsubscribe(request: Request, db: D1Database, env: CareerProviderEnv) {
  const token = new URL(request.url).searchParams.get("token") ?? ""; const [encoded, signature] = token.split("."); let payload = "";
  try { if (!encoded || encoded.length > 600 || !/^[0-9a-f]{64}$/.test(signature ?? "")) throw new Error(); payload = atob(encoded.replace(/-/g, "+").replace(/_/g, "/")); } catch { throw new CareerError(400, "INVALID_UNSUBSCRIBE", "This unsubscribe link is invalid."); }
  const [userId, channel, expiry] = payload.split("|"); if (!userId || !["email", "whatsapp"].includes(channel) || !/^\d+$/.test(expiry) || Number(expiry) < Date.now() / 1000 || Number(expiry) > Date.now() / 1000 + 31 * 86400 || !await verifyMetaSignature(payload, `sha256=${signature}`, requireVerificationSecret(env))) throw new CareerError(400, "INVALID_UNSUBSCRIBE", "This unsubscribe link is invalid or expired.");
  if (request.method === "GET") return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Manage career alerts</title><body><h1>Stop these career alerts?</h1><form method="post"><button type="submit">Unsubscribe</button></form></body></html>', { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'" } });
  if (request.method !== "POST") throw new CareerError(405, "METHOD_NOT_ALLOWED", "Use the unsubscribe confirmation.");
  await unsubscribeChannel(db, userId, channel as AlertChannel, new Date().toISOString());
  return new Response("You have unsubscribed from these career alerts.", { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
export async function handleProviderCallback(request: Request, db: D1Database, env: CareerProviderEnv, provider: "resend" | "whatsapp") {
  if (provider === "whatsapp" && request.method === "GET") { const url = new URL(request.url); if (!env.WHATSAPP_VERIFY_TOKEN || url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== env.WHATSAPP_VERIFY_TOKEN) throw new CareerError(403, "INVALID_CALLBACK", "Callback verification denied."); const challenge = url.searchParams.get("hub.challenge") ?? ""; if (!/^\d{1,100}$/.test(challenge)) throw new CareerError(400, "INVALID_CALLBACK", "Invalid callback challenge."); return new Response(challenge); }
  if (request.method !== "POST") throw new CareerError(405, "METHOD_NOT_ALLOWED", "Use a provider callback.");
  const body = await rawCallback(request); const stamp = new Date().toISOString();
  if (provider === "resend") {
    if (!env.RESEND_WEBHOOK_SECRET) throw new CareerError(503, "CALLBACK_NOT_CONFIGURED", "Provider callbacks are not configured.");
    let event: ReturnType<Resend["webhooks"]["verify"]>;
    try { event = new Resend(env.RESEND_API_KEY ?? "re_callback_verification").webhooks.verify({ payload: body, headers: { id: request.headers.get("svix-id") ?? "", timestamp: request.headers.get("svix-timestamp") ?? "", signature: request.headers.get("svix-signature") ?? "" }, webhookSecret: env.RESEND_WEBHOOK_SECRET }); } catch { throw new CareerError(403, "INVALID_SIGNATURE", "Provider callback signature denied."); }
    if (["email.delivered", "email.failed", "email.bounced", "email.complained", "email.suppressed"].includes(event.type)) { const data = event.data as { email_id?: string }; const reportedAt = typeof event.created_at === "string" && Number.isFinite(Date.parse(event.created_at)) ? new Date(event.created_at).toISOString() : null; if (typeof data.email_id !== "string" || data.email_id.length > 300 || !reportedAt || Date.parse(reportedAt) > Date.parse(stamp) + 60000) throw new CareerError(400, "INVALID_CALLBACK", "Missing message reference or event time."); await recordDelivery(db, "resend", request.headers.get("svix-id")!, data.email_id, "email", event.type === "email.delivered" ? "delivered" : "failed", stamp, reportedAt); }
  } else {
    if (!env.WHATSAPP_APP_SECRET || !env.WHATSAPP_PHONE_NUMBER_ID) throw new CareerError(503, "CALLBACK_NOT_CONFIGURED", "Provider callbacks are not configured.");
    if (!await verifyMetaSignature(body, request.headers.get("x-hub-signature-256") ?? "", env.WHATSAPP_APP_SECRET)) throw new CareerError(403, "INVALID_SIGNATURE", "Provider callback signature denied.");
    let parsed: { object?: string; entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; statuses?: { id: string; status: string; timestamp: string }[]; messages?: { from: string; text?: { body: string }; id: string }[] } }[] }[] };
    try { parsed = JSON.parse(body); } catch { throw new CareerError(400, "INVALID_CALLBACK", "Invalid callback data."); }
    if (parsed.object !== "whatsapp_business_account" || !Array.isArray(parsed.entry) || parsed.entry.length > 50) throw new CareerError(400, "INVALID_CALLBACK", "Invalid callback account.");
    for (const entry of parsed.entry) {
      if (!entry || !Array.isArray(entry.changes) || entry.changes.length > 100) throw new CareerError(400, "INVALID_CALLBACK", "Invalid callback changes.");
      for (const change of entry.changes) { const value = change?.value; if (!value || value.metadata?.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID) continue;
        if ((value.statuses && !Array.isArray(value.statuses)) || (value.messages && !Array.isArray(value.messages))) throw new CareerError(400, "INVALID_CALLBACK", "Invalid callback events.");
        for (const status of (value.statuses ?? []).slice(0, 100)) if (status && ["delivered", "failed"].includes(status.status) && typeof status.id === "string" && status.id.length < 300 && /^\d{1,12}$/.test(status.timestamp) && Number(status.timestamp) * 1000 <= Date.parse(stamp) + 60000) await recordDelivery(db, "whatsapp", `${status.id}:${status.status}:${status.timestamp}`, status.id, "whatsapp", status.status, stamp, new Date(Number(status.timestamp) * 1000).toISOString());
        for (const message of (value.messages ?? []).slice(0, 100)) if (message && typeof message.id === "string" && message.id.length < 300 && typeof message.from === "string" && /^[1-9]\d{7,14}$/.test(message.from) && typeof message.text?.body === "string" && /^(?:stop|unsubscribe|cancel|end|quit)$/i.test(message.text.body.trim())) await stopWhatsapp(db, `+${message.from}`, stamp, `stop:${message.id}`);
      }
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
