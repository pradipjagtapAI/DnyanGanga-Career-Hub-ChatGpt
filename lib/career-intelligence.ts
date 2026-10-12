/** Local evidence tools. These functions never verify facts, edit documents,
 * retrieve contacts, send messages, or invoke a provider. */
import type { ManualJob, Profile } from "./career-core";
import type { CareerAIEnv } from "./career-ai";

type Fact = { key: string; value: string | null; classification: string };
export type ResumeFactFlag = { id: string; category: "dates" | "experience" | "duplicate" | "achievement" | "employer" | "education" | "certification"; excerpt: string; message: string; confidence: "review-indicator"; evidenceBasis: string };
const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const hasNumber = /\b\d+(?:[.,]\d+)?\s*(?:%|percent|years?|months?|million|billion|crore|lakh|x\b)|[$₹€£]\s*\d|\b(?:increased|reduced|saved|improved|generated|delivered)\b[^\n]{0,70}\d/i;

/** Flags are questions, not a determination that the candidate's claims are false.
 * Only an exact, explicitly VERIFIED claim supports a numerical achievement. */
export function analyzeResumeFacts(text: string, confirmedProfile: Profile, vaultFacts: Fact[], now = new Date()) {
  const lines = text.slice(0, 60000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const flags: ResumeFactFlag[] = []; const seen = new Set<string>();
  const add = (category: ResumeFactFlag["category"], excerpt: string, message: string, evidenceBasis: string) => {
    if (flags.length < 60) flags.push({ id: `fact-review-${flags.length + 1}`, category, excerpt: excerpt.slice(0, 500), message, confidence: "review-indicator", evidenceBasis });
  };
  const verified = vaultFacts.filter(f => f.classification === "VERIFIED" && f.value).flatMap(f => f.value!.split(/\r?\n/).map(normalized));
  const claimSupported = (line: string) => verified.includes(normalized(line));
  const totalExperienceConfirmed = confirmedProfile.totalExperience > 0 || vaultFacts.some(f => f.key === "profile.totalExperience" && f.classification === "VERIFIED" && f.value !== null && Number(f.value) === confirmedProfile.totalExperience);
  let section: "work" | "education" | "certification" | null = null;
  const currentYear = now.getUTCFullYear();
  for (const line of lines) {
    if (/^(?:work history|work experience|professional experience|employment|experience)\s*:?(?:\s*)$/i.test(line)) section = "work";
    else if (/^(?:education|qualifications|academic background)\s*:?(?:\s*)$/i.test(line)) section = "education";
    else if (/^(?:certifications?|licenses?|credentials)\s*:?(?:\s*)$/i.test(line)) section = "certification";
    else if (/^(?:skills|projects|summary|profile|awards|interests)\s*:?(?:\s*)$/i.test(line)) section = null;
    const key = normalized(line);
    if (key.length >= 25 && seen.has(key)) add("duplicate", line, "This exact line appears more than once. Review whether the repetition is intentional.", "Exact normalized line equality; it does not establish a duplicate employment record.");
    seen.add(key);
    const range = line.match(/\b((?:19|20)\d{2})\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|present|current)\b/i);
    if (range) {
      const start = Number(range[1]), end = /present|current/i.test(range[2]) ? currentYear : Number(range[2]);
      if (end < start) add("dates", line, "The written end year precedes the start year. Confirm the source dates before changing them.", `Parsed year range ${start}–${end}; months and dates are not inferred.`);
      if (start > currentYear || end > currentYear) add("dates", line, "A written year is in the future. It may be planned study or another legitimate future event; confirm its meaning.", `Compared explicit years with ${currentYear}; this is not an authenticity check.`);
    }
    const duration = line.match(/\b(\d+(?:\.\d+)?)\+?\s+years?\s+(?:of\s+)?(?:total\s+|relevant\s+|professional\s+)?experience\b/i);
    if (duration && totalExperienceConfirmed && Number(duration[1]) > confirmedProfile.totalExperience)
      add("experience", line, "This stated duration exceeds the confirmed total-experience field. Confirm whether these figures use the same definition and date.", `Resume states ${duration[1]} years; confirmed profile field states ${confirmedProfile.totalExperience}. Overlapping roles are not added together.`);
    if (hasNumber.test(line) && !claimSupported(line)) add("achievement", line, "This numerical claim has no exact VERIFIED statement in the knowledge vault. Confirm its evidence before using it in an application.", "Exact line compared with VERIFIED vault values; absence of evidence does not mean the claim is false.");
    if (section === "work" && /\b(?:employer|company|worked at|employed by)\s*[:\-]?\s+\S/i.test(line) && !claimSupported(line))
      add("employer", line, "Confirm the employer's written name and employment record; this tool has not checked a company registry.", "Employer-labelled line lacks an exact VERIFIED vault statement. No external company lookup was performed.");
    if (section === "education" && /\b(?:university|college|school|degree|bachelor|master|diploma|phd|b\.tech|m\.tech)\b/i.test(line) && !claimSupported(line))
      add("education", line, "Confirm the institution, qualification and written dates against your records.", "Education-labelled section, compared with exact VERIFIED statements. No institution verification was performed.");
    if (section === "certification" && line.length > 12 && !/^(?:certifications?|licenses?|credentials)\s*:?(?:\s*)$/i.test(line) && !claimSupported(line))
      add("certification", line, "Confirm the exact certification name, issuer and dates. This tool has not validated the credential.", "Certification section lacks an exact VERIFIED statement. No issuer verification was performed.");
  }
  return { flags, reviewedAt: now.toISOString(), linesReviewed: lines.length, truncated: text.length > 60000, changedFacts: false, changedDocument: false, limitation: "Local consistency indicators only. Year ranges lack month precision. Employers, qualifications and achievements require your records; absence of evidence is not evidence of falsity." };
}

export function buildLearningPlan(rows: { job: ManualJob & { id: string; source?: string; lastCheckedAt?: string | null }; missingSkills: string[] }[], now = new Date()) {
  const gaps = new Map<string, { skill: string; jobIds: string[]; sources: { jobId: string; url: string | null; checkedAt: string | null }[] }>();
  for (const { job, missingSkills } of rows) {
    // Only structured employer requirements establish repeated required skills.
    for (const skill of new Set(missingSkills.filter(s => job.requirements.some(r => normalized(r) === normalized(s))))) {
      const key = normalized(skill), item = gaps.get(key) ?? { skill, jobIds: [], sources: [] };
      if (!item.jobIds.includes(job.id)) { item.jobIds.push(job.id); item.sources.push({ jobId: job.id, url: job.url, checkedAt: job.lastCheckedAt ?? null }); } gaps.set(key, item);
    }
  }
  const requirements = [...gaps.values()].sort((a, b) => b.jobIds.length - a.jobIds.length || a.skill.localeCompare(b.skill)).slice(0, 20);
  return { asOf: now.toISOString(), sampleSize: new Set(rows.map(r => r.job.id)).size, requirements: requirements.map(item => ({ ...item, occurrences: item.jobIds.length, suggestedActions: [`Learn the fundamentals of ${item.skill}.`, `Build a small project using ${item.skill} and keep evidence of your work.`, "Add the skill to your confirmed profile only after gaining and reviewing actual experience."], status: "suggested" })), limitation: "Counts describe distinct owned eligible listings with structured requirements, including user-imported descriptions. They are not market-wide demand estimates. No skill has been added to your profile." };
}

export type OwnedRecruiter = { id: string; name?: string; company?: string; email?: string; role?: string; notes?: string; nextFollowUpAt?: string | null; lastInteractionAt?: string | null };
export function buildNetworkingDrafts(contacts: OwnedRecruiter[], targetRoles: string[], now = new Date()) {
  return { asOf: now.toISOString(), contactsReviewed: contacts.length, drafts: contacts.slice(0, 10).map(contact => ({ contactId: contact.id, title: `Introduction for ${contact.name || "saved recruiter"}`, recipient: contact.email || null, text: `Hello${contact.name ? ` ${contact.name}` : ""}, I am exploring ${targetRoles.length ? targetRoles.join(" or ") : "my next career opportunity"}${contact.company ? ` and would value information about opportunities at ${contact.company}` : ""}. Could you let me know the best way to share my experience for your review? Thank you.`, status: "draft_unsent", approvalRequired: true })), sent: 0, sendingSupported: false, limitation: "Uses only your saved recruiter contacts. No contacts were discovered, inferred, enriched, or messaged; employer communication integration is unavailable." };
}

export type AgentModelEnv = CareerAIEnv & { AI_TASK_ROUTES_JSON?: string };
/** A server-controlled task route cannot override the global model allowlist,
 * data policy, credentials or spending caps enforced by generateCareerAI. */
export function resolveAgentModel(agentId: string, env: AgentModelEnv) {
  const unavailable = (reason: string) => ({ status: "not-connected" as const, provider: null, model: null, reason, env: { ...env, AI_ENABLED: "false" } });
  if (!env.AI_TASK_ROUTES_JSON) return unavailable("No approved server-side model route is configured for this task. Local evidence tools remain available.");
  try {
    const routes: unknown = JSON.parse(env.AI_TASK_ROUTES_JSON);
    if (!routes || typeof routes !== "object" || Array.isArray(routes)) return unavailable("Model route policy is invalid.");
    const route = (routes as Record<string, unknown>)[agentId];
    if (!route || typeof route !== "object" || Array.isArray(route)) return unavailable("This task has no approved model route.");
    const r = route as Record<string, unknown>;
    if (Object.keys(r).some(k => !["provider", "model"].includes(k)) || r.provider !== "openai" || typeof r.model !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(r.model)) return unavailable("The route requires an unsupported provider or invalid model policy. Configure a maintained adapter before enabling it.");
    if (!(env.AI_ALLOWED_MODELS ?? "").split(",").map(m => m.trim()).includes(r.model)) return unavailable("The task model is absent from the global approved model allowlist.");
    return { status: "configured" as const, provider: "openai" as const, model: r.model, reason: "Approved task route is present; provider credentials, data policy and quotas are checked separately before each request.", env: { ...env, AI_PROVIDER: "openai", AI_MODEL: r.model } };
  } catch { return unavailable("Model route policy is invalid JSON."); }
}
