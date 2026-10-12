# Public product review, integration access and operating budget

Verified official pages reviewed 12 October 2026. Public product descriptions establish advertised workflows, not independently measured outcomes or permission for this application to reuse data or automate another platform. Original wording/design are used; customer logos, outcome claims, application totals and testimonials have not been copied. This guide supersedes the older cost scenario in `integrations-costs.md`.

## Public reference workflows

| Reference | Verified public workflow | Practical improvement adopted / access boundary |
| --- | --- | --- |
| Resodro | Profile/goals support discovery, resume and cover-letter help, interview preparation and career guidance. Its resume page describes importing or creating a resume, choosing targets, refinement and export. [Public platform](https://resodro.ai/), [resume workflow](https://resodro.ai/ai-resume-builder), [FAQ](https://resodro.ai/frequently-asked-questions). | Keep a reviewed fact vault, selected version lineage and unknowns visible. No public embedding/API contract was established in this review. |
| AutoApplier | Describes browser/cloud job agents with preferences, tailored materials and application tracking; its terms discuss form/upload/submission automation. [Platform](https://www.autoapplier.com/), [agent workflow](https://www.autoapplier.com/agent), [terms](https://www.autoapplier.com/legal/terms-of-service). | Separate preparation from a supported explicitly approved submission. Its own browser automation and claims do not grant this application third-party platform access. No verified developer contract here. |
| Sonara | Describes personalized background application assistance with preferences and a queue. Its terms describe role/location/pay filters and user job removal/feedback. [Platform](https://www.sonara.ai/), [terms](https://www.sonara.ai/terms-conditions). | Keep source attribution, mandatory filters, exact approval and actual rather than inferred submission state. No authorized developer integration was established. |
| AIApply | Its help describes profile/preferences, selected-base job tailoring and Review/Hybrid/Auto modes with application materials/questions and answer reuse. [Auto Apply help](https://support.aiapply.co/en/articles/15692576-how-auto-apply-works), [job-search help](https://support.aiapply.co/en/articles/16889656-how-to-use-the-job-search-section). | Approval defaults, expiring screening answers and distinct selected campaign resumes improve control. Its internal job collection is not a licence for our discovery or AI use; no developer search access verified. |
| Jobright | Describes matching/coaching, tailored resumes, insider contacts and automation. Its employer service describes recruiting/ATS workflows. [About](https://jobright.ai/about), [candidate platform](https://jobright.ai/), [employer service](https://jobright.ai/employers). | Our networking uses actual manually saved CRM contacts, not invented referrals. An employer service or API-like hostname is not evidence of an authorized candidate-search embedding contract. |
| JobCopilot | Describes CV/answer reuse, separate job searches, company career sites, review versus automated application and tracking. Its responsible-use page discusses review/control/traceability. [Workflow](https://jobcopilot.com/automate-job-applications/), [responsible-use description](https://jobcopilot.com/responsible-ai-job-applications/). | Use independent campaigns, action-scoped review and immutable private manifests. Public automatic-application features do not establish our permission or a supported submission adapter. |
| LoopCV | Describes preference-driven loops, matching/application/tracking, and advertises partner job/resume/application interfaces. Its developer page states separate agreement/authorization for application actions. [Auto Apply](https://www.loopcv.pro/autoapply/), [developer offer](https://www.loopcv.pro/developers/). | Access may be available commercially, but authoritative authentication, schemas, rights and quotas need agreement. Keep it Not Connected until verified; no guessed API is implemented. |

LoopCV's developer marketing contains a bearer-token `/v1/jobs` example; its linked reference documents `https://b2b-api.loopcv.com/connect/loop`, `/connect/loops` and `X-API-KEY`, including loop title/location/type/level. These are different interfaces, and the reviewed loop reference does not establish a complete job-result integration schema for this application. Obtain the authoritative current contract, authenticated-candidate consent/revocation, source redistribution/digest/AI rights, quota and retention terms before coding an adapter. [Official linked LoopCV API reference](https://api-docs.loopcv.com/reference/api-reference/loops).

These reviews do not assert that an API is absent from a company; they state that approved relevant access was not established for this application. Marketing statistics, security/compliance claims and reported user outcomes were not independently audited and are not used as product proof.

## Genuine sources and outbound channels

| Service | Verified interface / implemented status | Still needed before live enablement |
| --- | --- | --- |
| Greenhouse Job Board API | Official unauthenticated board GET; current server adapter uses fixed authorized boards and complete snapshot validation. POST requires an employer Job Board API key and is not implemented as candidate submission. [Official documentation](https://docs.greenhouse.io/job-board.html). | Explicit employer/display/digest/AI permission records, permitted retention and staging. Public GET does not establish unlimited reuse rights. List `updated_at` is not posting time; fields absent from the list remain null. |
| Indeed | Job Sync documents ATS partner posting; partner publisher interface documents separately approved publisher use. Neither proves an open arbitrary job-search feed for our product. [Job Sync](https://docs.indeed.com/job-sync-api/integrate-with-job-sync-api), [publisher access](https://docs.indeed.com/indeed-plus/publisher-js-plugin). | Approved discovery interface plus display, notification and AI rights, quotas/retention. Not Connected; no scraping fallback. |
| Naukri | Official recruiter material concerns candidate-resume search and is not a licensed candidate job-discovery interface. [Official recruiter material](https://www.naukri.com/blog/recruiter-resdex/). | Relevant approved job-search/feed account and written permitted use; no unverified endpoint. Not Connected. |
| Resend | Official maintained SDK, verified-domain email and signed callbacks are implemented with server secrets and durable acceptance/delivery states. [Domain setup](https://resend.com/docs/dashboard/domains/introduction), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests). | Sending domain/DNS and restricted key, actual callback endpoint/signing secret, opt-in/destination verification, unsubscribe and staged delivery. Provider quota/rate policies still apply. |
| WhatsApp Business Platform | Official sender/template requests and signature-verified delivery callbacks; destination-code verification and independent opt-in required. [Business messaging policy](https://whatsappbusiness.com/policy/), [official platform](https://business.whatsapp.com/products/business-platform). | Registered sender/business setup, current supported Graph version, approved digest/authentication templates/language and actual consent. Template acceptance is not delivery. No unofficial personal-WhatsApp automation. |

No actual employer submissions, recruiter messages, emails or WhatsApp messages were sent during this implementation. The external scheduler/callback relay needs separate deployment and its private service credential. Source and channel failures remain independently recorded, with unavailable source, no new suitable jobs, failed, uncertain, accepted and delivered states distinct. See [exact server configuration/setup](integrations-update.md) and [workflow gates](platform-workflows.md).

## Cost basis and verified rates

The following is a **planning scenario**, not a measured bill or a quote for native Sites hosting. Prices are USD before tax, foreign exchange, enterprise discounts or future changes. Self-managed Cloudflare published rates are reference inputs; the native Sites host's commercial billing and capability limits require its own confirmation.

| Reference rate checked 12 October 2026 | Scenario use |
| --- | --- |
| Workers paid minimum$5/month;10million requests and30million CPU-ms included; extra$0.30/million requests and$0.02/million CPU-ms. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/). | Self-managed reference with dynamic calls only; actual CPU/load has not been measured. |
| D1 paid allowance25billion reads,50million writes and5GB; extra$0.001/million reads,$1/million writes,$0.75/GB-month. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). | Assume indexed read/write totals stay within paid allowances; include estimated database storage beyond5GB. This is not evidence that limits or capacity suffice. |
| R2 Standard$0.015/GB-month;10GB free storage; operation allowances/rates apply. [R2 pricing](https://developers.cloudflare.com/r2/pricing/). | Estimate storage; assume operations within included allowances. Originals/previews/backups must be measured separately. |
| Resend Pro$20/month includes50,000 emails; extra$0.90/1,000. Free is3,000/month and100/day. Paid overages must be enabled and billed in1,000-email buckets. [Resend pricing](https://resend.com/pricing?product=transactional). | Use Pro plus enabled overage, with consent/unsubscribe and appropriate service policy. A daily100-user digest plus verification exceeds a100/day free ceiling. |
| GPT-6 Luna Standard short-context input$0.10/output$0.50 per1million tokens. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-6-luna). | Illustrative70% request mix after factual/latency evaluation, not automatically configured. |
| GPT-6.1 Sol Standard short-context input$2/output$10 per1million tokens. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol). | Illustrative30% request mix; an approved task route/global allowlist remains required. |
| WhatsApp pricing is per delivered message by recipient market and category. A current account-specific India/category rate was not verified from the retrieved pricing page. [Meta pricing](https://whatsappbusiness.com/products/platform-pricing/). | Use a clearly unverified$0.01/message **budget allowance** below, then replace it with the approved actual market/template rate and provider fee. |

The AI scenario excludes tool calls, audio/video, regional premiums, long-context premiums and Fast mode. No cache discount is assumed. Output allowance must include any billable reasoning tokens. Batch/Flex discounts are not assumed because no such workflow is implemented. Actual per-task model quality must be evaluated before choosing a cheaper model; low price alone does not establish factual suitability.

## Usage assumptions and formulas

For N monthly active users and a 30-day month:

- 40 paid text-generation requests per user/month, averaging4,000 input and1,000 output tokens. This is a usage assumption, not observed activity. It does not mean every specialist or every daily campaign uses paid generation; remaining local tasks/self-review remain available.
- 70% Luna and30% Sol mix. Per-user AI estimate is `40 × [0.7 × (4000×0.10 + 1000×0.50)/1,000,000 + 0.3 × (4000×2 + 1000×10)/1,000,000] = $0.2412`.
- Both channels opted in: at most30 job digests plus2 account/verification emails per user; email count32N and WhatsApp digest count30N. Actual no-new-job/opt-out behavior can reduce volume; verification/resends/WhatsApp authentication fees can increase it.
- 50MB decimal retained object storage/user=`0.05GB`;2MB decimal database/user=`0.002GB`. Converted previews, many versions, private manifests and backups may exceed these assumptions.
- 1,000 dynamic requests/user/month at assumed20CPU-ms each, plus43,200 every-minute scheduler calls/month. CPU budget is `20 × (1000N+43200) ms`; measured CPU/scan cost may differ substantially.
- R2 storage is `max(0,0.05N−10)×0.015`; D1 storage is `max(0,0.002N−5)×0.75` under the referenced paid allowance.
- Email is `$20 + ceil(max(0,32N−50000)/1000)×$0.90` with approved enabled overages. WhatsApp actual formula is `delivered digest count × approved market/category rate + authentication/verification + provider fees`; the budget table substitutes an unverified$0.01 allowance only for planning.
- Unquoted reserves for private scan/conversion/OCR/backup processing are$10/$50/$250 and operations/monitoring are$25/$50/$150. These are assumptions, not vendor prices or a claim that every needed hosting service is purchased.
- Add30% contingency after those reserves and the messaging allowance. Domain, licensed-source contracts, native hosting fees, paid support/staff, legal/security reviews, insurance, tax and payment fees remain unquoted/excluded. Do not set subscription prices from this scenario alone.

## Estimated monthly scenario

| Component | 100 users | 1,000 users | 10,000 users |
| --- | ---: | ---: | ---: |
| AI at stated token/model mix | $24.12 | $241.20 | $2,412.00 |
| Self-managed Workers reference | $5.00 | $5.00 | $8.43 |
| Resend at32N emails | $20.00 | $20.00 | $263.00 |
| Assumed R2 storage | $0.00 | $0.60 | $7.35 |
| Assumed D1 storage | $0.00 | $0.00 | $11.25 |
| WhatsApp **unverified budget allowance** | $30.00 | $300.00 | $3,000.00 |
| Private processing/backup reserve | $10.00 | $50.00 | $250.00 |
| Operations/monitoring reserve | $25.00 | $50.00 | $150.00 |
| Scenario subtotal | $114.12 | $666.80 | $6,102.03 |
| 30% contingency | $34.24 | $200.04 | $1,830.61 |
| Rounded planning envelope | **about$150/month** | **about$870/month** | **about$7,950/month** |

These totals are useful for sensitivity planning only. For example, doubling generation usage adds about$24/$241/$2,412 before contingency at this mix; routing every request to Sol raises AI to$72/$720/$7,200. If the actual WhatsApp rate differs by$0.01, the monthly difference is$30/$300/$3,000 before contingency. A licensed source/hosting contract can dominate those estimates and is not assumed free. No actual rate card or total-cost guarantee is implied by the WhatsApp allowance.

## Measurability and scaling recommendation

Current Cost Control reports owned daily/monthly UTC quota reservations, known total tokens, unknown actual requests, message attempts/acceptance/delivery, document metadata and task outcomes. It returns monetaryCost:null because total tokens lack reliable input/output/model attribution and provider invoices. Provider/account spending alerts and per-plan monthly monetary limits remain external/additional work. Existing per-user/global daily token/request/output limits are enforced server-side; browser plan labels cannot raise them.

The cost table assumes future supported capacity. The current pilot scheduler scans at most10 owners/minute and permits one external call/invocation; it cannot promise preparation for10,000 same-time accounts within a one-hour window. Twenty daily campaigns also reach the200-run cap in ten days without a retention policy. Default global AI quotas intentionally limit exposure and must not be raised merely to match an estimated budget.

Start with the private manual-job journey and a small authorized employer-board cohort. Measure actual tokens, provider acceptance/delivery, tenant queue age, DB reads/writes, CPU, object storage and isolated conversion before setting paid plans. At larger scale use a durable partitioned due queue, per-tenant quotas, separate source refresh snapshots/rights, bounded parallel workers and measured fair scheduling; share a licensed feed snapshot only when its contract permits it, while matching/private state remain tenant-isolated. Benchmark100/1,000/10,000 users with a declared load, failure injection and restore test. Those load/restore results are not present in this release.

Keep hosted checkout, employer submission and recruiter sending disabled until their official integration, consent, idempotency/reconciliation, privacy and security tests are implemented and reviewed. The practical recommendation is to validate factual preparation and owned tracking first, then activate each approved source/channel independently with evidence.
