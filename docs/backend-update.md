# Backend update and verification — 2026-10-12

This extends the existing managed-identity account workspace without replacing existing records or its first migration. Apply migrations in order: `0000_odd_reptil.sql`, `0001_flippant_talisman.sql`, `0002_clean_whiplash.sql`, `0003_smiling_nightmare.sql`. No tables are created at request time. All private rows carry an owner; database statements bind values and scope reads/writes by that owner. Machine callback/scheduler endpoints authenticate independently before processing and never trust a browser identity or payment success claim.

## What changed

- Salary preferences retain the old amount and add minimum/maximum bounds and an explicit mandatory toggle. Jobs retain absent salary, location, work arrangement, employment type and experience as unknown. Numeric comparisons require declared currency and basis; same-currency monthly/annual amounts use 12 months, with no invented exchange rate or interpretation of a free-text salary.
- Mandatory filters precede all ranking. Exact confirmed skill/terminology alias evidence differs from related transferable skills; the latter stays missing and receives quarter credit. Unstructured description mentions are whole-term matches, capped at 30 skill points, and labeled weak evidence. Confirmed industry, seniority, responsibility and qualification phrases are exposed for review, without an inferred qualification or opaque score.
- Application `Closed` joins existing outcomes and retains submission history. Marking Applied still requires explicit user confirmation. An active resume can be deleted with `confirmActive:true`; this clears its active pointer atomically and falls back to profile matching.
- Private document uploads are bounded at 10 MiB and gated before file bytes are read. Extension/MIME/envelope, encryption, ZIP paths/counts/expansion, macros and active content are checked before immutable quarantine storage. The isolated approved processor must attest the same SHA-256 and clean scan. The separate preview is plain text. Originals download only after checks, only as owner-authorized attachments. Failed processing preserves the active resume. Late preview writes and failed metadata transactions clean up private preview objects.
- Extracted contact information stays separate. Account email cannot change. Phone/WhatsApp changes require separate confirmation. Profile-changing extraction review requires an explicit matching profile revision. Reviewed upload and resume/profile changes commit in one database transaction and never activate a version silently.
- AI requests use owned confirmed profile, active resume, selected job and bounded owned history. Browser-supplied history/context/owners are rejected. Session mode, revision and matching context are checked before provider cost. Requests reserve persistent per-user/global UTC-day usage and a single active lease atomically; failures consume the reservation. Measured token anomalies are retained. Reviewed documents are saved only from the owned validated result; arbitrary replacement prose is rejected. Question and answer remain in bounded history, and interview questions/feedback share one revisioned session.
- Owned exports include current documents, drafts, reviewed documents, AI history/usage and notification data. Conversation/generated-document and uploaded-file deletion are available separately. Underlying account cleanup includes private R2 files and all new owned tables; its public endpoint remains disabled until the identity service supplies trusted recent-authentication verification.

## Additional API contracts

All browser mutations require an exact same origin and `X-Career-Action: 1`; ordinary mutation bodies use JSON. Private responses are `no-store` and ownership-checked.

| Endpoint | Body or response |
|---|---|
| POST `/api/career/documents/upload` | Raw PDF/DOCX MIME body and `X-Career-Filename: encodeURIComponent(filename)`; returns `{ok,id,state}` with visible processing result |
| GET `/api/career/documents/:id/preview` | `{id,text,extracted,status}` after a clean scan |
| GET `/api/career/documents/:id/original` | Unchanged private attachment after a clean scan |
| POST `/api/career/documents/:id/review` | `{title,targetRole,text,applyProfile,profileFields,contactFields?,confirmContacts?,expectedRevision?}`; career fields exclude email/phone/WhatsApp and contacts exclude email |
| DELETE `/api/career/documents/:id` | `{}`; delete upload/preview while preserving reviewed text versions |
| DELETE `/api/career/resumes/:id` | `{confirmActive:true}` is required if that version is active |
| POST `/api/career/jobs/refresh` | `{}`; returns `{ok,refresh,state}` from approved sources |
| POST `/api/career/notifications/verify-request` | `{channel,address}`; returns `{ok,verification:{verificationId,expiresAt,status},state}` |
| POST `/api/career/notifications/verify` | `{id,token}`; verification resets enabled/consent for the channel; new opt-in is required |
| POST `/api/career/ai` | `{mode,prompt?,jobId?,sessionId?,expectedRevision?,question?,answer?}`; returns `{ok,id,sessionId,result,state}` |
| DELETE `/api/career/ai-sessions/:id` | `{}` |
| POST `/api/career/ai-sessions/:id/review` | `{confirmed:true,kind:'resume'|'coverletter',title?,targetRole?}`; saves owned result only |
| GET `/api/career/generated-documents/:id/download` | Owned plain-text cover draft attachment |
| DELETE `/api/career/generated-documents/:id` | `{}` |
| `/api/career/callbacks/resend` or `/whatsapp` | Provider-signed requests; no browser session requirement |
| POST `/api/career/internal/scheduler` | Private service authentication and dedicated server bearer secret |
| `/api/career/notifications/unsubscribe` | Provider-approved signed unsubscribe token; opt-out cancels unsent queued/retry dispatches |

State includes `documents`, `aiSessions` (`id,mode,revision,createdAt,updatedAt,result,history`), `generatedDocuments`, notification history, masked verified destinations and honest integration status. Candidate status responses contain no provider secrets. `adminAccess` remains false; private admin operations remain unavailable because managed identity provides no trusted MFA attestation. Billing and public sharing remain disabled.

## Actual repeatable evidence

Commands were run on Windows with Node 24.16.0 and Python 3.12.10. These are measured results, not external integration claims.

| Command | Result |
|---|---|
| `node --experimental-strip-types --test tests/career-security.test.mjs` | 50 passed, 0 failed; final run 709 ms. Executes actual prepared store SQL against in-memory SQLite with every generated migration. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 0, no diagnostics. |
| `node node_modules/eslint/bin/eslint.js lib/career-core.ts lib/career-store.ts lib/career-documents.ts "app/api/career/[...path]/route.ts" db/schema.ts tests/career-security.test.mjs tests/http-smoke.mjs services/document-processor/bridge.ts` | Exit 0, no warnings or errors in the final run. |
| From `services/document-processor`: `python -B -m unittest test_processor.py` | 8 passed; 0.014 seconds. Real DOCX parsing/section extraction and adversarial policy tests; scanner ordering/failure are mocked. |
| `node node_modules/drizzle-kit/bin.cjs generate` | Generated additive migrations; 21 total tables. |
| `node tests/http-smoke.mjs` with migrated local D1 at `http://127.0.0.1:5173` | Exit 0; 36 checks passed in 7.52 seconds using only fixed synthetic `seedy@sites.test` identity. Created nonce records were removed and initial active selection restored. |

New security regression coverage includes role/owner fields, same-origin/streamed limits, nullable mandatory filters, salary ranges/currencies, exact/related skill evidence, closed applications, immutable originals, foreign document access, scan/hash failure, contact separation, stale review rollback, deletion during processing, failed preview metadata transaction, ZIP paths/macros/encryption/expansion, owner/global AI budgets, stale session context, reviewed provenance, active-last-resume deletion, file cleanup and an actual old-schema account/resume upgrade preserving version 7 before creating version 8.

The HTTP run covered anonymous/header-spoof rejection, private no-store responses, origin/action checks, role tampering, resume versions/restore/downloads, fake payment/deletion claims, raw-upload configuration gate, unknown document ownership, owned manual-job self-review cover drafts/downloads, interview questions-to-feedback revision zero and actual activity metrics, stale-session rejection, confirmed Applied-to-Closed history, tasks/export and JSON body limits. It uses isolated connections for the previously observed local Vite/Miniflare pooled-transport issue. It does not establish two-account HTTP isolation or hosted dispatcher security.

Document scanner/processor tests are mocks at the web-worker boundary. Real ClamAV malware detection, Linux isolation limits, Docker image builds/scans, the private tunnel, Sites service binding, scan retention and backup deletion require external setup and authorized testing. The conservative PDF byte-pattern checks do not fully inspect decoded/decompressed object graphs: the operator must approve a maintained parser and test escaped names, compressed object streams and embedded actions before accepting real documents. Uploads stay disabled without the separately approved scanner/parser boundary. See `services/document-processor/README.md` for the deployable reference and exact contract. Provider/AI module tests and browser evidence are reported in their own handover files. A full multi-user deployed D1 concurrency/load test and independently reviewed ASVS evidence remain pending. The workspace state currently includes full owned resume/job/session content; pagination and measured high-quota response performance are required before broad launch. No security certification, legal compliance, live payment readiness or universal ATS score is claimed.
