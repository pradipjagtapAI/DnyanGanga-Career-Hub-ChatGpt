import { CareerError, boolean, keys, number, object, string, strings } from "./career-core";
import type { Preferences, Profile } from "./career-core";

export const AGENT_MODES = ["assist", "approval", "agentic"] as const;
export type AgentMode = typeof AGENT_MODES[number];
export const AGENT_CATEGORIES = ["profile", "documents", "jobs", "applications", "notifications", "communications", "interviews", "career", "security"] as const;
export type AgentCategory = typeof AGENT_CATEGORIES[number];
export const TASK_STATUSES = ["queued", "running", "completed", "blocked", "needs_input", "awaiting_approval", "unsupported", "failed", "uncertain", "cancelled"] as const;
export type AgentTaskStatus = typeof TASK_STATUSES[number];
export const SPECIALIST_AGENTS = [
  { id: "profile", name: "Profile", category: "profile", description: "Review confirmed career facts and request missing information." },
  { id: "resume_intelligence", name: "Resume intelligence", category: "documents", description: "Inspect the selected resume and explain document evidence." },
  { id: "resume_fact_checker", name: "Resume fact checker", category: "documents", description: "Flag possible date, claim and credential inconsistencies for your review; never change facts automatically." },
  { id: "job_discovery", name: "Job discovery", category: "jobs", description: "Refresh approved sources within saved-search limits." },
  { id: "job_verification", name: "Job verification", category: "jobs", description: "Check source status, attribution, duplicates, and unknown fields." },
  { id: "job_matching", name: "Job matching", category: "jobs", description: "Apply mandatory preferences before evidence-based ranking." },
  { id: "resume_tailoring", name: "Resume tailoring", category: "documents", description: "Prepare a job-specific draft from confirmed candidate facts." },
  { id: "cover_letter", name: "Cover letter", category: "documents", description: "Prepare a factual draft for an owned job description." },
  { id: "application_preparation", name: "Application preparation", category: "applications", description: "Assemble the exact documents, answers, and personal-data disclosure." },
  { id: "application_approval", name: "Application approval", category: "applications", description: "Bind explicit approval to an expiring immutable package snapshot." },
  { id: "application_execution", name: "Application execution", category: "applications", description: "Require supported access and current approval before any submission." },
  { id: "application_tracking", name: "Application tracking", category: "applications", description: "Track confirmed outcomes; unresolved submissions remain unconfirmed." },
  { id: "notification", name: "Notification", category: "notifications", description: "Send verified opt-in digests using the independent durable alert queue." },
  { id: "interview_preparation", name: "Interview preparation", category: "interviews", description: "Prepare role-specific questions and answer-based feedback." },
  { id: "career_coach", name: "Career coach", category: "career", description: "Turn confirmed goals and transferable skills into practical actions." },
  { id: "learning", name: "Learning", category: "career", description: "Count skill gaps in actual eligible job requirements and suggest evidence-based learning actions." },
  { id: "market_intelligence", name: "Market intelligence", category: "career", description: "Summarize bounded source evidence with dates and uncertainty." },
  { id: "networking", name: "Networking", category: "communications", description: "Prepare unsent outreach drafts using only your saved recruiter contacts." },
  { id: "follow_up", name: "Follow-up", category: "communications", description: "Prepare follow-up drafts; sending requires separate supported access." },
  { id: "cost_control", name: "Cost control", category: "security", description: "Review recorded usage and configured quotas; disclose costs that cannot be measured." },
  { id: "security_policy", name: "Security policy", category: "security", description: "Check ownership, pauses, knowledge boundaries, approvals, and integrations." },
] as const satisfies readonly { id: string; name: string; category: AgentCategory; description: string }[];
export type SpecialistAgentId = typeof SPECIALIST_AGENTS[number]["id"];
export type AgentId = SpecialistAgentId | "orchestrator";
export const ORCHESTRATOR = { id: "orchestrator", name: "Career orchestrator", category: "security", description: "Coordinate bounded specialist tasks under the user's current permissions." } as const;
export type KnowledgeClassification = "VERIFIED" | "AI_EXTRACTED" | "INFERRED" | "UNKNOWN";
export type AgentSettings = { mode: AgentMode; pausedAll: boolean; pausedCategories: AgentCategory[]; revision: number; vaultRevision: number; answersRevision: number; feedbackRevision: number; maxJobsPerRun: number; maxPackagesPerRun: number; schedule: { enabled: boolean; timeZone: string; runTime: string; nextRunAt: string | null; configured: boolean; status: string; reason: string } };
export type VaultFact = { key: string; label: string; value: string | null; classification: KnowledgeClassification; revision: number; source: string; confirmedAt: string | null; updatedAt: string };
export type ConfirmedAnswer = { key: string; question: string; value: string; classification: "VERIFIED" | "UNKNOWN"; revision: number; confirmedAt: string; validUntil: string; reconfirmAt: string; fresh: boolean };
export type SavedSearch = { id: string; label: string; goal: string; preferences: Preferences; enabled: boolean; resumeId: string | null; status: "active" | "paused" | "archived"; frequency: "daily" | "weekly" | "manual"; minExperience: number | null; maxExperience: number | null; mandatoryExperience: boolean; revision: number; createdAt: string; updatedAt: string };
export type PackageUnknown = { key: string; label: string; required: boolean; message: string };
export type PackageSnapshot = {
  job: { id: string; title: string; company: string; url: string; source: string; lastCheckedAt: string | null; postedAt: string | null; data: Record<string, unknown> };
  resume: { id: string; version: number; title: string; text: string } | null;
  tailoredResume: { sessionId: string; text: string } | null;
  coverLetter: { id: string | null; sessionId: string | null; version: number; text: string } | null;
  screeningAnswers: { key: string; question: string; value: string | null; classification: KnowledgeClassification; revision: number; validUntil?: string; reconfirmAt?: string }[];
  personalData: { field: string; value: string }[];
  facts: VaultFact[]; profileRevision: number; vaultRevision: number; answersRevision: number; settingsRevision: number; activeResumeId: string | null;
  search: SavedSearch | null; mode: AgentMode; pausedAll: boolean; pausedCategories: AgentCategory[];
};
export type ApplicationPackage = { id: string; label: string; jobId: string; resumeId: string | null; coverId: string | null; searchId: string | null; status: string; revision: number; snapshotHash: string; snapshot: PackageSnapshot; unknowns: PackageUnknown[]; approval: { status: string; expiresAt: string; snapshotHash: string } | null; createdAt: string; updatedAt: string };
export type AgentRun = { id: string; searchId: string | null; goal: string; status: AgentTaskStatus; settingsRevision: number; context: Record<string, unknown>; leaseToken: string | null; leaseUntil: string | null; summary: string; createdAt: string; updatedAt: string };
export type AgentTask = { id: string; runId: string; agentId: SpecialistAgentId; category: AgentCategory; taskKey: string; status: AgentTaskStatus; input: Record<string, unknown>; output: Record<string, unknown> | null; summary: string; createdAt: string; updatedAt: string };
export type AgentActivity = { id: string; agentId: AgentId; action: string; status: string; summary: string; runId: string | null; entityId: string | null; manifestHash: string; createdAt: string };
export type AgentCommandState = {
  settings: AgentSettings;
  agents: { id: AgentId; name: string; category: AgentCategory; description: string; status: string; lastActivityAt: string | null; completedTasks: number; pendingTasks: number; failedTasks: number; currentTask: string | null; nextRunAt: string | null; reason: string }[];
  runs: AgentRun[]; activity: AgentActivity[]; vault: VaultFact[]; vaultHistory: { id: string; key: string; data: Record<string, unknown>; createdAt: string }[];
  confirmedAnswers: ConfirmedAnswer[]; feedback: { id: string; jobId: string | null; reason: string; details: string; createdAt: string }[];
  savedSearches: SavedSearch[]; packages: ApplicationPackage[]; attention: { key: string; label: string; message: string; required: boolean }[];
  profile: Profile; preferences: Preferences; supportedJobChoices: { id: string; title: string; company: string; source: string; url: string }[];
  supportedResumeChoices: { id: string; title: string; version: number; archived: boolean }[];
  insights: { summary: string; limitation: string; sources: { title: string; url: string; checkedAt: string | null; source: string }[] } | null;
  followUpDrafts: { id: string; title: string; text: string; createdAt: string }[];
};
export type AgenticState = AgentCommandState;
export type PackageInput = { jobId: string; resumeId?: string | null; coverId?: string | null; coverLetterId?: string | null; tailoredSessionId?: string | null; coverLetterSessionId?: string | null; searchId?: string | null; screeningKeys?: string[]; screeningAnswerIds?: string[]; requiredFacts?: string[]; missingQuestions?: { key: string; question: string }[]; personalDataFields?: string[]; label?: string; coverLetterText?: string };

export function defaultAgentSettings(): AgentSettings { return { mode: "approval", pausedAll: false, pausedCategories: [], revision: 0, vaultRevision: 0, answersRevision: 0, feedbackRevision: 0, maxJobsPerRun: 10, maxPackagesPerRun: 3, schedule: { enabled: false, timeZone: "Asia/Kolkata", runTime: "07:30", nextRunAt: null, configured: false, status: "setup_required", reason: "Automatic runs require the authenticated private scheduler to be deployed and enabled." } }; }
export function integerRevision(value: unknown, required = true): number { if (required && value === undefined) throw new CareerError(400, "REVISION_REQUIRED", "Reload the current revision before changing this record."); const revision = number(value, "Revision", Number.MAX_SAFE_INTEGER); if (!Number.isSafeInteger(revision)) throw new CareerError(400, "INVALID_INPUT", "Revision must be an integer."); return revision; }
export function knowledgeKey(value: unknown): string { const key = string(value, "Fact key", 100, true); if (!/^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(key)) throw new CareerError(400, "INVALID_INPUT", "Use a simple field key."); return key; }
// Callers must first resolve the job through their owned store. This pure helper
// only creates a distinct, bounded screening-library key for that listing.
export function jobScreeningKey(value: unknown): string { const id = string(value, "Job identifier", 86, true); if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,85}$/.test(id)) throw new CareerError(400, "INVALID_INPUT", "Use a valid job identifier for screening answers."); return knowledgeKey(`job_screening.${id}`); }
export function validateAgentSettings(value: unknown) {
  const input = object(value); keys(input, ["mode", "pausedAll", "pausedCategories", "expectedRevision", "maxJobsPerRun", "maxPackagesPerRun", "schedule"]);
  if (!AGENT_MODES.includes(input.mode as AgentMode)) throw new CareerError(400, "INVALID_INPUT", "Choose assist, approval, or agentic mode.");
  const categories = strings(input.pausedCategories, "Paused categories", AGENT_CATEGORIES.length); if (categories.some(c => !AGENT_CATEGORIES.includes(c as AgentCategory))) throw new CareerError(400, "INVALID_INPUT", "Choose a supported pause category.");
  const maxJobsPerRun = number(input.maxJobsPerRun ?? 10, "Jobs per run", 25); const maxPackagesPerRun = number(input.maxPackagesPerRun ?? 3, "Packages per run", 3);
  if (!Number.isInteger(maxJobsPerRun) || maxJobsPerRun < 1 || !Number.isInteger(maxPackagesPerRun) || maxPackagesPerRun < 1) throw new CareerError(400, "INVALID_INPUT", "Run limits must be positive integers.");
  const schedule = object(input.schedule ?? { enabled: false, timeZone: "Asia/Kolkata", runTime: "07:30" }); keys(schedule, ["enabled", "timeZone", "runTime"]);
  const timeZone = string(schedule.timeZone ?? "Asia/Kolkata", "Time zone", 100, true); try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw new CareerError(400, "INVALID_INPUT", "Select a valid time zone."); }
  const runTime = string(schedule.runTime ?? "07:30", "Run time", 5, true); if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(runTime)) throw new CareerError(400, "INVALID_INPUT", "Choose a local run time in HH:mm format.");
  return { mode: input.mode as AgentMode, pausedAll: boolean(input.pausedAll), pausedCategories: categories as AgentCategory[], expectedRevision: integerRevision(input.expectedRevision), maxJobsPerRun, maxPackagesPerRun, schedule: { enabled: boolean(schedule.enabled), timeZone, runTime } };
}
/** Freshness is an upper bound, not a claim that a fact remains true for this duration. */
export function answerFreshnessDays(key: string, question: string) { const hint = `${key} ${question}`.toLowerCase(); if (/availab|joining|join date|start date|start work|earliest.*start/.test(hint)) return 7; if (/salary|compensation|notice|authori[sz]ation|sponsor|relocat|travel|shift|current.*(role|company|employ)|visa|work permit/.test(hint)) return 30; return 90; }
export function scheduleRunDate(now: string, timeZone: string, runTime: string): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now)), get = (key: string) => parts.find(p => p.type === key)?.value ?? ""; const localDate = `${get("year")}-${get("month")}-${get("day")}`, minute = Number(get("hour")) * 60 + Number(get("minute")), target = Number(runTime.slice(0, 2)) * 60 + Number(runTime.slice(3)); return minute < target && (minute - target + 1440) % 1440 < 60 ? new Date(Date.parse(`${localDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : localDate; }
export function answerValidity(key: string, question: string, confirmedAt: string, validUntil?: unknown, reconfirmAt?: unknown) {
  const max = Date.parse(confirmedAt) + answerFreshnessDays(key, question) * 86_400_000;
  function date(value: unknown, fallback: number) { if (value === undefined || value === null || value === "") return new Date(fallback).toISOString(); const text = string(value, "Answer validity", 40, true), calendar = Date.parse(`${text.slice(0, 10)}T00:00:00Z`); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text)) || !Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== text.slice(0, 10) || text.slice(11, 13) === "24") throw new CareerError(400, "INVALID_INPUT", "Use a valid date and time with its time zone."); return new Date(text).toISOString(); }
  const until = date(validUntil, max), recheck = date(reconfirmAt, Date.parse(until));
  if (Date.parse(until) > max || Date.parse(until) <= Date.parse(confirmedAt) || Date.parse(recheck) > Date.parse(until) || Date.parse(recheck) <= Date.parse(confirmedAt)) throw new CareerError(400, "INVALID_INPUT", "Validity must be future dated, within the server freshness limit; reconfirmation cannot follow expiry.");
  return { validUntil: until, reconfirmAt: recheck };
}
export function assertAgentAllowed(settings: AgentSettings, category?: AgentCategory) { if (settings.pausedAll || (category && settings.pausedCategories.includes(category))) throw new CareerError(409, "AGENTS_PAUSED", "This work is paused. Resume it explicitly before continuing."); }
export function canonicalJSON(value: unknown): string { function canonical(v: unknown): unknown { if (v === null || typeof v === "string" || typeof v === "boolean") return v; if (typeof v === "number" && Number.isFinite(v)) return v; if (Array.isArray(v)) return v.map(canonical); if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])); throw new CareerError(400, "INVALID_INPUT", "Unsupported snapshot data."); } return JSON.stringify(canonical(value)); }
export async function snapshotHash(value: unknown): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJSON(value))))].map(x => x.toString(16).padStart(2, "0")).join(""); }
export function isInterviewTransition(before: string, after: string) { return before === after || (["interview_questions", "interview_feedback"].includes(before) && ["interview_questions", "interview_feedback"].includes(after)); }
