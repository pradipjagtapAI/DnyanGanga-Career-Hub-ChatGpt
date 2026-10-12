/** Bounded document tools: text is never HTML, a file path, or an instruction. */
import { CareerError, keys, object, string, strings, resumeContainsSkill } from "./career-core";
import type { ManualJob, Profile } from "./career-core";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { jsPDF } from "jspdf";

export const RESUME_TEMPLATES = ["classic", "modern", "compact"] as const;
export const RESUME_KINDS = ["general", "master", "target"] as const;
export type ResumeMetadata = { kind: typeof RESUME_KINDS[number]; template: typeof RESUME_TEMPLATES[number]; sectionOrder: string[]; hiddenSections: string[]; linkedJobId: string | null; parentResumeId: string | null; userReviewed: boolean };
export type ResumeSection = { id: string; heading: string; text: string };
const headingNames = new Set(["summary", "professional summary", "career summary", "profile", "experience", "work experience", "professional experience", "employment", "education", "skills", "technical skills", "projects", "certifications", "certificates", "languages", "achievements", "publications", "volunteering", "interests"]);
export function defaultResumeMetadata(): ResumeMetadata { return { kind: "general", template: "classic", sectionOrder: [], hiddenSections: [], linkedJobId: null, parentResumeId: null, userReviewed: false }; }
export function validateResumeMetadata(value: unknown): ResumeMetadata {
  const input = object(value); keys(input, ["kind", "template", "sectionOrder", "hiddenSections", "linkedJobId", "parentResumeId", "userReviewed"]);
  const kind = string(input.kind ?? "general", "Resume category", 20), template = string(input.template ?? "classic", "Template", 20);
  if (!(RESUME_KINDS as readonly string[]).includes(kind) || !(RESUME_TEMPLATES as readonly string[]).includes(template)) throw new CareerError(400, "INVALID_TEMPLATE", "Choose a supported resume category and template.");
  if (input.userReviewed !== true) throw new CareerError(400, "REVIEW_REQUIRED", "Review the content and explicitly confirm its facts before saving a formatted version.");
  return { kind: kind as ResumeMetadata["kind"], template: template as ResumeMetadata["template"], sectionOrder: strings(input.sectionOrder, "Section order", 30), hiddenSections: strings(input.hiddenSections, "Hidden sections", 30), linkedJobId: string(input.linkedJobId, "Linked job", 100) || null, parentResumeId: string(input.parentResumeId, "Original resume", 100) || null, userReviewed: true };
}
export function splitResumeSections(value: string): ResumeSection[] {
  const text = string(value, "Resume", 60000, true); const sections: ResumeSection[] = [];
  let heading = "Contact and introduction", lines: string[] = [];
  const append = () => { if (lines.length || heading !== "Contact and introduction") sections.push({ id: `section-${sections.length + 1}`, heading, text: lines.join("\n").trim() }); };
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.trim().replace(/:$/, "").toLowerCase();
    if (headingNames.has(normalized)) { append(); heading = line.trim().replace(/:$/, ""); lines = []; }
    else lines.push(line);
  }
  append(); return sections.length ? sections : [{ id: "section-1", heading, text }];
}
export function renderResumeSections(sections: ResumeSection[], order: string[], hidden: string[]): string {
  if (sections.length > 30 || new Set(order).size !== order.length || order.some(id => !sections.some(section => section.id === id)) || hidden.some(id => !sections.some(section => section.id === id))) throw new CareerError(400, "INVALID_SECTIONS", "Section choices do not match the selected resume.");
  const ids = [...order, ...sections.map(s => s.id).filter(id => !order.includes(id))];
  return ids.filter(id => !hidden.includes(id)).map(id => {
    const section = sections.find(s => s.id === id)!;
    return (section.heading === "Contact and introduction" ? "" : section.heading + "\n") + section.text;
  }).join("\n\n").trim();
}
export function resumeDifference(before: string, after: string) {
  // Bounded line-LCS. Very long documents use exact line multiset comparison,
  // rather than unbounded quadratic work in a Worker isolate.
  const a = string(before, "Original", 60000).split(/\r?\n/), b = string(after, "Tailored", 60000).split(/\r?\n/);
  if (a.length > 400 || b.length > 400) {
    const frequencies = new Map<string, number>(); for (const line of a) frequencies.set(line, (frequencies.get(line) ?? 0) + 1);
    const result = b.map(line => { const n = frequencies.get(line) ?? 0; if (n) frequencies.set(line, n - 1); return { kind: n ? "unchanged" : "added", text: line }; });
    for (const [line, n] of frequencies) for (let i = 0; i < n; i++) result.push({ kind: "removed", text: line });
    return { lines: result, method: "Exact line multiset; ordering and paired wording changes require manual review.", orderChanged: a.join("\n") !== b.join("\n") };
  }
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const result: { kind: string; text: string }[] = []; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ kind: "unchanged", text: a[i] }); i++; j++; }
    else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) result.push({ kind: "added", text: b[j++] });
    else result.push({ kind: "removed", text: a[i++] });
  }
  return { lines: result, method: "Exact line sequence; additions/removals include wording and reordered lines. No factual change is approved by this comparison.", orderChanged: false };
}
export function analyzeResumeStructure(text: string, profile: Profile, job?: ManualJob | null) {
  const sections = splitResumeSections(text), issues: string[] = [];
  if (!sections.some(s => /experience|employment/i.test(s.heading))) issues.push("No standard experience heading detected. This may be appropriate for students; check how projects or internships are labelled.");
  if (!sections.some(s => /education/i.test(s.heading))) issues.push("No standard education heading detected.");
  if (!sections.some(s => /skills/i.test(s.heading))) issues.push("No standard skills heading detected.");
  if (/\t/.test(text)) issues.push("Tab-separated columns may read in an unexpected order. Verify the exported document.");
  if (/\uFFFD/.test(text)) issues.push("The text contains replacement characters; compare with the original before applying.");
  const requirements = job?.requirements ?? [];
  const found = requirements.filter(skill => profile.skills.some(known => known.toLowerCase() === skill.toLowerCase()) && resumeContainsSkill(text, skill));
  const missing = requirements.filter(skill => !found.includes(skill));
  return { sections: sections.map(s => ({ id: s.id, heading: s.heading, characterCount: s.text.length })), concerns: issues, requiredSkillsFound: found, missingSkills: missing,
    keywordSuggestions: missing.map(skill => ({ skill, action: "Add only after confirming you have this skill; otherwise create a learning task." })),
    basis: "Exact confirmed-skill terms and selected-job requirements, plus simple heading/character checks. No grammar model or employer ATS is connected.", employerATSDecision: false, score: null };
}
export async function exportCareerText(value: string, title: string, format: "pdf" | "docx" | "txt", template: ResumeMetadata["template"] = "classic"): Promise<Uint8Array> {
  const text = string(value, "Document", 60000, true); title = string(title, "Title", 160, true);
  if (!(RESUME_TEMPLATES as readonly string[]).includes(template)) throw new CareerError(400, "INVALID_TEMPLATE", "Choose a supported template.");
  if (format === "txt") return new TextEncoder().encode(text);
  if (format === "docx") {
    const doc = new Document({ creator: "DnyanGanga Career Hub", title, styles: { default: { document: { run: { font: "Calibri", size: template === "compact" ? 20 : 22 } } } }, sections: [{ properties: {}, children: text.split(/\r?\n/).map(line => new Paragraph({ ...(headingNames.has(line.trim().replace(/:$/, "").toLowerCase()) ? { heading: HeadingLevel.HEADING_2 } : {}), children: [new TextRun({ text: line })], spacing: { after: template === "compact" ? 70 : 100 } })) }] });
    return new Uint8Array(await Packer.toArrayBuffer(doc));
  }
  if (format !== "pdf") throw new CareerError(400, "INVALID_FORMAT", "Choose PDF, DOCX or text.");
  // Built-in PDF fonts support these Latin/Windows-1252 characters. Reject
  // unsupported scripts instead of silently losing a candidate's name or facts.
  if (/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/u.test(text + title)) throw new CareerError(422, "PDF_SCRIPT_UNSUPPORTED", "This PDF template supports Latin scripts. DOCX and text preserve all characters; export DOCX and use Word's Save as PDF for this document.");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true }); doc.setProperties({ title, creator: "DnyanGanga Career Hub" });
  const margin = 48, pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight(), lineHeight = template === "compact" ? 13 : 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(template === "compact" ? 10 : 11);
  let y = margin; let pages = 1;
  for (const line of text.split(/\r?\n/)) {
    const heading = headingNames.has(line.trim().replace(/:$/, "").toLowerCase()); doc.setFont("helvetica", heading ? "bold" : "normal");
    if (template === "modern" && heading) doc.setTextColor(15, 118, 110); else doc.setTextColor(15, 23, 42);
    for (const wrapped of doc.splitTextToSize(line || " ", pageWidth - 2 * margin) as string[]) {
      if (y > pageHeight - margin) { if (++pages > 80) throw new CareerError(413, "EXPORT_TOO_LONG", "This document is too long for a bounded PDF export. Split it into shorter versions."); doc.addPage(); y = margin; }
      doc.text(wrapped, margin, y); y += lineHeight;
    }
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
