/** Pure, testable policy. Content is data, never executable instructions. */
export class CareerError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}
export const APPLICATION_STATUSES = ["Saved", "Preparing", "Needs Review", "Needs Your Input", "Submission Unconfirmed", "Applied", "Interview", "Offer", "Rejected", "Withdrawn", "Closed"] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];
export const ARRANGEMENTS = ["Remote", "Hybrid", "On-site"] as const;
export const INTEGRATIONS = {
  jobs: { status: "not-connected", reason: "Naukri and Indeed require approved or licensed access. Manual job descriptions are available." },
  ai: { status: "not-connected", reason: "No AI provider, usage budget, or approved data-processing policy is configured." },
  documents: { status: "disabled", reason: "PDF/DOCX upload is disabled until private storage, malware scanning, and isolated conversion are connected. Text resumes can be edited and versioned." },
  email: { status: "not-connected", reason: "A verified sender, verified destination, provider callbacks, and a durable queue are required." },
  whatsapp: { status: "not-connected", reason: "Official provider access, an approved template, destination verification, and a durable queue are required." },
  billing: { status: "disabled", reason: "Prices and payment provider credentials are not configured. No checkout or paid entitlement is active." },
  admin: { status: "disabled", reason: "No trusted administrator role and fresh MFA attestation are configured." },
  sharing: { status: "disabled", reason: "Profiles and resumes are private. Revocable, expiring sharing tokens are not enabled." },
  accountDeletion: { status: "disabled", reason: "Account deletion requires recent sign-in verification. The hosting identity service has not supplied a trusted step-up authentication attestation." },
} as const;
export function disabledFeatureForPath(resource: string, method: string) {
  const gated = { upload: "documents", ai: "ai", payment: "billing", send: "email", share: "sharing", admin: "admin" } as const;
  if (resource === "account" && method === "DELETE") return INTEGRATIONS.accountDeletion;
  if (Object.hasOwn(gated, resource)) return INTEGRATIONS[gated[resource as keyof typeof gated]];
  return null;
}

export type Profile = {
  fullName: string; headline: string; email: string; phone: string; whatsapp: string;
  currentCity: string; state: string; country: string; summary: string; workHistory: string;
  education: string; projects: string; certifications: string; skills: string[]; portfolio: string;
  currentRole: string; totalExperience: number; relevantExperience: number;
};
export type Preferences = {
  targetRoles: string[]; industries: string[]; preferredCities: string[]; relocate: boolean;
  workArrangements: string[]; employmentTypes: string[]; salaryAmount: number | null;
  expectedSalaryMin: number | null; expectedSalaryMax: number | null; mandatorySalary: boolean;
  salaryCurrency: string; salaryBasis: "annual" | "monthly"; noticePeriod: string;
  excludeCompanies: string[]; excludeRoles: string[]; excludeLocations: string[];
  mandatoryLocation: boolean; mandatoryWorkArrangement: boolean; mandatoryEmploymentType: boolean;
};
export type NotificationSettings = {
  emailEnabled: boolean; whatsappEnabled: boolean; emailConsent: boolean; whatsappConsent: boolean;
  timeZone: string; dispatchTime: string; paused: boolean; consentRecordedAt: string | null;
  emailConsentRecordedAt: string | null; whatsappConsentRecordedAt: string | null;
  emailVerified: boolean; whatsappVerified: boolean; nextAlert: string | null;
  maxJobsPerDigest: number;
};
export type ManualJob = {
  title: string; company: string; location: string | null; workArrangement: string | null; employmentType: string | null;
  minExperience: number | null; maxExperience: number | null; salary: string; requirements: string[];
  salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null; salaryBasis: "annual" | "monthly" | null;
  industry?: string | null; seniority?: string | null; responsibilities?: string[];
  description: string; url: string; postedAt: string | null; closed: boolean;
};

export function defaultProfile(email = "", fullName = ""): Profile {
  return { fullName, email, headline: "", phone: "", whatsapp: "", currentCity: "", state: "", country: "India", summary: "", workHistory: "", education: "", projects: "", certifications: "", skills: [], portfolio: "", currentRole: "", totalExperience: 0, relevantExperience: 0 };
}
export function defaultPreferences(): Preferences {
  return { targetRoles: [], industries: [], preferredCities: [], relocate: false, workArrangements: [], employmentTypes: [], salaryAmount: null, expectedSalaryMin: null, expectedSalaryMax: null, mandatorySalary: false, salaryCurrency: "INR", salaryBasis: "annual", noticePeriod: "", excludeCompanies: [], excludeRoles: [], excludeLocations: [], mandatoryLocation: true, mandatoryWorkArrangement: true, mandatoryEmploymentType: true };
}
export function defaultNotifications(): NotificationSettings {
  return { emailEnabled: false, whatsappEnabled: false, emailConsent: false, whatsappConsent: false, timeZone: "Asia/Kolkata", dispatchTime: "08:00", paused: true, consentRecordedAt: null, emailConsentRecordedAt: null, whatsappConsentRecordedAt: null, emailVerified: false, whatsappVerified: false, nextAlert: null, maxJobsPerDigest: 5 };
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CareerError(400, "INVALID_INPUT", "Provide a JSON object.");
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new CareerError(400, "INVALID_FIELD", "An unsupported field was supplied.");
}
export function string(value: unknown, label: string, max = 200, required = false): string {
  if (value === undefined || value === null) { if (required) throw new CareerError(400, "INVALID_INPUT", `${label} is required.`); return ""; }
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new CareerError(400, "INVALID_INPUT", `${label} is invalid or too long.`);
  const output = value.trim();
  if (required && !output) throw new CareerError(400, "INVALID_INPUT", `${label} is required.`);
  return output;
}
export function strings(value: unknown, label: string, maxItems = 50): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new CareerError(400, "INVALID_INPUT", `${label} must be a short list.`);
  return [...new Set(value.map((item) => string(item, label, 120, true)))];
}
export function boolean(value: unknown, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new CareerError(400, "INVALID_INPUT", "A true or false value is required.");
  return value;
}
export function number(value: unknown, label: string, max = 70): number {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new CareerError(400, "INVALID_INPUT", `${label} is outside the supported range.`);
  return value;
}
export function safePublicLink(value: unknown): string {
  const link = string(value, "Link", 2048);
  if (!link) return "";
  let url: URL;
  try { url = new URL(link); } catch { throw new CareerError(400, "INVALID_LINK", "Provide a complete HTTPS link."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":")) throw new CareerError(400, "INVALID_LINK", "Only public HTTPS links without credentials are allowed.");
  return url.toString(); // Stored only. The server never fetches user links.
}
export function validateProfile(value: unknown, identityEmail: string): Profile {
  const input = object(value); keys(input, Object.keys(defaultProfile()));
  if (input.email !== undefined && input.email !== identityEmail) throw new CareerError(400, "IDENTITY_READ_ONLY", "The sign-in email is managed by your identity provider.");
  const output = defaultProfile(identityEmail);
  for (const key of ["fullName", "headline", "currentCity", "state", "country", "currentRole"] as const) output[key] = string(input[key], key, 160);
  for (const key of ["summary", "workHistory", "education", "projects", "certifications"] as const) output[key] = string(input[key], key, 10000);
  for (const key of ["phone", "whatsapp"] as const) {
    output[key] = string(input[key], key, 30);
    if (output[key] && !/^\+[1-9][\d ()-]{6,25}$/.test(output[key])) throw new CareerError(400, "INVALID_PHONE", "Phone numbers must include a country code, for example +91.");
  }
  output.portfolio = safePublicLink(input.portfolio);
  output.skills = strings(input.skills, "Skills");
  output.totalExperience = number(input.totalExperience, "Total experience");
  output.relevantExperience = number(input.relevantExperience, "Relevant experience");
  if (output.relevantExperience > output.totalExperience) throw new CareerError(400, "INVALID_EXPERIENCE", "Relevant experience cannot exceed total experience.");
  return output;
}
export function validatePreferences(value: unknown): Preferences {
  const input = object(value); const output = defaultPreferences(); keys(input, Object.keys(output));
  for (const key of ["targetRoles", "industries", "preferredCities", "employmentTypes", "excludeCompanies", "excludeRoles", "excludeLocations"] as const) output[key] = strings(input[key], key, 15);
  output.workArrangements = strings(input.workArrangements, "Work arrangements", 3);
  if (output.workArrangements.some((x) => !(ARRANGEMENTS as readonly string[]).includes(x))) throw new CareerError(400, "INVALID_INPUT", "Choose Remote, Hybrid, or On-site.");
  for (const key of ["relocate", "mandatoryLocation", "mandatoryWorkArrangement", "mandatoryEmploymentType", "mandatorySalary"] as const) output[key] = boolean(input[key], output[key]);
  output.salaryAmount = input.salaryAmount === undefined || input.salaryAmount === null ? null : number(input.salaryAmount, "Expected salary", 1_000_000_000);
  output.expectedSalaryMin = input.expectedSalaryMin == null ? output.salaryAmount : number(input.expectedSalaryMin, "Minimum expected salary", 1_000_000_000);
  output.expectedSalaryMax = input.expectedSalaryMax == null ? null : number(input.expectedSalaryMax, "Maximum expected salary", 1_000_000_000);
  if (output.expectedSalaryMin !== null && output.expectedSalaryMax !== null && output.expectedSalaryMax < output.expectedSalaryMin) throw new CareerError(400, "INVALID_SALARY", "Maximum expected salary cannot be less than minimum expected salary.");
  if (output.mandatorySalary && output.expectedSalaryMin === null && output.expectedSalaryMax === null) throw new CareerError(400, "INVALID_SALARY", "Set an expected salary range before making salary mandatory.");
  output.salaryCurrency = string(input.salaryCurrency ?? "INR", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(output.salaryCurrency)) throw new CareerError(400, "INVALID_INPUT", "Use a three-letter currency code.");
  if (input.salaryBasis !== undefined && input.salaryBasis !== "annual" && input.salaryBasis !== "monthly") throw new CareerError(400, "INVALID_INPUT", "Salary basis must be annual or monthly.");
  output.salaryBasis = (input.salaryBasis as "annual" | "monthly" | undefined) ?? "annual";
  output.noticePeriod = string(input.noticePeriod, "Availability", 200);
  return output;
}
export function validateNotifications(value: unknown, previous: NotificationSettings, now: string, capabilities = { email: false, whatsapp: false }): NotificationSettings {
  const input = object(value); keys(input, ["emailEnabled", "whatsappEnabled", "emailConsent", "whatsappConsent", "timeZone", "dispatchTime", "paused", "maxJobsPerDigest"]);
  const timeZone = string(input.timeZone ?? previous.timeZone, "Time zone", 100, true);
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw new CareerError(400, "INVALID_TIMEZONE", "Choose a valid IANA time zone."); }
  const dispatchTime = string(input.dispatchTime ?? previous.dispatchTime, "Dispatch time", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dispatchTime)) throw new CareerError(400, "INVALID_TIME", "Use a time from 00:00 to 23:59.");
  const emailConsent = boolean(input.emailConsent, previous.emailConsent);
  const whatsappConsent = boolean(input.whatsappConsent, previous.whatsappConsent);
  const emailEnabled = boolean(input.emailEnabled, previous.emailEnabled) && emailConsent;
  const whatsappEnabled = boolean(input.whatsappEnabled, previous.whatsappEnabled) && whatsappConsent;
  if ((emailEnabled && !capabilities.email) || (whatsappEnabled && !capabilities.whatsapp)) throw new CareerError(503, "PROVIDER_UNAVAILABLE", "Delivery requires a configured provider and a verified destination for each enabled channel.");
  const maxJobsPerDigest = number(input.maxJobsPerDigest ?? previous.maxJobsPerDigest ?? 5, "Digest size", 10);
  if (!Number.isInteger(maxJobsPerDigest) || maxJobsPerDigest < 1) throw new CareerError(400, "INVALID_INPUT", "Digest size must be an integer from 1 to 10.");
  return { ...previous, emailEnabled, whatsappEnabled, emailConsent, whatsappConsent, timeZone, dispatchTime, paused: boolean(input.paused, previous.paused), consentRecordedAt: input.emailConsent !== undefined || input.whatsappConsent !== undefined ? now : previous.consentRecordedAt, emailConsentRecordedAt: input.emailConsent !== undefined ? now : previous.emailConsentRecordedAt ?? null, whatsappConsentRecordedAt: input.whatsappConsent !== undefined ? now : previous.whatsappConsentRecordedAt ?? null, nextAlert: null, maxJobsPerDigest };
}
export function validateResume(value: unknown) {
  const input = object(value); keys(input, ["title", "targetRole", "text", "source"]);
  if (input.source && input.source !== "manual") throw new CareerError(400, "INVALID_SOURCE", "An AI-assisted or uploaded provenance cannot be claimed for a manual revision.");
  return { title: string(input.title, "Resume title", 160, true), targetRole: string(input.targetRole, "Target role", 160), text: string(input.text, "Resume text", 60000, true), source: "manual" };
}
export function validateJob(value: unknown): ManualJob {
  const input = object(value); keys(input, ["title", "company", "location", "workArrangement", "employmentType", "minExperience", "maxExperience", "salary", "salaryMin", "salaryMax", "salaryCurrency", "salaryBasis", "industry", "seniority", "responsibilities", "requirements", "description", "url", "postedAt", "closed"]);
  const workArrangement = string(input.workArrangement, "Work arrangement", 20) || null;
  if (workArrangement && !(ARRANGEMENTS as readonly string[]).includes(workArrangement)) throw new CareerError(400, "INVALID_INPUT", "Choose Remote, Hybrid, or On-site.");
  const minExperience = input.minExperience == null ? null : number(input.minExperience, "Required experience");
  const maxExperience = input.maxExperience === undefined || input.maxExperience === null ? null : number(input.maxExperience, "Maximum experience");
  if (maxExperience !== null && minExperience !== null && maxExperience < minExperience) throw new CareerError(400, "INVALID_INPUT", "Maximum experience cannot be less than minimum experience.");
  const postedAt = input.postedAt ? string(input.postedAt, "Posting date", 10) : null;
  if (postedAt && !/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) throw new CareerError(400, "INVALID_INPUT", "Use an ISO posting date.");
  if (postedAt && (!Number.isFinite(Date.parse(postedAt)) || new Date(postedAt).toISOString().slice(0, 10) !== postedAt)) throw new CareerError(400, "INVALID_INPUT", "Provide a real posting date.");
  const salaryMin = input.salaryMin == null ? null : number(input.salaryMin, "Minimum salary", 1_000_000_000);
  const salaryMax = input.salaryMax == null ? null : number(input.salaryMax, "Maximum salary", 1_000_000_000);
  const salaryCurrency = string(input.salaryCurrency, "Salary currency", 3).toUpperCase() || null;
  const salaryBasis = input.salaryBasis == null || input.salaryBasis === "" ? null : input.salaryBasis;
  if (salaryCurrency && !/^[A-Z]{3}$/.test(salaryCurrency)) throw new CareerError(400, "INVALID_SALARY", "Use a three-letter salary currency.");
  if (salaryBasis !== null && salaryBasis !== "annual" && salaryBasis !== "monthly") throw new CareerError(400, "INVALID_SALARY", "Salary basis must be monthly or annual.");
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) throw new CareerError(400, "INVALID_SALARY", "Maximum salary cannot be less than minimum salary.");
  if ((salaryMin !== null || salaryMax !== null) && (!salaryCurrency || !salaryBasis)) throw new CareerError(400, "INVALID_SALARY", "A numeric salary needs its currency and monthly or annual basis.");
  return { title: string(input.title, "Job title", 200, true), company: string(input.company, "Company", 200, true), location: string(input.location, "Location", 200) || null, workArrangement, employmentType: string(input.employmentType, "Employment type", 80) || null, minExperience, maxExperience, salary: string(input.salary, "Salary", 200), salaryMin, salaryMax, salaryCurrency, salaryBasis, industry: string(input.industry, "Industry", 160) || null, seniority: string(input.seniority, "Seniority", 100) || null, responsibilities: strings(input.responsibilities, "Responsibilities", 30), requirements: strings(input.requirements, "Requirements", 50), description: string(input.description, "Job description", 30000), url: safePublicLink(input.url), postedAt, closed: boolean(input.closed) };
}
export function validateApplication(value: unknown, previousStatus?: string) {
  const input = object(value); keys(input, ["jobId", "status", "notes", "reminderAt", "resumeId", "confirmedApplied"]);
  const status = string(input.status, "Application status", 20, true) as ApplicationStatus;
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new CareerError(400, "INVALID_INPUT", "Choose a supported application status.");
  if (status === "Applied" && previousStatus !== "Applied" && input.confirmedApplied !== true) throw new CareerError(400, "CONFIRM_APPLICATION", "Confirm that you submitted this application before marking it Applied.");
  const reminderAt = input.reminderAt ? string(input.reminderAt, "Reminder date", 40) : null;
  if (reminderAt && !Number.isFinite(Date.parse(reminderAt))) throw new CareerError(400, "INVALID_INPUT", "Provide a valid reminder date.");
  return { jobId: string(input.jobId, "Job ID", 80), status, notes: string(input.notes, "Notes", 5000), reminderAt, resumeId: input.resumeId ? string(input.resumeId, "Resume ID", 80) : null };
}
export function assertSameOrigin(request: Request) {
  let origin: string;
  try { origin = new URL(request.url).origin; } catch { throw new CareerError(400, "INVALID_REQUEST", "Invalid request."); }
  if (request.headers.get("origin") !== origin || request.headers.get("x-career-action") !== "1" || ["cross-site", "none"].includes(request.headers.get("sec-fetch-site") ?? "")) throw new CareerError(403, "ORIGIN_REJECTED", "This action must be requested from this website.");
}
export function assertMutationRequest(request: Request) {
  assertSameOrigin(request);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new CareerError(415, "JSON_REQUIRED", "Use a JSON request.");
}
export async function readJsonBounded(request: Request, max = 100_000): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) throw new CareerError(413, "TOO_LARGE", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new CareerError(400, "INVALID_JSON", "Provide a JSON request body.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > max) { await reader.cancel(); throw new CareerError(413, "TOO_LARGE", "The request is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); }
  catch (error) { if (error instanceof CareerError) throw error; throw new CareerError(400, "INVALID_JSON", "The request body is not valid JSON."); }
}
const normalize = (value: string | null | undefined) => (value ?? "").toLocaleLowerCase("en").trim().replace(/\s+/g, " ");
const matchesAny = (value: string | null, terms: string[]) => terms.some((term) => normalize(value).split(/[,;/]/).map((x) => x.trim()).includes(normalize(term)));
const containsAny = (value: string | null, terms: string[]) => terms.some((term) => normalize(value).includes(normalize(term)));
const EQUIVALENT_SKILLS = [["js", "javascript"], ["ts", "typescript"], ["postgres", "postgresql"], ["hr", "human resources"], ["gd&t", "geometric dimensioning and tolerancing"]];
const RELATED_SKILLS = [["react", "vue", "angular"], ["python", "javascript", "java", "c#"], ["catia", "solidworks", "nx"], ["postgresql", "mysql", "sqlite"]];
export function compareSalary(job: ManualJob, preferences: Preferences) {
  const low = preferences.expectedSalaryMin ?? preferences.salaryAmount ?? null;
  const high = preferences.expectedSalaryMax ?? null;
  if (low === null && high === null) return { status: "not-requested", reason: "No salary range configured" };
  if ((job.salaryMin == null && job.salaryMax == null) || !job.salaryCurrency || !job.salaryBasis) return { status: "unknown", reason: "Listing has no comparable numeric salary" };
  if (job.salaryCurrency !== preferences.salaryCurrency) return { status: "unknown", reason: "Salary currencies differ; no exchange-rate assumptions are used" };
  const factor = job.salaryBasis === preferences.salaryBasis ? 1 : job.salaryBasis === "monthly" ? 12 : 1 / 12;
  const jobLow = job.salaryMin == null ? null : job.salaryMin * factor;
  const jobHigh = job.salaryMax == null ? null : job.salaryMax * factor;
  if ((low !== null && jobHigh === null) || (high !== null && jobLow === null)) return { status: "unknown", reason: "Salary range is incomplete for the requested bounds" };
  const overlaps = (low === null || jobHigh! >= low) && (high === null || jobLow! <= high);
  return { status: overlaps ? "overlap" : "outside", reason: `Ranges ${overlaps ? "overlap" : "do not overlap"} in ${preferences.salaryCurrency} per ${preferences.salaryBasis}; monthly/annual conversion uses 12 months` };
}
export function matchJob(job: ManualJob, profile: Profile, preferences: Preferences, activeResumeText?: string) {
  const excludedReasons: string[] = [];
  const cities = preferences.preferredCities.length ? preferences.preferredCities : profile.currentCity ? [profile.currentCity] : [];
  if (job.closed) excludedReasons.push("Marked closed");
  if (preferences.mandatoryLocation && cities.length && !matchesAny(job.location, cities)) excludedReasons.push("Outside mandatory locations");
  if (preferences.mandatoryWorkArrangement && preferences.workArrangements.length && (!job.workArrangement || !preferences.workArrangements.includes(job.workArrangement))) excludedReasons.push("Outside mandatory work arrangements");
  if (preferences.mandatoryEmploymentType && preferences.employmentTypes.length && !matchesAny(job.employmentType, preferences.employmentTypes)) excludedReasons.push("Outside mandatory employment types");
  if (containsAny(job.company, preferences.excludeCompanies)) excludedReasons.push("Excluded company");
  if (containsAny(job.title, preferences.excludeRoles)) excludedReasons.push("Excluded role");
  if (containsAny(job.location, preferences.excludeLocations)) excludedReasons.push("Excluded location");
  const salaryComparison = compareSalary(job, preferences);
  if (preferences.mandatorySalary && !["overlap", "not-requested"].includes(salaryComparison.status)) excludedReasons.push(salaryComparison.status === "unknown" ? "Mandatory salary cannot be verified" : "Outside mandatory salary range");
  const confirmed = profile.skills.filter((skill) => activeResumeText === undefined || resumeContainsSkill(activeResumeText, skill));
  const matchedSkills: string[] = [], missingSkills: string[] = [], relatedSkills: string[] = [];
  const skillEvidence: {requirement: string; candidateSkill: string; kind: string; explanation: string}[] = [];
  for (const requirement of job.requirements) {
    const exact = confirmed.find((skill) => normalize(skill) === normalize(requirement));
    const equivalent = confirmed.find((skill) => EQUIVALENT_SKILLS.some((group) => group.includes(normalize(skill)) && group.includes(normalize(requirement))));
    const related = confirmed.find((skill) => RELATED_SKILLS.some((group) => group.includes(normalize(skill)) && group.includes(normalize(requirement))));
    if (exact || equivalent) { matchedSkills.push(requirement); skillEvidence.push({ requirement, candidateSkill: exact ?? equivalent!, kind: exact ? "exact" : "equivalent-term", explanation: exact ? "Confirmed profile skill matches the listed requirement" : "Explicit terminology alias; verify role-specific depth" }); }
    else { missingSkills.push(requirement); if (related) { relatedSkills.push(requirement); skillEvidence.push({ requirement, candidateSkill: related, kind: "transferable", explanation: "Related tool or language may transfer; required skill remains unverified" }); } }
  }
  if (!job.requirements.length) for (const skill of confirmed.filter((value) => resumeContainsSkill(job.description, value))) { matchedSkills.push(skill); skillEvidence.push({ requirement: skill, candidateSkill: skill, kind: "description-keyword", explanation: "Whole-term mention in the description; not a verified requirement" }); }
  const roleMatched = preferences.targetRoles.length > 0 && containsAny(job.title, preferences.targetRoles);
  const experienceKnown = job.minExperience != null || job.maxExperience != null;
  const experienceMatched = experienceKnown && (job.minExperience == null || profile.relevantExperience >= job.minExperience) && (job.maxExperience == null || profile.relevantExperience <= job.maxExperience);
  const skillsPoints = job.requirements.length ? 60 * (matchedSkills.length + relatedSkills.length * 0.25) / job.requirements.length : Math.min(30, matchedSkills.length * 10);
  const components = { skills: Math.round(skillsPoints), targetRole: roleMatched ? 20 : 0, experience: experienceMatched ? 20 : 0 };
  const careerText=[profile.summary,profile.workHistory,profile.projects,profile.education,profile.certifications,profile.currentRole].join("\n");
  const reviewEvidence=[
    ...(job.industry?[{category:"industry",requested:job.industry,evidence:resumeContainsSkill(careerText,job.industry)?`Whole-term mention in confirmed career history: ${job.industry}`:preferences.industries.some(x=>normalize(x)===normalize(job.industry))?"Listed as a target industry; prior experience is unverified":"No exact confirmed profile evidence",status:"review-required"}]:[]),
    ...(job.seniority?[{category:"seniority",requested:job.seniority,evidence:resumeContainsSkill(profile.currentRole,job.seniority)?`Mention in confirmed current role: ${job.seniority}`:"Seniority is not established by years of experience alone",status:"review-required"}]:[]),
    ...(job.responsibilities??[]).map(value=>({category:"responsibility",requested:value,evidence:resumeContainsSkill(careerText,value)?`Exact phrase in confirmed career details: ${value}`:"No exact confirmed career-history phrase; assess transferable experience",status:"review-required"})),
    ...job.requirements.filter(value=>/\b(?:degree|bachelor|master|phd|diploma|certifi|licen[cs]e)\b/i.test(value)).map(value=>({category:"qualification",requested:value,evidence:resumeContainsSkill(`${profile.education}\n${profile.certifications}`,value)?`Exact phrase in confirmed education/certifications: ${value}`:"Qualification must be checked against confirmed education and certifications",status:"review-required"})),
  ];
  const score = Math.round(skillsPoints + components.targetRole + components.experience);
  const uncertainty = [!job.requirements.length ? "No structured requirements supplied; description mentions are weak evidence" : "", !experienceKnown ? "Experience requirement is unknown" : !experienceMatched ? "Experience range needs review" : "", !roleMatched ? "No configured target title match" : "", !job.location ? "Location is unknown" : "", !job.workArrangement ? "Work arrangement is unknown" : "", !job.employmentType ? "Employment type is unknown" : "", relatedSkills.length ? "Transferable skills do not establish required proficiency" : "", salaryComparison.status === "unknown" ? salaryComparison.reason : "", activeResumeText === undefined ? "No active resume: matching uses the confirmed profile only" : ""].filter(Boolean);
  if(reviewEvidence.length)uncertainty.push("Industry, seniority, responsibility and qualification evidence requires review and is not included in the score");
  return { matchedSkills, missingSkills, relatedSkills, skillEvidence, reviewEvidence, salaryComparison, relevance: { score: excludedReasons.length ? null : score, label: excludedReasons.length ? "Excluded by preferences" : score >= 80 ? "Strong relevance" : score >= 50 ? "Worth reviewing" : "Limited relevance", eligible: excludedReasons.length === 0, excludedReasons, uncertainty, components, method: "Mandatory filters first. Up to 60 skill points (exact/equivalent: full; transferable: quarter credit while still missing), 20 target-title points, 20 verified experience points. Unstructured description mentions receive at most 30 skill points. Active-resume skills must also be confirmed in the profile. Salary comparisons never assume exchange rates. Industry, seniority, responsibilities and qualifications are surfaced with exact evidence for review and are not scored. This heuristic is not an ATS score or hiring prediction.", profileRevision: null as number | null, resumeVersion: null as number | null } };
}
export function resumeContainsSkill(text: string, skill: string): boolean {
  const escaped = normalize(skill).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(normalize(text));
}
export function jobFingerprint(job: ManualJob) {
  // Fingerprint is private, not a secret. Duplicate checks do not fetch the URL.
  return [job.title, job.company, job.location, job.workArrangement].map(normalize).join("\u001f");
}
