> Historical 11 October 2026 handover. Current implementation, status and evidence are in [update handover](update-handover.md), [provider setup](integrations-update.md) and [current test results](test-results.md). This older document does not describe the updated adapters.

# Integration access, production prerequisites, and cost model

Research date: 11 October 2026. This document records verified public documentation and planning assumptions. It does not assert that provider access, production delivery, payment processing, or a security assessment has been completed. Use the release test report for actual implementation and test evidence.

## Reference and launch scope

The supplied brief does not identify a reference career website or URL. The implementation therefore follows the supplied feature requirements with original wording and design. A comparison with a named reference remains an evidence gap.

Live job sources, outgoing email/WhatsApp, provider AI, document processing, and billing must stay disabled until their access, credentials, server controls, and acceptance tests are ready. Demonstration data must remain labelled. Do not accept real resumes into a demonstration upload workflow.

## Job sources

| Source | Verified capability | Required next step | Current launch decision |
| --- | --- | --- | --- |
| Indeed | Its partner Publisher JavaScript Plugin displays job cards for specified search terms and locations. Its Job Sync API creates and manages an ATS partner's postings; it is not a general vacancy feed. | Become a partner, request plugin access from the representative, obtain app/placement identifiers, register HTTPS test and production domains, and confirm launch-country coverage. Obtain written permission for any separate storage, AI processing, matching, or digest redistribution. | Awaiting approved access; no scraping or guessed API endpoints. |
| Naukri | A general-purpose licensed discovery feed and public developer onboarding for this product were not verified. Its main terms page could not be read through the research tool. | Ask Naukri/Info Edge for the applicable commercial agreement, supported endpoints, permitted description use, attribution, retention, fees, limits, and notification rights. | Awaiting written approval. Lack of verified documentation is not proof that no private partnership exists. |
| Company feeds | May be suitable when the company authorizes use. | Record the agreement, authorized domains, permitted fields, refresh cadence, attribution, expiry and AI/redistribution rights for each feed. | Enable individually after approval and validation. |
| User-supplied descriptions | Users can supply a description for tailoring and manual application tracking. | Label it manually imported, record its origin, and require the user to confirm source and facts. Do not automatically fetch arbitrary links. | Permitted alternative; it does not prove a vacancy is current. |

Indeed explicitly requires partnership before plugin access. The plugin renders its own UI and should not be treated as an export interface. [Indeed Publisher Plugin](https://docs.indeed.com/indeed-plus/publisher-js-plugin). Job Sync requires a developer agreement, formal request, testing and review. [Job Sync onboarding](https://docs.indeed.com/job-sync-api/integrate-with-job-sync-api).

For each contracted feed, retain: contract owner, allowed territories, AI-processing permission, display/digest permission, price, quota, retention, refresh timestamp, incident contact and expiry. Never infer these rights from public visibility of job descriptions. Deduplicate by stable source ID and normalized content; preserve provenance. Unavailable sources and an empty result are different states.

## WhatsApp Business Platform

Proactive daily messages require an approved template, explicit opt-in, a valid verified destination and a functioning opt-out. Outside the 24-hour customer-service window, Meta permits only approved templates. Templates may be reviewed, paused or rejected; approval is a dependency rather than a guarantee. [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/).

Production setup: create/verify the appropriate Meta business assets and WhatsApp account; register the sender; configure a least-privilege server token, app secret and webhook verification token; submit the actual digest template and language; configure billing and a signed HTTPS delivery callback; validate delivery, failed delivery and unsubscribe events with test recipients. Confirm applicable account-specific messaging limits. Meta's official API collection documents registered business phone numbers and bearer-token requests. [Meta Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

Do not promise a template category or India unit price before Meta/provider approval. Public rates vary by recipient market and message category, and are based on delivered messages. The exact current account/rate-card amount was not independently retrieved during this build. Obtain the current rate card in the provider dashboard and include any provider markup. [Official platform pricing](https://whatsappbusiness.com/products/platform-pricing/).

Keep resume text and contact details out of digests beyond the verified destination and necessary message personalization. Use a short job list and an authenticated dashboard link. A provider acceptance response is not delivery confirmation.

## Email through Resend

Verify an owned sending domain before real sending. Prefer separate account and digest subdomains; install the exact SPF/DKIM records shown by Resend, add a reviewed DMARC policy, and keep tracking disabled for recovery links. [Verified domains](https://resend.com/docs/dashboard/domains/introduction). Record email consent, include company identity and a frictionless unsubscribe, and suppress bounced/complaining recipients. Resend requires explicit opt-in. [Acceptable Use Policy](https://resend.com/legal/acceptable-use).

Use a server-only restricted sending key. Verify delivery callbacks with the official Resend SDK using the untouched request body and Svix headers; durably deduplicate events before updating history. [Webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests). Resend send idempotency keys expire after 24 hours, so database deduplication must persist longer than this window. [Send Email API](https://resend.com/docs/api-reference/emails/send-email).

The public pricing page currently lists Free at 3,000 emails/month and 100/day, Pro at USD 20/month for 50,000, and Scale at USD 90/month for 100,000, with USD 0.90 per additional 1,000 at the illustrated entry tiers. Reconfirm the appropriate product/plan for personal job digests and the account's send throughput before launch. A free plan leaves no capacity for account mail when all 100 users receive daily messages. [Resend pricing](https://resend.com/pricing).

## Hosted payments

Billing is optional and remains disabled until the core product and payment acceptance tests pass. Stripe India currently requires an invitation for a new account; account availability must be resolved before selecting it for an Indian merchant. [Stripe India availability](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india).

Use Stripe-hosted Checkout from a server-created order and trusted price records. Keep integer amounts in the currency's required minor units. Never receive raw card data. Before granting purchased access, retrieve current provider state and compare merchant account, environment, order, customer, amount and currency; require final paid status, account for refunds/disputes, and leave uncertainty pending. A completed browser flow is insufficient. [Hosted Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).

Configure a public HTTPS webhook with the official SDK and raw body signature verification; persist an event ID with a unique constraint and durable work item before acknowledging it. Stripe can retry and deliver events out of order. Reconcile current objects rather than ordering by event timestamp, and never allow a late success event to restore refunded access. Configure only required events and separate live/test credentials. [Stripe webhook guide](https://docs.stripe.com/webhooks).

External steps: complete merchant/KYC approval; confirm currencies, settlement, refund and subscription capabilities; create production products/prices; configure live and test endpoints separately; restrict dashboard roles and enforce administrator MFA; configure payment-mismatch, signature-failure and processing-backlog alerts; review PCI responsibilities with the acquiring bank/provider. Fees, taxes, currency conversion, dispute fees and recurring-billing add-ons are excluded from the cost table. Do not claim PCI compliance from hosted Checkout alone.

## Cloudflare deployment controls and release limits

The selected stack uses a React/Vinext interface, Workers for server logic, D1 for relational records, private R2 for documents, and Queues/Cron for background work. Workers bindings keep database/storage access on the server. Use separate staging/production bindings and encrypted secret bindings, never public frontend variables. [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

1. Put the private test deployment behind authenticated access. Restrict production origins and redirect hosts, enforce HTTPS and reviewed CSP, and configure CPU/rate/spending limits. Store no private account response in shared caches.
2. Leave both R2 public development URLs and public custom bucket domains disabled. Serve each document only after an authenticated ownership or unexpired share permission check. Public bucket settings bypass application ownership logic. [R2 public access](https://developers.cloudflare.com/r2/buckets/public-buckets/).
3. Treat Queues as at-least-once delivery. Persist a unique digest key per user/local date/channel/schedule revision; independently retry channels. Keep jobs already sent in a durable table. Recheck latest consent immediately before each send, and cancel unsent work on revocation. For providers without sufficient idempotency support, reconcile an ambiguous timeout before retrying; do not claim exactly-once external delivery. [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).
4. Cron uses UTC. Run a scheduler regularly and calculate each user's next local 08:00 from their IANA time zone, including daylight-saving changes. 08:00 Asia/Kolkata corresponds to 02:30 UTC. Refresh sources before dispatch; record actual acceptance and delivery separately. [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
5. Add an isolated malware scanner/converter with bounded memory, CPU, runtime and decompression, a restricted network, private temporary storage and patching. Ordinary application routes are insufficient for unsafe document conversion. Quarantine until validation and scanning pass; failed conversion must preserve the previous active resume. Keep upload/processing disabled until this component is validated.
6. D1 Time Travel provides 30 days on Paid and 7 days on Free. Maintain additional encrypted, access-restricted exports and a tested document backup process; a provider backup capability is not proof of recovery. Practice restore on disposable staging data and preserve deletion tombstones so a restore does not silently reintroduce deleted personal data. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/). D1 has finite database limits; measure size and query work before choosing a partition/migration plan. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
7. Vinext is under active development and its official README identifies compatibility gaps. Verify the exact locked framework version, route handlers, authentication, caching and Workers build in staging before sensitive production use. [Vinext project status](https://github.com/cloudflare/vinext).

OWASP identifies ASVS 5.0.0 as the current stable release. Use its Level 2 and applicable Level 1 controls for a requirement-by-requirement implementation/evidence matrix; document exclusions. A partial checklist or automated scan does not establish ASVS compliance. [Official ASVS releases](https://github.com/OWASP/ASVS/releases).

## Conservative monthly operating budget

These are planning allowances in USD, not quotations or measured production costs. They describe a future fully connected text-first product; disabled connections incur no delivery/AI fees. No exchange rate is assumed. Taxes, domain, salaries, customer support labour, independent security/legal review, job-feed licences, gateway charges, and substantial voice/OCR usage are excluded.

Assume a 30-day month, all active users opt into both channels, 30 digests plus 2 account emails per user, 20 text AI requests/user, 1,000 dynamic requests/user at an assumed mean 20 ms CPU, and 50 MB of retained files/user. Assume notification work items under 64 KB and approximately three queue operations each; extra retries and larger items cost more. Use an initial USD 0.01 allowance per AI request and per delivered WhatsApp digest. These two values are budgeting assumptions, not verified provider rates. Increase them to match the approved template, model, token volumes, context length and provider quote.

| Monthly item | 100 active users | 1,000 active users | 10,000 active users |
| --- | ---: | ---: | ---: |
| App/database/private storage/queue/monitoring reserve | 25 | 50 | 150 |
| Isolated scan/conversion/backup reserve | 10 | 50 | 250 |
| Email illustration | 20 | 20 | 288 |
| Text AI allowance | 20 | 200 | 2,000 |
| WhatsApp allowance | 30 | 300 | 3,000 |
| Subtotal | **105** | **620** | **5,688** |
| Planning budget including approximately 30% contingency, rounded upward | **140** | **810** | **7,400** |

Email volumes are 3,200 / 32,000 / 320,000 per month. The final column illustrates Scale 100,000 plus 220,000 overage: `90 + 220 × 0.90 = 288`. The first two use a paid plan to reserve account-email capacity. This is not a claim that Scale is the cheapest eligible plan; confirm actual entitlement and classification with Resend.

AI cost is `active users × 20 × average measured cost/request`. WhatsApp cost is `delivered digests × approved market/category rate + provider fixed fees/markup`. For example, if the actual WhatsApp rate is USD 0.03 instead of the placeholder 0.01, add USD 60 / 600 / 6,000 per month. For AI, compute input/output/cached/audio tokens separately from the model's current contracted rates and enforce a monthly hard spending cap.

Published infrastructure baselines provide a useful check: Workers Paid starts at USD 5 with request/CPU allowances; D1 Paid includes 25 billion reads, 50 million writes and 5 GB; R2 Standard is USD 0.015/GB-month plus operations; Queues includes one million monthly operations and charges USD 0.40/million additional. The table deliberately reserves more for monitoring, retries and recovery rather than claiming that this product costs only USD 5. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Queue pricing](https://developers.cloudflare.com/queues/platform/pricing/).

Validate budgets against a stated staging load: concurrent sessions, dynamic requests, CPU percentiles, rows read/written, retained bytes, scan duration, queue retries, delivery failures and AI token distribution. Do not derive a performance guarantee from monthly active-user totals. Revisit limits/costs weekly during pilot and monthly after stabilization. Launch free core tools first; set paid prices only after measured usage and feed/provider quotes establish sustainable margins.

## Unresolved dependencies

The named reference URL; approved/licensed discovery and redistribution rights; real identity provider and administrator MFA configuration; verified messaging destinations/domain and consent flows; approved WhatsApp sender/template; production AI model/data handling contract; isolated document scanner/converter and validation corpus; merchant approval and paid-state reconciliation; staging isolation; privacy/retention review for launch locations; actual backup restoration, adversarial upload, cross-user authorization and payment-event tests; independent security review; and measured load/cost results remain required where not evidenced in the release report.

