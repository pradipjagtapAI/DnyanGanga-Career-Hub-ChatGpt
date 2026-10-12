# Career platform private data extension

This extension keeps the existing accounts, resumes, documents, jobs, applications, conversations and agent history. It adds private planning records; it does not connect a recruiter messaging service or external calendar. The specialist registry now contains 21 logical specialists plus the central orchestrator. A specialist is a bounded server executor, not a separately paid model or independent permission boundary.

## Storage and migration

Apply all migrations in their recorded order, including `drizzle/0006_chilly_scourge.sql`. Do not recreate or reset the database. The Drizzle schema and generated snapshot now describe 40 tables. Migration 0006 adds:

| Entity | Purpose | Limits in this preview |
|---|---|---|
| `career_goals` | Candidate-confirmed goal, target role, planning preferences, date and status | 50 current records per owner |
| `career_learning_tasks` | Reviewed skill tasks, owned job evidence, optional owned goal and resource link | 200 current records per owner |
| `career_recruiters` | Private manual contact list, notes, unsent draft and follow-up reminder | 100 current contacts per owner |
| `career_recruiter_interactions` | Append-only candidate-recorded contact interactions | 100 retained interactions per contact |
| `career_interviews` | Manual interview appointments with owned job, resume and contact references | 200 current appointments per owner |
| `career_platform_history` | Private before/after revision records for planning and campaign changes | No automatic retention purge is implemented |

The migration also adds resume `metadata` and `archived`, campaign resume/status/frequency/experience fields, and answer expiry/reconfirmation fields. Existing resume text and versions remain intact. Disabled legacy campaigns are explicitly backfilled to `paused`; a new default must not reactivate them. Legacy campaigns use daily frequency and the global active resume until a candidate selects a version.

History and interaction tables reject SQL UPDATE through migration triggers. Candidate APIs do not offer history modification. DELETE remains possible for authorized privacy cleanup and foreign-key cascades. This is protection against accidental or ordinary application rewriting, not cryptographic immutability against a database administrator.

## Server contracts

`CareerPlatformStore(careerStore, agentStore?)` is request-scoped and derives its owner exclusively from the existing trusted identity. Client bodies cannot supply an owner, role, source, provider-delivery status or SQL columns. All statements use bound parameters. URLs are validated public HTTPS references and stored only; these methods do not fetch them.

| Resource | Save method | Delete method |
|---|---|---|
| Goals | `saveGoal(body, id?)` | `deleteGoal(id, body)` |
| Learning | `saveLearningTask(body, id?)` | `deleteLearningTask(id, body)` |
| Recruiters | `saveRecruiter(body, id?)` | `deleteRecruiter(id, body)` |
| Interviews | `saveInterview(body, id?)` | `deleteInterview(id, body)` |

Every manual save requires `confirmed: true`. Updates and deletes require `expectedRevision` from the current record. A successful update increments the revision. Stale updates fail with `REVISION_CONFLICT`. Writes and their history records commit in one database batch; insert quotas are checked inside the INSERT statement. A successful planning change also increments the owner's agent settings revision and invalidates prior package approvals. Failed quota or revision checks do not change the policy revision. Owned reads are available through `ownedGoal`, `ownedLearningTask`, `ownedRecruiter`, `ownedInterview` and corresponding `list*` methods.

`saveInteraction(recruiterId, {confirmed:true, expectedRevision, type, text, occurredAt?})` requires the current contact revision. Allowed types are `note`, `conversation`, `email_received`, and `meeting`. These are explicitly candidate-recorded events. Future occurrences and client claims such as `email_sent` or `delivered` are rejected. Recording an interaction increments the contact revision and derives its most recent interaction date. It never sends a message or proves receipt by a provider.

Interview timestamps require an explicit timezone offset or `Z`; the separate IANA `timeZone` controls presentation. The source is always `manual`. A client cannot pretend an appointment was imported or accepted by Google or another calendar. Deleting a contact detaches its reference from retained appointments; deleting a goal detaches its reference from retained learning tasks. Linked jobs, resumes, contacts and goals must belong to the same owner.

`state()` returns the exported `PlatformState`: goals, learning tasks, recruiters, interviews, recent history metadata, measured progress, lifetime usage and minimized external data-use evidence. `history(kind,id)` returns up to 100 private revisions for an existing owned record. `exportData()` includes all owned current records and retained platform history. Parent API integration preserves the existing no-store headers, session checks, same-origin mutation checks, bounded requests and rate limits.

Planning preferences belong to that goal only and do not edit the account's global preferences. Matching must apply the account's mandatory filters in addition to any selected campaign filters. The orchestrator implements that intersection separately; a goal or campaign cannot silently broaden mandatory cities, countries or work arrangements.

## Campaigns and current-input protection

Saved campaigns add `resumeId`, `status: active|paused|archived`, `frequency: daily|weekly|manual`, nullable `minExperience` / `maxExperience`, and `mandatoryExperience`. Existing `enabled` remains supported and agrees with active status. PATCH omissions preserve current fields. Contradictory enabled/status values, reversed experience ranges and mandatory experience without a range are rejected.

A selected resume is checked for ownership and archive status. Run contexts and packages use that campaign's exact resume version; a deleted selection produces an error instead of quietly using the global active resume. Packages cannot override a campaign's selected version without an explicit campaign edit. Archived or paused campaigns do not run or authorize their packages. The global active pointer is also retained in the hash, so changing it invalidates existing review authorizations conservatively.

Campaign changes and deletion retain private before/after history. `deleteSearch(id, body)` accepts explicit confirmation and the current revision; the optional-body internal signature remains for existing callers. Changes to search revision, profile, selected resume, vault, answers, feedback, settings or current answer freshness stop a stale run. Run dates share the scheduler's local-date basis during its 60-minute catch-up window, including a run time near midnight.

## Knowledge and answer freshness

The vault has four classifications: `VERIFIED`, `AI_EXTRACTED`, `INFERRED`, and `UNKNOWN`. Document extraction and inference remain separate proposals. Neither can replace an explicitly confirmed fact or automatically become verified. UNKNOWN stores a null value. Only explicit candidate confirmation can promote a personal fact, with type and profile validation. Languages are validated as a list, experience as bounded numerical years, links through the existing URL policy, and account email remains managed by identity.

`recordDocumentExtraction(documentId)` reads the stored extraction from an owned document only after the private processor has produced `review_required` or `confirmed` status. Browser-provided extraction values are not accepted. Each proposal records its immutable document identifier and original-content hash. Extracted email, phone and WhatsApp remain separate `documentcontact.*` facts; they cannot change account contacts. Existing verified facts are preserved. A field too large for the bounded vault is omitted as a whole with a warning, while its complete value remains in the document review; values are not silently truncated. Missing scan approval never produces proposals.

Screening answers have `confirmedAt`, `validUntil`, `reconfirmAt`, and an effective `fresh` flag. Their stored value remains visible privately for review. At expiry or the reconfirmation date, effective classification becomes UNKNOWN and the package uses a null answer with ASK USER. The candidate must reconfirm the exact value before reuse. This schedule is not independent verification that a fact remained true.

The server's conservative maximum recheck intervals are seven days for availability/joining questions, thirty days for salary, notice, work authorization, sponsorship, relocation, travel, shifts and current-employment questions, and ninety days for other answers. Optional ISO `validUntil` and `reconfirmAt` can shorten these intervals; they cannot remove expiry or extend beyond the server maximum. Legacy answers without those fields derive the same expiry from their original confirmation date. Expiry changes the material package snapshot and invalidates an existing approval even if no database edit occurred.

Packages include only explicitly selected screening answer keys. Required question slots remain visible as UNKNOWN until the candidate selects a fresh answer for that package, even when the library already holds a matching key. `PATCH` with `screeningKeys` replaces the selection, removes legacy implicit selections, and invalidates prior approval; omitting the field preserves the current selection. Removing an optional, unrelated expired answer does not block the remaining package, while removing a required answer keeps ASK USER. Employer-specific keys use `job_screening.<ownedJobId>` and the server rejects reuse in another listing with `SCREENING_JOB_MISMATCH`. Generic reusable answers such as availability still require explicit selection and current confirmation. Neither the scheduler nor automatic preparation copies every library answer into an application.

## Usage and data use

Usage is calculated from owned database activity: AI requests, reserved tokens, recorded provider token totals, unknown token-use requests, original document count/bytes, agent runs and durable channel outcomes. A partial provider-token sum is accompanied by the unknown-request count. It must not be displayed as a complete measured bill. Cost and currency are null because invoices and provider-specific accounting are not integrated. There is no fabricated currency total or savings estimate.

Data-use records show destination, purpose, top-level payload field names, private manifest hash and attempt/response status. They omit raw prompts, document text, screening values and credentials. A pre-request manifest proves recording of an intended attempt, not delivery. A successful response does not prove an employer application or downstream message delivery. Accepted and delivered digest statuses come from the existing durable provider queue. Local self-review and manually recorded CRM interactions are excluded from external-send evidence.

## Privacy, retention and launch limits

Deleting a current planning or contact record removes that current record; contact deletion cascades its interaction rows. Private revision history and previously prepared immutable package snapshots can still contain prior information. They are retained until authorized owner account cleanup. There is no scheduled history purge or promised backup-erasure timeline in this extension. Account cleanup remains disabled in the public API until the platform supplies trusted fresh authentication; the database cascade mechanism alone is not an enabled user deletion flow. Operators must establish retention and backup deletion policies before sensitive broad public use.

State reads are bounded in record count but may be large at maximum resume, history and contact-interaction quotas. Pagination and production response/load measurements remain necessary before broad rollout. Calendar synchronization, recruiter outreach, automatic submissions, public sharing, administrator access and payments remain disabled unless their separate trusted integrations and controls are completed. No additional credential automatically enables those features.

## Actual verification

On 2026-10-12, the actual SQLite migration and storage regression suite passed **84 / 84 tests**: 37 existing agent storage tests and 47 new platform tests. Repeat from the site directory:

```powershell
node --experimental-strip-types --test tests/platform-store.test.mjs tests/agent-store.test.mjs
node node_modules/eslint/bin/eslint.js lib/career-agent-contract.ts lib/career-agent-store.ts lib/career-platform-store.ts tests/platform-store.test.mjs tests/agent-store.test.mjs db/schema.ts
```

The tests execute the actual TypeScript policies/store SQL and every migration against isolated SQLite databases with foreign keys enabled and a serialized batch adapter. They cover two-owner isolation, injection fields, confirmation, stale and simultaneous revisions, quotas, malformed dates/links, immutable history, cross-owner references, legacy migration preservation, campaign-specific resumes, archive ownership/current-state controls, immutable presentation revisions, proposal classifications, answer expiry, approval/run invalidation, minimized privacy evidence and measured usage. They do not establish production D1 network concurrency, hosted session isolation, deployed scanner behaviour, delivery to a live provider, backup restoration, or broad performance. Root handover documents record full-app build, browser and HTTP checks separately.

