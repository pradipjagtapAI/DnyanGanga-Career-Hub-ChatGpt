# DnyanGanga Career Hub — AI update

Tagline: **Your AI-Powered Career Growth Platform**

This update adds server-side career coaching, resume fact selection, cover-letter drafts, interview questions, and answer feedback. It also provides explicitly labelled self-review when no AI service is configured. Provider credentials have not been supplied: **no live OpenAI request, provider invoice, or live-model quality result was produced during this work**.

## Components and boundaries

- lib/career-ai.ts: replaceable provider interface, the official OpenAI Responses HTTP adapter, strict response verification, bounded private context, conservative quota reservations, and fixed self-review tools.
- lib/career-store.ts: authenticated-owner persistence, private sessions, generated documents, and durable usage reservations. Database migrations are generated from db/schema.ts.
- app/api/career/[...path]/route.ts: identity, same-origin mutation checks, body/rate limits, ownership resolution and provider orchestration. It must resolve context from the authenticated store; browser-supplied context/history/model/role is rejected.
- tests/career-ai.test.mjs: offline provider mocks and security-policy verification. Store and end-to-end results are recorded separately in docs/test-results.md.

The server resolves the confirmed profile revision, active owned resume version, and selected owned job before calling the provider. It sends career facts, goals, the selected description, and bounded conversation/answer text. Explicit account email, phone, WhatsApp, name and portfolio fields are omitted. Known contact strings and email-like strings inside source facts are masked. This is data minimization, not a guarantee that all personal information in arbitrary prose has been detected: review source text and the provider notice before enabling external processing.

Context is bounded to 80 source facts and 16,000 characters. Complete source lines over 2,000 characters are omitted with a warning; sentences are not silently shortened into changed facts. Selected job metadata has priority and its description has a separate 4,000-character allowance. A long document may need a shorter confirmed summary. Source jobs retain their provenance and permissions; a description without AI-use permission must not enter a live AI request.

The provider receives no tools, retrieval interface, filesystem access or application-submission capability. A job URL cannot cause a server fetch. The adapter always calls the fixed https://api.openai.com/v1/responses origin and rejects redirects. Imported instructions stay inside an untrusted data object. These permission boundaries constrain consequences of prompt injection; prompt wording alone does not establish protection.

## Output verification and reviewed documents

The request uses strict JSON Schema, and the server verifies the result again. Unknown fields, oversized values, nonexistent fact IDs, altered quotes, duplicate evidence, wrong fact types, refusals, incomplete responses, tool-call outputs and malformed provider responses fail safely. Every referenced fact needs an exact complete quote. Employer requirements cannot become candidate qualifications.

For resume and cover-letter modes, the model may select candidate fact IDs. **Document text is rendered by server code from those exact confirmed facts and fixed wording.** Free-form model replies and editorial suggestions cannot enter that document text. This deliberately limits creative rewriting until a stronger claim-verification workflow is available. A saved document is still a draft for the user to inspect.

Suggestions remain unapproved advice. Exact citation checks do not prove the semantic truth of free-form coaching, questions, feedback or advice. No universal ATS score, selection guarantee, salary forecast, personality assessment or technical correctness guarantee is provided.

A reviewed save must require an explicit user confirmation and read the result from an owned persisted session. Browser text or a browser-supplied “AI-assisted” flag cannot establish provenance. A later manual edit remains a manual revision. AI-assisted reviewed saves record the profile/resume/job context used; they do not silently replace the chosen active resume.

## Session and interface contract

Supported modes are coach, resume, coverletter, interview_questions, and interview_feedback.

The AI request accepts only:

| Field | Purpose |
| --- | --- |
| mode | Career tool |
| prompt | Optional request, at most 2,000 characters |
| jobId | Optional owned job; required for cover letters |
| sessionId, expectedRevision | Existing owned session and its nonnegative revision (initially 0); supplied together |
| question, answer | Required for interview feedback; bounded to 1,500 and 6,000 characters |

Server history is bounded to 12 turns, at most 2,000 characters per turn and 8,000 characters in total. Do not accept it from the browser. Existing-session saves use revision checks so competing tabs cannot overwrite each other silently.

Results contain source (ai or self-review), mode, reply, exact evidence, unapproved suggestions, documentText, documentFactIds, questions, feedback, nextSteps, warnings, context revision references, and measured usage or null. The workspace exposes private aiSessions and generatedDocuments. Session deletion and owned generated-document download/deletion are required at the HTTP boundary. Implemented route contracts:
- POST /api/career/ai creates or updates an owned session and returns result/sessionId/state.
- DELETE /api/career/ai-sessions/:id deletes owned session history.
- POST /api/career/ai-sessions/:id/review accepts confirmed:true, kind, title and optional targetRole.
- GET /api/career/generated-documents/:id/download downloads an owned cover letter as text.
- DELETE /api/career/generated-documents/:id deletes an owned cover letter.

Executed HTTP/store evidence should be checked in docs/test-results.md; reading the source alone does not establish production behavior.

The fallback uses fixed role-specific questions, verbatim fact drafts, weekly planning prompts and an answer self-check. It reports word count and a review checklist, **not AI evaluation**. Voice/camera recording, payments, administrators, account deletion and external job applications retain their independent capability gates.

## Server configuration

A key alone cannot activate external processing. All required settings must be present:

| Server setting | Required value or constraint |
| --- | --- |
| AI_ENABLED | true after setup and approval |
| AI_PROVIDER | openai for the supplied adapter |
| OPENAI_API_KEY | A real server secret; placeholders are rejected |
| AI_MODEL | An explicitly chosen, supported model |
| AI_ALLOWED_MODELS | Comma-separated allowlist containing that exact model |
| AI_DATA_POLICY_APPROVED | true only after provider/data-policy review and user notice |
| AI_MAX_OUTPUT_TOKENS | Integer 256–4,096 |
| AI_DAILY_REQUEST_LIMIT | Per-user integer 1–1,000 |
| AI_DAILY_TOKEN_LIMIT | Per-user integer 1,000–10,000,000 |
| AI_GLOBAL_DAILY_TOKEN_LIMIT | Integer 1,000–1,000,000,000 across users |
| AI_TIMEOUT_MS | Optional integer 1,000–20,000; default 12,000 |

Choose model access and structured-output support using current official documentation and your actual account; no default paid model is selected. The status “configured” means these settings are present. It does not mean credentials, model access or a successful provider call were verified.

Use server secret storage and separate test/production projects. Do not place a key in source control, NEXT_PUBLIC_ settings, the browser, downloadable configuration, or analytics. Keep AI_ENABLED=false when the hosting environment cannot securely supply secrets and enforce these controls. The managed Sites release flow remains the deployment path in the README; do not bypass its authenticated dispatcher.

The adapter requests store:false and sends no provider conversation ID. Private conversation state stays in D1. This does not imply zero provider retention: provider abuse-monitoring policies and any approved retention arrangement require separate review. Official references: [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), and [API data controls](https://developers.openai.com/api/docs/guides/your-data).

## Usage and cost controls

Before a live call, the owned D1 budget reserves a request and a conservative token allowance against both user and global UTC-day limits, with one active user lease. The reservation is request bytes plus maximum output tokens plus 2,048 framing tokens. It is intentionally conservative, not an exact tokenizer or currency quote.

On success, provider total usage is validated and recorded. A timeout, malformed output or provider failure keeps its allowance consumed. Only the active lease is released. No automatic provider retry is performed: an uncertain provider request could already be billable. A crash leaves a short lease that expires; its reservation remains counted.

Token quotas do not by themselves establish a dollar cap because prices differ by model and token category. Set provider project spending limits where supported, monitor invoices and unusual usage, and keep model changes behind an explicit allowlist review. Monetary cost estimates remain conditional on actual usage and pricing.

## Executed verification

On the development Windows host, from sites/dolphin-career:

~~~powershell
node --experimental-strip-types --test tests/career-ai.test.mjs
npx eslint lib/career-ai.ts tests/career-ai.test.mjs
~~~

Observed results after the context-priority update: **32 tests passed, 0 failed**, duration **1,484.7502 ms**. Targeted lint exited **0**. All provider responses and credentials in these tests are synthetic.

The tests cover incomplete configuration, private-context minimization, exact evidence, wrong-tenant fact references, malicious document instructions, fixed provider origin/no tools, malformed/refused/incomplete responses, bounded response streams, conservative quotas, one active mock-budget lease, provider failures, no automatic retries, settlement failures, timeout handling, role context and browser execution refusal. The module lease test uses a mock budget. An independent run of tests/career-security.test.mjs passed 50 tests with 0 failures (758.1928 ms), including actual prepared owner-bound SQLite SQL, durable AI user/global quota accounting, reviewed-save provenance and document race controls. This SQLite adapter and mock processor do not establish real D1 contention, deployed identity, malware-scanner effectiveness or storage isolation on the host.

The integrated check npx tsc --noEmit --incremental false subsequently exited 0 after the concurrent nullable matching/document integration fixes. Targeted AI lint was rerun on this version and exited 0. Final build, HTTP, storage and UI verification are recorded separately after integration completes. These offline tests do not establish production identity, provider permission, live model quality, actual billing accuracy, performance under load, or a complete penetration test.

## Remaining launch work and maintenance

1. Apply the new schema migrations through the managed deployment flow. Verify owned session/document export and deletion, stale-session conflicts, and reviewed-save provenance with two authenticated test accounts.
2. Review provider terms, processing locations, retention settings and user disclosure. Configure only server secrets and explicitly approved model/budgets.
3. Run a controlled provider sandbox test with fictional data; verify structured output, refusal handling, timeout/usage accounting and the exact chosen model. Record real evidence before claiming live AI.
4. Inspect generated drafts for factual preservation across different industries, long documents, conflicting resume/profile facts and malicious source text. Keep the fact-only renderer until broader claim checks have evidence.
5. Confirm keys are absent from built browser assets. Review unresolved dependency/security findings and obtain an independent security review before broad sensitive-data collection.
6. Alert on repeated invalid output, timeout/error rates, failed quota settlement, unusual token use and unexpected model/cost changes. Rotate a compromised key, set AI_ENABLED=false, preserve non-content security evidence, and reconcile uncertain provider usage before reenabling.
7. Back up D1 privately and test restoration of schema, owned sessions, quota rows and version references. Restoration must preserve consumed reservations and revocations; do not resend or rerun jobs automatically after recovery.

No new ASVS certification, legal-compliance claim, security badge or successful live-provider test is implied by this update.



## Control status for this update

| Control | Status and evidence |
| --- | --- |
| Explicit live-AI gate, model allowlist and token/request limits | Implemented and tested with synthetic configuration and quotas |
| Strict output schema, exact quotes, candidate-only document facts | Implemented and tested with valid, fabricated and malicious outputs |
| No AI tools or user-URL retrieval; fixed provider origin | Implemented and tested in mocked HTTP adapter |
| Owner-bound sessions, generated documents and usage reservations | Implemented; SQLite store tests passed; private two-account HTTP deployment verification remains required |
| User-reviewed save and unchanged active-resume choice | Implemented and tested in owned store |
| Live provider credentials, model access and quality | Externally required and untested; no live call made |
| Provider privacy notice, contract and retention arrangement | Externally required before enabling external processing |
| Dollar-denominated hard cap | Not implemented; token quotas and external project spending controls are separate |
| Full retained interview archive | Not implemented; current private history retains the latest 12 turns |
| Voice/camera, checkout, administrator MFA, destructive step-up | Separate disabled capabilities; not authorized by an AI result |

Maximum-quota payload/load testing is still required. The current state endpoint returns full saved content; large sets of resumes, job descriptions and conversation history can produce large responses. Pagination and separate detail retrieval should precede broad operation. No measured 100/1,000/10,000-user throughput claim is made here.

