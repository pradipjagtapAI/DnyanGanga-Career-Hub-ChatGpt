# Agent coordination, knowledge, and application packages

This change extends the existing private account workspace. It does not replace accounts, resume numbering, job records, application outcomes, identity, or earlier migrations. The registry defines 17 logical specialist executors and one central orchestrator. A specialist can use deterministic server rules, local self-review, or the configured AI adapter. It is not a claim that 18 independently paid AI models are running.

## Ownership and architecture

`lib/career-agent-contract.ts` defines the registry, modes, categories, typed state, strict settings validation, canonical snapshot encoding, and SHA-256 hashing. `lib/career-agent-store.ts` wraps the request-scoped `CareerStore`. Every public record operation queries with the authenticated owner, including references to jobs, resumes, generated letters, AI sessions, saved searches, runs, packages, history, and exports. Browser input cannot supply an owner, role, verified classification, execution adapter, approved snapshot, or approval expiry.

The orchestrator in `lib/career-orchestrator.ts` coordinates narrow bounded tasks. Existing provider and AI adapters remain replaceable and fail closed without their required configuration. Current job discovery supports explicitly approved company boards and manual descriptions. Application submission and employer-message sending remain unsupported. Selecting Agentic mode does not activate unsupported access or grant an application approval.

Apply additive migrations `0004_big_mephisto.sql` and `0005_strange_paladin.sql` after the existing 0000–0003 migrations. Do not replay a migration on an existing database. The database has 34 tables after these migrations. No request creates a table. The new 13 owner-scoped tables are:

| Table | Purpose |
| --- | --- |
| `career_agent_settings` | Mode, independent pauses, run quotas, local schedule, and knowledge/answer/feedback revisions |
| `career_saved_searches` | Named searches, career goal, explicit preferences, enabled state, and revision |
| `career_vault_facts` | Current personal facts or proposals with VERIFIED, INFERRED, or UNKNOWN status |
| `career_vault_history` | Append-only fact transition evidence |
| `career_confirmed_answers` | Candidate-confirmed screening answers |
| `career_answer_history` | Append-only answer transition evidence |
| `career_agent_feedback` | Private candidate feedback; it cannot silently override mandatory preferences |
| `career_agent_runs` | Idempotent run, owned context snapshot, state, and exclusive lease |
| `career_agent_tasks` | Registry-bound specialist tasks, dependency results, and actual outcomes |
| `career_agent_activity` | Private action manifests, status, traceable identifiers, and SHA-256 hashes |
| `career_application_packages` | Current exact application package and reviewed revision |
| `career_package_approvals` | Specific expiring authorization for the exact server-owned snapshot |
| `career_package_history` | Immutable private snapshots of each completed package revision |

UPDATE-deny migration triggers protect activity, fact history, answer history, feedback memory, and package history. There is no browser audit/history-update or deletion endpoint. DELETE is deliberately permitted at the database level for authorized account privacy cleanup through cascading ownership relationships. Database operators remain privileged; these hashes and triggers do not replace restricted database credentials, independent audit retention, encrypted backups, or a production security review.

## Knowledge that does not guess personal facts

VERIFIED means the candidate explicitly confirmed the value, or a meaningful field came from an explicitly saved profile revision. It does not independently prove a credential or employer record. Initial hosting display names and default zero years are not seeded as confirmed career facts. Missing facts have a null value and UNKNOWN classification. An inferred document/AI proposal cannot overwrite an existing verified value.

Only explicit confirmation can change a proposal to VERIFIED. `profile.*` facts use the existing profile's field validation: experience is finite, between 0 and 70 years, with relevant experience no greater than total; skills have bounded entries; phone numbers require a country code; portfolio links require safe public HTTPS; identity email cannot be changed. Arbitrary additional fact keys accept bounded candidate-confirmed text. The platform does not guess citizenship, work authorization, sponsorship, disability, salary history, or employer screening answers.

Newer explicit profile saves synchronize older profile-derived facts, their history, the vault revision, and approval invalidation in an atomic batch. Clearing an older meaningful value produces UNKNOWN. A candidate's same-profile vault correction is retained until a newer explicit profile save. Fact and answer transitions, history, revision counters, and approval invalidation commit together. A failed batch rolls all of these back. Repeated identical UNKNOWN proposals are a no-op.

The run basis records profile revision, active resume ID/version, settings revision, knowledge/answer/feedback revisions, selected search revision, and trusted local date. A run can narrowly rebase its own newly recorded missing-fact proposal. It cannot rebase a concurrent user/profile/search/permission change. Shared inferred proposals are established before sibling runs are created, so missing facts do not silently stale independent saved searches.

## Current controls and pauses

Default mode is Approval. Assist mode supports analysis and suggestions in the orchestrator. Approval and Agentic modes can prepare private document packages, but final submission would still need supported platform access and an explicit current action approval. No such submission adapter is connected.

Independent pause categories are `profile`, `documents`, `jobs` (discovery), `applications`, `notifications`, `communications`, `interviews`, `career`, and `security`. An all-agent pause takes precedence. Each claim, completion, and external-policy gate checks current owned settings. Pause/resume increments the settings revision and invalidates prior package approvals; resuming does not restore them. Settings changes retain omitted schedule and run quotas rather than resetting them.

Pausing notifications cancels queued/retry dispatches and releases only unsent reserved job-dedupe entries. Uncertain or accepted send reservations remain to prevent duplicate messages. A pause cannot recall data already accepted by a provider. Expired leases for potentially external specialist work become uncertain instead of being automatically replayed. Local nonexternal unfinished work is cancelled. A stale worker cannot finish a task using a different or expired lease.

Each run lease lasts 120 seconds. Actual orchestrator invocations have their own shorter processing/call budget, save unfinished tasks, and release the lease on a bounded yield. A continuation claims a new token and cannot rerun a completed task. Unique owner/run idempotency keys and owner/run/task keys protect durable duplicate work. Production Cloudflare D1 concurrency, worker crashes, network ambiguity, and load behavior still require deployment verification; the local SQLite adapter does not simulate all of them.

## Exact application review

Package assembly reads server-owned records. It preserves the original selected resume and active version. A snapshot includes:

- Actual job title, employer, source, original URL, checked/posting dates, supplied requirements, and source data.
- Original resume ID, version, title, and exact text; separate job-specific draft and owned AI session reference when present.
- Exact reviewed/generated or separately edited cover-letter text and its reference/version.
- Selected screening questions and candidate-confirmed answer values/revisions. An unanswered question is UNKNOWN.
- Exact selected personal-data field names and values, plus the visible complete documents the candidate must review.
- Confirmed fact evidence, profile/vault/answer/settings revisions, active-resume selection, saved-search snapshot, mode, and pause state.

Legacy or stale AI drafts cannot be packaged after confirmed knowledge changes. Missing required personal facts, missing answers, no resume, absent application destination, and closed jobs prevent approval. Unverified manual-source or omitted listing details are disclosed separately; approval requires explicit acknowledgement of these limitations. No listing facts, personal answers, application URL, or qualifications are invented.

Approval checks explicit confirmation, exact reviewed hash, current package revision, current server-derived snapshot, current ownership and pauses, required verified facts/answers, and an expiry fixed by the server to one hour. The serializable approval batch rechecks relevant account/settings/vault/answer revisions before durable acceptance. Material job, profile, knowledge, answer, selected/active resume, cover-letter, saved-search, or permission changes make the authorization invalid. A changed package must be explicitly refreshed, reviewed, and approved again.

Package edits require candidate confirmation and the current revision. A completed edit preserves the old immutable snapshot, creates a new revision, and invalidates previous approval. Download exports the exact private packet and bounded revision history. Opening a URL, downloading a packet, approving it, or calling unsupported execution never writes Applied. The existing tracker still requires candidate confirmation for a real application.

## API contract

Routes are under `/api/career/agents`. Mutations also require the existing authenticated same-origin JSON policy, `X-Career-Action: 1`, bounded body, and persistent mutation rate limit. Responses and downloads are private and `no-store`. The surrounding route remains owned by the main application; see it for current response envelopes.

| Route | Body or result |
| --- | --- |
| `GET state` | `{agentic}`: settings, 18 registry-backed summaries, bounded runs/activity, vault/history, confirmed answers, feedback, saved searches, packages, attention, owned choices, and actual bounded insight/draft outputs |
| `PUT settings` | `mode, pausedAll, pausedCategories, expectedRevision`; optional `maxJobsPerRun` (1–25), `maxPackagesPerRun` (1–3), `schedule:{enabled,timeZone,runTime:'07:30'}` |
| `POST searches` | `label, goal?, preferences, enabled?` |
| `PATCH searches/:id` | Same fields plus `expectedRevision` |
| `DELETE searches/:id` | Empty object |
| `POST vault/confirm` | `key, label?, value, confirmed:true, expectedRevision` for an existing fact |
| `POST answers` | `key, question, value, confirmed:true, expectedRevision` for an existing answer |
| `POST feedback` | `jobId?, reason, details?`; references must be owned |
| `POST run` or `runs` | `goal?, searchId?` or `searchIds?`; optional bounded request key. Orchestrator derives its deterministic owned daily context key |
| `POST runs/:id/continue` | Empty object; server claims current owned lease and bounded work |
| `POST packages` | Owned `jobId`; server assembles references and unanswered screening review rather than accepting a browser snapshot |
| `PATCH packages/:id` | `confirmed:true, expectedRevision`, optional `coverLetterText, personalDataFields` |
| `POST packages/:id/approve` | `confirmed:true, expectedRevision, reviewedHash, acknowledgedUnknowns:true` when nonrequired listing unknowns remain |
| `POST packages/:id/execute` | Explicit confirmation; current approval required, response remains unsupported without a submission adapter |
| `GET packages/:id/download` | Owned exact JSON packet with original/draft documents and immutable revision evidence |

New fact/answer creation can omit an existing-record revision, but confirmation is still required. `screeningAnswerIds` in the internal package contract currently denotes owned answer keys. A browser cannot call internal `savePackage(...,{serverTrusted:true})` or supply its own snapshots, verified-classification tags, provider history, adapter, or owner.

State projections are bounded: 20 searches, 30 recent runs, 300 recent tasks for per-agent recent status/counts, 100 recent activity/history/feedback rows, 20 recent packages, and 100 job choices. Original database history is preserved and full owner-scoped account export includes all agent tables. These bounds do not establish production performance; full document snapshots can still make responses large. Pagination/detail views and measured production load are launch work.

## Actual test evidence

On 2026-10-12 the following checks were executed locally against fictional test identities and offline provider fixtures. The store test suite runs the real prepared SQL and all generated migrations against in-memory SQLite with foreign keys and atomic batch transactions. It does not prove live credentials, hosted identity dispatch, malware infrastructure, remote scheduler deployment, real payments, or delivery behavior.

| Command | Actual result |
| --- | --- |
| `node --experimental-strip-types --test tests/agent-store.test.mjs` | **37 passed, 0 failed**, final measured suite 856 ms |
| `node --experimental-strip-types --test tests/career-security.test.mjs tests/career-ai.test.mjs tests/provider-alerts.test.mjs tests/agent-store.test.mjs tests/agent-orchestrator.test.mjs tests/agent-matching.test.mjs` | **181 passed, 0 failed**, measured 3,039 ms on the integrated source inspected here; the later schedule regression and final **182-test** run are recorded in `agentic-test-results.md` |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Passed after the final integrated policy, store, route, and UI checks |
| `node node_modules/eslint/bin/eslint.js lib/career-agent-store.ts lib/career-agent-contract.ts tests/agent-store.test.mjs db/schema.ts` | Passed, no reported errors or warnings |

Store evidence includes cross-owner settings/search/job/resume/package/history/export refusal, invalid owner/role fields, stale revisions, typed fact validation, inferred-vs-verified boundaries, UNKNOWN screening blocking, exact hash approval, expiry, active-resume/material-change invalidation, unsupported execution never Applied, idempotent run/task creation, exclusive claims, pause checks, queued-alert cancellation, retained uncertainty fences, failed batch rollback, bounded continuation, immutable history triggers, profile sync, and private hash verification. Independent worker/D1 race and load tests remain required.

Repeat the store command after any policy/schema changes. Repeat the wider existing security/provider/AI suites and the actual orchestrator/matching suites before release. Run deployment HTTP/browser checks separately; do not report offline fixtures as real source discovery, provider delivery, or independent security certification.

## Deployment, retention, and remaining review

Use the existing project run instructions. For a pending local migration after building the Worker, the tested project's command format is:

```text
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_big_mephisto.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_strange_paladin.sql
```

Only apply pending files. These commands do not migrate hosted data. Keep `db/schema.ts`, generated SQL, and Drizzle snapshots/journal together. Before a hosted release, back up private data and rehearse restoration on a separate authorized staging environment. Database access, secrets, hosted accounts, provider approval, encryption, monitoring, and backup operations remain external setup. No new browser service key was introduced.

The 07:30 discovery/preparation schedule is separate from the existing 08:00 alert schedule. A saved schedule and configured secret do not prove a cron Worker has been deployed or is healthy. Deploy and authenticate the private scheduler, observe successful recent runs, and test timezone/missed-run behavior before enabling unattended operation. Current submission, employer messaging, billing, public sharing, administrator functions without fresh MFA attestation, and destructive account deletion without trusted recent-authentication proof remain disabled or unsupported.

Private immutable manifests and package history can retain exact document/AI copies after a standalone resume/session is deleted. This is disclosed retention, not a claim that deleting a session purges all audit/package copies. A production retention policy, authorized retention purge, and backup deletion timeline require review. Account cascade cleanup covers agent tables, but its public destructive endpoint remains gated until the identity provider supplies trusted fresh authentication. There is no independent security certification or legal-compliance claim.

Monitor stale/uncertain runs, lease expiry, scheduler health, unexpected provider usage, failed manifest/history writes, approval mismatches, destination changes, webhook failures, and unusually large private responses. Review dependencies and provider policies regularly; rotate exposed credentials and pause agents/channels during an incident. Preserve protected evidence, revoke affected approvals/sessions, isolate the affected service, restore a verified backup in staging, repair the verified cause, and retest affected ownership/permission/approval paths before resuming. A provider may already have accepted an outbound request; do not blindly replay uncertain work.
