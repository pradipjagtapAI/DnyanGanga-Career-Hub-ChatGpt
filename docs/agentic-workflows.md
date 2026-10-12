# DnyanGanga Career Hub: bounded career workflows

This upgrade adds one server coordinator and 17 logical specialist executors. They share ownership-checked application code and durable database records; they are not 17 independent model providers. An executor's name describes its responsibility. Its task records disclose completed, queued, blocked, needs-input, awaiting-approval, unsupported, failed, uncertain or cancelled work. Counts come from those records.

## How work progresses

1. The user supplies a goal and optionally chooses saved searches. The server resolves the current owned profile, VERIFIED knowledge, active resume, search revision and permission settings. UNKNOWN questions are persisted without guessing values.
2. Each search gets its own durable context-bound run. The default mode is **Approval**. An idempotency key derived from owner-local day, goal, search/context and permission revisions prevents an accidental repeated request from duplicating the same run.
3. The coordinator plans specialized tasks, selects eligible tasks, atomically claims a lease and executes bounded work. Each invocation allows at most one external job-source or AI call. The execution budget is at most 18 seconds, with a shorter timeout for the provider. Queued work persists for the working **Continue** control or the next scheduler invocation. Database preparation/round-trip latency still needs measurement; this budget is not a production latency guarantee.
4. Results are checked against current ownership, profile/resume/knowledge revisions and pause policy before saving. AI outputs additionally pass the existing strict evidence schema. Imported documents and job text are untrusted data; they receive no submission, messaging or database tools.
5. Completed results, missing input and unsupported actions are saved. User confirmation is needed to turn a proposed fact into VERIFIED knowledge, review a document or approve a package. The coordinator never performs those confirmations on the user's behalf.

**Assist** analyzes and suggests; it does not automatically create resume/cover-letter drafts or application packages. **Approval** and **Agentic** may prepare private drafts and packages. All three modes currently keep application submission under the user's control because no approved submission integration is configured. Choosing Agentic mode does not authorize unsupported automation.

## Specialist capabilities

| Executor | Implemented result / boundary |
| --- | --- |
| Profile | Reviews confirmed fields and stores missing facts as UNKNOWN / ASK_USER. Never silently verifies an inferred fact. |
| Resume intelligence | Inspects the active text resume and records character/word/structure observations. No universal ATS or selection score. |
| Job discovery | One durable task per explicitly authorized Greenhouse board; one board network call per continuation. Failure on one board does not suppress other board tasks. Missing rights/configuration is blocked. |
| Job verification | Attributed source snapshots, unknown fields, exact-destination duplicate groups and payment/password/OTP review indicators. Indicators are not fraud determinations. Manual job availability stays unverified. |
| Job matching | Mandatory global filters first, intersected with saved-search filters. Fixed nine-factor evidence ranking supplied by `career-agent-matching.ts`, with unknown information disclosed. |
| Resume tailoring | A new owned unreviewed AI or local self-review session for an eligible actual job. The active original is preserved. |
| Cover letter | A factual owned draft tied to the actual resume/profile/job context; user review remains necessary. |
| Application preparation | Up to three eligible job packages per run. The server assembles the original resume, separate tailored/cover drafts, confirmed screening answers and exact private snapshot. Unprovided employer screening questions stay ASK_USER. |
| Application approval | Reports review requirements. Only the explicit approval endpoint can bind approval to a current package hash, revision and expiry. |
| Application execution | **Unsupported**. Provides the original application URL and package references. Never submits, invents a successful result or marks Applied. |
| Application tracking | Reads actual user-confirmed tracker records. Opening a link is not an application. |
| Notification | Reports channel readiness and current user settings; delivery belongs to the independent durable alert queue. No workflow task invents a sent/delivered message. |
| Interview preparation | Saves role-specific text practice from bounded confirmed facts or clearly labelled local self-review. No voice/personality inference is introduced. |
| Career coach | Saves factual suggestions and weekly actions, with provider/self-review attribution. |
| Market intelligence | A dated sample of actual owned eligible job descriptions with original source links and known salary fields. Explicitly limited evidence; no invented population trends or salary estimates. |
| Follow-up | Unsent draft text for actual Applied/Interview tracker records. Recipients remain unassigned. Employer message sending is unsupported. |
| Security policy | Checks the run's ownership/revision/pause boundaries and records the checks. This is not an ASVS certification or an independent penetration test. |

There may be more than 17 task records because discovery has a separate task for each approved board. The logical registry remains 17 specialists plus the coordinator. Missing external credentials do not prevent the independently owned manual-job/local-self-review journey.

## Matching, saved searches and feedback

Each saved search is independent. Empty location, work-arrangement, employment-type and role choices inherit explicit global choices. A search can narrow a mandatory preference; it cannot widen it. A global mandatory Pune filter still excludes Mumbai even if a saved search permits Mumbai. Free-text feedback never changes mandatory policy or becomes a career fact.

Known `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `utm_source_platform`, `utm_creative_format` and `utm_marketing_tactic` parameters are ignored when comparing destinations. Job-ID and unknown query parameters are preserved. Duplicate originals remain saved; preparation prefers the newest source-backed primary record. A known-closed primary cannot be rescued by an older manual duplicate.

The fixed nine-factor score remains visible and unchanged. The latest feedback tied to an exact owned job adds a separately disclosed **-10 queue-priority adjustment**, bounded below at zero. General feedback without a job reference is retained for review and does not change automated ranking. This simple memory adjustment is not a learned hiring probability. Positive/negative feedback classification and more sophisticated learning need explicit product design before expansion.

## Pauses, private audit and external uncertainty

The settings row is reloaded immediately before every actual source/AI/provider call. AI gates run after durable quota reservation, directly before the provider receives the minimized request. Pauses and changes to frozen run context stop work. A provider request that has already started cannot be recalled; post-call changes stop its result from becoming a reviewed fact or active document.

Before/after private owner-scoped manifests record the fixed destination, exact minimized sent data, permission basis and validated result/uncertainty. Authentication service keys are omitted. Verification codes are represented by a destination-bound HMAC, not a reusable clear-text code. Hashes support integrity comparisons; they do not make the database tamper-proof against its operator. Administrative access remains separately gated.

Atomic run/task leases and unique owner/run/task keys prevent two workers claiming the same pending work. An expired in-flight provider task becomes uncertain instead of being blindly replayed. An uncertain AI attempt is not retried by Continue. Independently queued specialists may still progress. Unknown provider acceptance needs reconciliation. Existing email delivery preserves its frozen message and provider idempotency key within its controlled retry window; WhatsApp ambiguous sends are not automatically repeated.

Changing global/notification pause settings immediately cancels pending queued/retry digests, preserves uncertain acceptance fences and is rechecked before sending. Accounts without an agent-settings row retain the previous unpaused agent policy. Existing notification channel consent remains independently required. Pausing Jobs prevents source refresh and a digest requiring that refresh.

The digest includes real counts only for the same owner/local day and current profile, resume, settings, vault, answer, feedback and saved-search revisions. It distinguishes suitable jobs, prepared packages, review needs and blocked/unsupported/uncertain tasks. Agent submission count is zero because the submission capability is unsupported. Historical/provider failures are not converted into fake successful results. Message context is frozen before sending, including these counts; a changed retry body is cancelled instead of violating provider idempotency.

## Unattended schedule and exact setup boundary

Agent schedules default disabled and use **07:30 Asia/Kolkata**. Digests default **08:00 Asia/Kolkata**. The coordinator uses a 60-minute catch-up window, a 120-second scheduler lease, at most ten scheduled account rows per scan and one external call per scheduler invocation. All twenty configured saved searches receive durable runs; bounded execution may need multiple invocations. The cursor advances only over processed accounts. These are pilot bounds, not measured capacity or an 08:00 preparation guarantee.

The same separate Cloudflare scheduled Worker in `worker/scheduler.ts` posts to the site's authenticated `POST /api/career/internal/scheduler` once per minute. The site invokes agents and alerts independently, so `CAREER_ALERTS_ENABLED=false` does not disable authorized local agent scheduling. No native Sites Cron binding or deployment is invented.

1. Apply the checked-in additive database migrations, including agent tables and package-version history, in the private test environment before deploying this source.
2. In **native Sites runtime environment settings**, preserve existing entries and set `CAREER_SCHEDULER_SECRET` as a secret with at least 32 random characters. Keep `AI_ENABLED`, `CAREER_JOBS_ENABLED` and `CAREER_ALERTS_ENABLED` false until their separate approvals and staged tests pass. Ordinary local `.env` files do not change native production settings.
3. Deploy the external Worker using the existing `worker/wrangler.toml`, fixed application origin and every-minute Cron. Install the matching scheduler secret in Worker secret storage. A private Sites audience also requires a legitimate narrowly scoped `SITES_SERVICE_BEARER` installed only on that Worker. This task does not mint that credential or claim the Worker is deployed.
4. Confirm the actual scheduled request is accepted and recent `agents_scheduler` health is recorded. Credential presence reports **awaiting_worker**, not a verified running service. Specialist next-run times are populated only for supported unpaused work after a recent scheduler observation; notification timing remains null here because its separate channel dispatch is not verified by the coordinator. Enable the candidate's schedule explicitly after verification.
5. Configure only authorized fixed Greenhouse boards and explicit display/digest/AI rights. Configure the AI provider, model allowlist, data policy and budgets separately. See `integrations-update.md` and AI handover for provider and callback settings. No Naukri, Indeed, LoopCV or employer communications access is presumed.
6. Before enabling outgoing digests, verify destinations and opt-ins, approved WhatsApp templates/official sender, verified Resend domain, untouched signed callbacks, unsubscribe relay and per-channel failure recovery. No actual external messages were sent during this implementation.

Current release blockers remain external scheduler credentials/deployment, source rights, AI provider policy/budgets, verified messaging setup, isolated document processing capability, hosted transaction/load verification and independent security review. Paid checkout and automated submission remain disabled. A 200-run retention cap and bounded scans require a designed retention/scaling policy before sustained large audiences; twenty daily saved searches can reach that cap in ten days without cleanup.

## Repeating actual checks

Run from the repository with Node 22.13+:

```text
node --experimental-strip-types --test tests/agent-orchestrator.test.mjs tests/provider-alerts.test.mjs
npm run typecheck
npx eslint lib/career-orchestrator.ts lib/career-alerts.ts tests/agent-orchestrator.test.mjs tests/provider-alerts.test.mjs
```

Executed locally on 12 October 2026: **52 offline tests passed, zero failed, 2774.133 ms** (24 coordinator regressions and 28 provider/alert regressions). They use all checked-in SQL migrations in an in-memory SQLite D1 adapter, injected board/AI/message responses and actual Resend SDK signature verification. They cover independent searches, mandatory location intersection, duplicates and sensitive-request indicators, feedback priority, Assist mode, package/original preservation, UNKNOWN facts, immutable hashes, run idempotency/claims, per-call budgets/Continue, provider failure independence, owner isolation, pauses after quota/audit, uncertainty/no replay, scheduler timing/deduplication and actual-context digest summaries. Type/lint verification is reported separately by the release handover after the final combined source check.

These tests do not prove live licensing, provider availability, real email/WhatsApp delivery, hosted D1 behavior, external Cron deployment, secret configuration, backup recovery or production capacity. Keep those launch checks open until they are measured or independently reviewed.
