# DnyanGanga Career Hub – current private release

Prepared 12 October 2026. This is an update to the existing project, accounts, private URL, managed sign-in, D1 database and R2 binding. The supplied green/orange DnyanGanga logo and current tagline remain. No separate replacement site or new paid plan was created. The generic temporary Dolphin name in the expanded brief does not change the previously approved branding.

## Delivered scope

The working account journey is: sign in → confirm profile and preferences → save a text resume or use a configured safe upload → review proposed facts → create goals and independent campaigns → import an actual permitted description or refresh configured authorized boards → inspect mandatory-filter-first fit → prepare separate drafts → supply missing facts and explicitly select job-specific answers → review the exact package → open the employer page and apply yourself → update the tracker → practice and plan learning/follow-ups.

The coordinator maintains durable plans, tasks, leases, outcomes and protected history for 21 specialists. It is not a set of simulated chatbot status cards. Approval remains the default. Assist can prepare drafts/packages; consequential actions stay candidate-controlled. Agentic mode does not enable unsupported submission or sending.

| Area | Implemented working behavior | Limit / unresolved dependency |
| --- | --- | --- |
| Profiles and vault | Optional company/languages/LinkedIn, mandatory criteria, separate VERIFIED / AI_EXTRACTED / INFERRED / UNKNOWN, type-checked confirmation and history | Managed identity owns email, recovery, MFA and sessions; no independent password system or trusted recent-auth assertion |
| Career goals | Confirmed private goals with dates, status and their own planning preferences | A goal never silently edits global mandatory search preferences |
| Resume Studio | Immutable versions, autosave/editor, default selection, archive/restore, three templates, section order/visibility, exact-line differences, local fact indicators, PDF/DOCX/text exports | Upload accepts nothing until private R2, isolated scan/conversion binding and approval are configured. OCR is not connected. Built-in PDF fonts support Latin scripts; other scripts fail clearly and can use DOCX/text |
| Campaigns | Selected owned resume, active/paused/archived state, daily/weekly/manual frequency, roles/locations and experience range | No silent fallback if the selected resume is deleted/archived. Mandatory global rules apply in addition to campaign rules |
| Job intelligence | Attributed manual imports, approved-board adapter, complete-source snapshot validation, destination deduplication, known-closed exclusions, explained nine-factor fit and separate opportunity priority | No job-source credentials/permissions configured; no live vacancies are invented. Semantic duplicate detection and broad market data are not implemented |
| Application preparation | Separate factual drafts, editable cover letter, owned package snapshots, exact expiring approvals, explicit selected answers and job-scoped screening confirmations | Actual employer questions require candidate input. Submission adapter is unavailable. No preparation, approval, redirect or opening a link marks Applied |
| Practice and planning | Private text practice/session history, local self-review, goals, source-linked learning tasks and completed-task counts | Live AI requires approved task/model routing, policy, keys and quotas. Voice/live interview copilot, employer-message sending and OAuth email intelligence remain unavailable |
| Recruiter CRM/calendar | Confirmed manual contacts, observed notes/interactions, unsent drafts, follow-up dates, linked private interview records and IANA time zones | No invented contacts, enrichment, email send or external calendar synchronization. Manual records do not prove provider delivery |
| Alerts | Consent, verification workflow, durable per-channel queue, safe retries/dedupe, immediate pause/unsubscribe cancellation, signed callbacks and configurable HH:mm preparation | Provider accounts/templates/sender/domain, private scheduler service access and separate worker deployment still needed. No alert is marked sent without provider evidence |
| Privacy and usage | Owner-scoped exports, source/conversation deletion, field-name data-use projection, measured tokens/bytes/tasks and notification outcomes | Monetary cost remains unknown without invoices/pricing attribution. Private histories/packages/backups can retain deleted-source copies; no purge/backup deletion promise is implemented |
| Sensitive capabilities | Server-denied admin, billing, public sharing and whole-account deletion where their prerequisites are absent | Trusted role/MFA/recent-auth, payment business requirement, revocable sharing and retention/legal/operator controls are launch blockers |

The example 5:30–8:00 staged daily sequence is not a separately deployed schedule for every specialist. The current preparation time is configurable, defaults to the existing 07:30 before the 08:00 digest, and runs a bounded coordinated plan. No unattended worker has been deployed by this update. Large-scale fair scheduling, retention and performance require additional work.

## Main source and database changes

| Source | Purpose |
| --- | --- |
| `lib/career-agent-contract.ts`, `career-orchestrator.ts`, `career-agent-matching.ts`, `career-intelligence.ts` | 22 responsibilities, durable coordination, local fact/learning/networking/cost evidence, mandatory filters, separate priority and server-approved model routing |
| `lib/career-agent-store.ts`, `career-platform-store.ts` | Private goals/learning/CRM/calendar, proposals, expiring answers, explicit job-scoped package selection, CAS revisions and approval invalidation |
| `lib/career-core.ts`, `career-store.ts`, `career-resume-tools.ts` | Typed optional preferences, owner-controlled archive/versions, bounded section/difference/export tools |
| `app/api/career/[...path]/route.ts` | Session/ownership/origin/rate gates, platform CRUD/history/export and authorized document exports/analysis/variants |
| `app/ui/workspace.tsx`, `career-platform-tools.tsx`, `agent-command-center.tsx`, `resume-toolkit.tsx`, `career-tools.tsx`, `career-view-types.ts` | Existing workspace extended with goals/vault/search/review/learning/CRM/calendar/privacy, Today’s Actions, persistent kill switch and resume review/export tools |
| `app/ui/public.tsx`, `app/globals.css` | Original feature/about/account-entry pages and reusable light controls; existing branding/routes preserved |
| `db/schema.ts`, `drizzle/0006_chilly_scourge.sql`, matching journal/snapshot | Additive six-table planning/history extension and resume/campaign/answer columns: 40 tables total; legacy disabled campaigns backfilled as paused |
| `.env.example`, `package.json`, lockfile | Placeholder-only server routing configuration; pinned maintained document export libraries; repeatable checks |

Architecture, complete page map, permissions and workflow diagrams: [workflows](platform-workflows.md) and [README](../README.md). New API reference: [OpenAPI](platform-api.openapi.json). Detailed database/types/retention rules: [data guide](platform-data.md). Official feature/integration research and cost formulas: [research/cost guide](platform-research-costs.md). Failure mechanisms and controls: [12-mode FMEA](platform-fmea.md).

## Run and verify locally

Use fictional data only. Node 24.16.0 was used; package minimum is 22.13.0. From the existing site checkout:

```powershell
npm run install:ci
npm run build
```

On this host’s broken npm launcher, set `$env:npm_execpath = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'` and run `node scripts/install-ci.mjs` / `node scripts/run-framework.mjs build` directly. Do not expose the localhost development identity to the internet.

Apply **only pending migrations, once in order**. For the existing local 0000–0005 database:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_chilly_scourge.sql
npm run dev
```

Open `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/dashboard`. A new local database needs all seven migrations listed in README; do not replay existing ones. Hosted migrations run through the native Sites release flow, not this localhost command.

```powershell
npm test
npm run typecheck
npm run test:platform:http
node tests/http-smoke.mjs
npm run test:platform:browser
npm run test:agents:browser
node tests/upgrade-browser-smoke.mjs
python tests/verify-export-files.py
```

Run HTTP/browser suites **sequentially** against the fixed synthetic account. Each preserves its initial preferences/settings and removes its fixtures; private labelled test history can remain locally. Python export parsing needs pypdf/fitz. Browser testing needs installed Playwright/Edge; the current host variables are listed in README. This does not demonstrate hosted multi-user identity behavior.

After build, start the built Worker at 8787 with `npm start`, then run `node tests/header-smoke.mjs`. Set `CAREER_HEADER_RESULTS=docs/platform-header-results.json` to preserve historical evidence. Set `CAREER_SECRET_RESULTS=docs/platform-secret-results.json` before `node tests/release-secrets.mjs`. Processor tests run inside `services/document-processor` with `python -B -m unittest test_processor.py`; they are policy tests, not a live scanner test.

Actual counts, commands, failures repaired and untested areas are recorded in [verification](platform-test-results.md). Passing unit tests is not an ASVS certification or broad-launch approval.

## Security controls and evidence boundaries

The baseline remains the official **OWASP ASVS 5.0.0**, currently identified as the stable release by the [official project release](https://github.com/OWASP/ASVS/releases/tag/latest). The prior [requirement-ID register](update-handover.md#asvs-level-2-control-checklist) remains applicable. This is a partial implementation/evidence register, not a completed review of every Level 1/2 requirement.

| Control | Status | Evidence / remaining work |
| --- | --- | --- |
| Owned profile/resume/job/run/package/CRM/calendar/learning/history/export access | Implemented and tested locally | Two-owner actual-SQL tests plus anonymous HTTP denials. Hosted two-session tests and storage/CDN checks remain required |
| Strict server validation, safe text/SQL, request sizes, URL schemes and fixed outbound sources | Implemented and tested locally | Malformed/mass-assigned inputs, malicious document text, cross-job screening keys and missing provider secrets fail closed |
| Revisions, exact package hashes, approval expiry, answer freshness and pause recheck | Implemented and tested locally | CAS/concurrent storage cases, stale approvals/runs, user pause before external attempt and scoped screening regressions |
| Original preservation / protected exports | Implemented and tested locally | Variants are separate; active archive denied; actual PDF/DOCX/text bytes and independently parsed fixtures. Office/ATS interoperability corpus remains untested |
| Upload scan/isolation / encrypted private storage and backup | Externally required | Envelope/policy checks and private service source exist; real malware corpus, Linux limits, private tunnel, storage/backups and retention require operator evidence |
| AI prompt/output boundary and task model policy | Implemented and tested locally, partial | No model tools for DB/money/submission; approved route/allowlist/budgets and structured factual evidence validation. Live approved-model adversarial evaluation remains required |
| Consent/destination verification/idempotent digests and signed callbacks | Implemented and tested locally | Fixture provider responses, duplicate/concurrent queue and opt-out tests. Real provider sandbox/delivery/STOP/callback acceptance still required |
| Session cookie attributes, logout/recovery, MFA and recent authentication | Externally required | Managed identity unchanged; sensitive unavailable functions denied. Obtain trusted provider evidence; verification messages are not MFA |
| CSP/framing/no-store and secret exclusion | Implemented and tested on built localhost Worker, partial | Nonce hydration and injected inline script rejection; heuristic bundle/source scan. Exact hosted TLS/headers/dispatch and operator-secret permissions still need review |
| Retention, monitored security contact, spending alerts, independent review, restore and load | Externally required | Guides/FMEA and measured owned records exist; no operational delivery, restore drill or load result invented |
| Payments, public sharing and role-changing admin actions | Not applicable while disabled | No checkout/card data/paid entitlement or public link. Additional official integration, server verification and security controls required before enablement |

Known dependency findings are disclosed in the test guide. Keep this build private with test data; no broad launch or sensitive-data collection is recommended from local evidence alone.

## External setup – exact activation gates

1. **Hosting and identity:** retain the original Site ID, `DB` and private `BUCKET` bindings and owner-private audience. Keep R2 public development URLs/custom public access off. Use HTTPS and individual MFA-protected operator accounts. Verify trusted dispatch identity, host-scoped secure cookies, session expiry/logout/recovery, rate/bot controls, certificates and renewal. Configure a monitored security contact and actual incident alerts; no address was invented.
2. **Jobs:** install `CAREER_JOBS_ENABLED` and `GREENHOUSE_BOARDS_JSON` only after employer/source approval. Each configured board needs company, board token, rights record, display/digest/AI permission and retention terms. LinkedIn/Indeed/Naukri/LoopCV and other licensed sources remain Not Connected until authoritative schemas, countries, rights and quotas are approved. No scraping or guessed adapter is used.
3. **AI:** use native server secret storage for `OPENAI_API_KEY`. Configure data-policy approval, `AI_ALLOWED_MODELS`, per-specialist `AI_TASK_ROUTES_JSON`, output/time/request/user/global quotas and provider-account spending controls. Empty/missing routes use labelled local self-review. Only the maintained OpenAI adapter is implemented; another provider needs its adapter and tests.
4. **Uploads:** deploy the isolated processor source, private scan/conversion service and authenticated bridge, resource/decompression/time limits and malware signatures. Add the private `CAREER_DOCUMENT_PROCESSOR` binding and keep `DOCUMENT_PROCESSOR_APPROVED=false` until verified. Optional OCR remains separate. Flags cannot create an unavailable private binding.
5. **Email/WhatsApp:** verify the email domain/sender, callback secret and destination workflow. Obtain official WhatsApp Business sender/app permissions, current API version and approved digest/verification templates. Store independent tokens/secrets server-side; install public signed callbacks on the separate relay. Record separate candidate consent and test provider acceptance/delivery, unsubscribe/STOP and duplicate events before enabling dispatch.
6. **Scheduler:** copy `worker/wrangler.scheduler.example.jsonc` to the ignored operator config, set the real site origin, independent scheduler secret and explicitly authorized private service credential. Deploy the every-minute Worker. Configure callback/relay origin and matching site secret through native environment settings. Verify an actual scheduled run and denied wrong-secret request. Source/configuration is delivered; this worker and service authorization are not deployed by this update.
7. **Optional features:** voice, live copilot, email intelligence, external calendars, recruiter sending, public sharing, trusted admin roles and whole-account deletion need additional supported access/consent/security implementations. Do not enable a sensitive feature through a browser flag. Payments remain disabled and no paid plans/prices are introduced; hosted checkout/server final-payment verification, signed idempotent events, refunds/reconciliation and PCI responsibility review are a separate prerequisite.

Detailed provider/worker commands: [integration deployment guide](integrations-update.md) and [processor setup](../services/document-processor/README.md). `.env.example` contains names/placeholders, never real keys; copying it locally does not configure hosted secrets.

## Deployment, rollback and maintenance

Keep the current native Sites project and URL. Build/test, then use the Sites workflow helper to commit/push the exact source and package it using a short-lived credential through hidden stdin. Save/deploy that archive privately, confirm terminal success and inspect the updated schema. Do not publish the audience broadly or deploy a bypass origin. The rollback tag `pre-career-os-2026-10-12` identifies the previous source. Roll back using the previous saved Site version; leave additive database columns/tables intact and preserve user records.

Before a real pilot, take an encrypted database/object backup and restore it into a separate private staging instance. Check owner counts, active/version references, hashes, original/preview objects and pending dispatch state. Hold outbound workers paused during restore, reconcile accepted/uncertain sends before resuming, and record the measured recovery result. This drill was not performed here.

Review dependency/security alerts weekly and release patches through staging; review access, consent, source rights, quotas and retention monthly. Monitor denied ownership, expired leases, queue age, source outages, webhook rejection, delivery failure, mismatched payment events if introduced, and provider spending. Ensure alerts reach an actual operator, rather than merely existing as dashboard counts.

On an incident: pause agents/outbound workers, disable affected provider flags, preserve restricted metadata/audit evidence without copying private documents into ordinary logs, revoke/rotate compromised keys, assess affected owners, patch and retest, restore only verified backups, reconcile ambiguous external actions, and resume through a recorded operator decision. Follow reviewed legal notification obligations for the launch regions. No legal/security/PCI compliance claim follows from this handover.
