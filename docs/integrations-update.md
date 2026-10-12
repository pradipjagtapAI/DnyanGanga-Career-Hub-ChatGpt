# Career connections and daily alerts: implementation handover

Reviewed 12 October 2026. This document supersedes the initial integration document's statement that no reference had been supplied. It describes implemented adapters and actual local tests. Configuration is not evidence of a provider connection, approval, live delivery, legal compliance or a security certification.

## Public workflow review

Resodro describes a profile and career goals powering discovery, resume/cover-letter help, interview preparation and career guidance. This product adopts the useful journey while keeping original branding and wording. Its claims about outcomes and usage are not copied. [Resodro public website](https://resodro.ai/), [Resodro FAQ](https://resodro.ai/frequently-asked-questions).

Simplify describes profile-based matching, resume tailoring, application assistance and tracking. Its public application automation is a separate capability; this platform keeps submission under the user's control. [Simplify signup workflow](https://help.simplify.jobs/help/articles/0738509-signing-up-for-simplify), [Simplify Copilot](https://simplify.jobs/copilot).

LoopCV's developer marketing shows a bearer-token `/v1/jobs` example, while its public API reference documents `b2b-api.loopcv.com/connect/loop` and `/connect/loops` with `X-API-KEY`. Those are different interfaces. There is no guessed LoopCV adapter here. Obtain the partner agreement, authoritative endpoint/schema, search/redistribution/AI rights, quotas and retention terms before implementation. [LoopCV developers](https://www.loopcv.pro/developers/), [LoopCV API reference](https://api-docs.loopcv.com/reference/api-reference/loops).

## Genuine job connection

The server adapter uses the official Greenhouse employer-board endpoint: `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true`. GET is public, but that does not establish permission to reuse every company's content. Operators must configure only authorized boards and record separate display, digest and AI permissions. Prospect pools are excluded. The list supplies title, ID, location, URL and description; salary, experience, arrangement and employment type remain unknown when absent. `updated_at` is not treated as a posting date. [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html).

`lib/career-providers.ts` constructs a fixed provider origin from server configuration, rejects redirects, bounds responses to 4 MB and 2,000 listings per board, and validates the complete snapshot before closing missing listings. A failed or partial snapshot leaves previous jobs intact. Upserts preserve each owner's listing ID and attribution. Storage is limited to 500 jobs per account; large feeds may therefore have incomplete local coverage, which must be reviewed before enabling a board. This is genuine provider data when configured; the automated tests use clearly labelled fake responses.

Naukri and Indeed remain unconnected. Indeed's documented Job Sync interface concerns posting from ATS partners, and the partner publisher plugin is not permission to extract, retain or send its content to AI. Obtain approved discovery access and written display/digest/AI rights, rather than scraping. Naukri's applicable discovery feed and terms have not been verified for this product. [Indeed partner publisher access](https://docs.indeed.com/indeed-plus/publisher-js-plugin), [Indeed Job Sync integration](https://docs.indeed.com/job-sync-api/integrate-with-job-sync-api).

Authorized jobs preserve nullable unknown fields. Mandatory filters reject unknown or incompatible mandatory requirements. Scores explain their inputs; description keyword evidence is weaker than explicit requirements and is not an employer-verified skill requirement. Job refresh does not submit applications.

## Native Sites configuration

The site uses the existing Sites identity, D1 database and private R2 binding. Hosted values belong in native Sites `get_environment_variables` / `update_environment_variables`, using the exact `project_id` from `.openai/hosting.json`. Set sensitive entries with `is_secret:true`. Unlisted keys are preserved. Deploy a saved version after updating an environment revision. A local `.env` or an ordinary Cloudflare configuration file does not configure the native Sites production environment.

Current hosted defaults leave `CAREER_JOBS_ENABLED`, `CAREER_ALERTS_ENABLED` and `AI_ENABLED` false. The root public origin is configured. This build does not create provider accounts, populate private service credentials or send real messages.

| Native server entry | Secret? | Meaning / prerequisite |
| --- | --- | --- |
| `CAREER_JOBS_ENABLED` | No | Enable only after board permissions are recorded. Exact value `true`. |
| `GREENHOUSE_BOARDS_JSON` | No | Array of approved board entries; at most 10. Keep the actual contract record elsewhere under controlled access. |
| `CAREER_PUBLIC_ORIGIN` | No | Exact HTTPS application origin, without a path, query or credentials. |
| `CAREER_ALERT_RELAY_ORIGIN` | No | Exact HTTPS origin of the separately deployed callback/unsubscribe Worker. |
| `CAREER_ALERTS_ENABLED` | No | Exact value `true` only after both scheduler and chosen channel pass staging checks. |
| `CAREER_VERIFICATION_SECRET` | **Yes** | Random secret of at least 32 characters. Signs destination-code hashes and unsubscribe links. |
| `CAREER_SCHEDULER_SECRET` | **Yes** | Independent random secret of at least 32 characters, also installed on the external scheduler. |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | **Yes** | Restricted sending key and endpoint-specific webhook signing secret. |
| `RESEND_FROM`, `RESEND_SENDER_VERIFIED` | No | Exact verified sender and explicit operator acknowledgement `true`. |
| `WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | **Yes** | Least-privilege sender token, app signing secret and independently selected callback-verification token. |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` | No | Registered sender ID and a currently supported Graph API version checked in Meta's official dashboard. |
| `WHATSAPP_DIGEST_TEMPLATE`, `WHATSAPP_VERIFICATION_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATES_APPROVED` | No | Actual approved template names/language and explicit acknowledgement `true`. |

Example board registry structure, requiring real authorization before use:

```json
[
  {
    "board": "REPLACE_WITH_AUTHORIZED_BOARD_TOKEN",
    "company": "REPLACE_WITH_VERIFIED_EMPLOYER_NAME",
    "rightsConfigId": "REPLACE_WITH_PERMISSION_RECORD_ID",
    "displayAllowed": true,
    "digestAllowed": false,
    "aiAllowed": false
  }
]
```

Do not toggle `digestAllowed` or `aiAllowed` until the corresponding right is actually approved. The server rechecks current board permissions during every dispatch. Configuration acknowledgements are operator decisions, not automated verification of a contract.

## Email setup

Use an owned, verified domain; install Resend's exact DNS records and review DMARC with the domain operator. Configure a restricted server-only sending key. The adapter uses official `resend@6.32.1`, plain text/escaped HTML, a stable digest idempotency key and unsubscribe headers. Signature verification uses the official SDK with the untouched body and Svix headers. Resend idempotency lasts 24 hours; automatic ambiguous retries are limited to 20 hours and three attempts. The message is frozen durably before the first request and replayed byte-for-byte. Updated facts or sender configuration cancel that retry; idempotency-body conflicts remain uncertain. Do not change the provider account/key while pending acceptance is uncertain; pause and reconcile it first. [Domain setup](https://resend.com/docs/dashboard/domains/introduction), [Node sending](https://resend.com/docs/send-with-nodejs), [Webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [Send/idempotency API](https://resend.com/docs/api-reference/emails/send-email), [Resend error meanings](https://resend.com/docs/api-reference/errors).

Set the Resend webhook URL to `https://YOUR_RELAY_HOST/webhooks/resend`; subscribe to delivery, failure, bounce, complaint and suppression events. Copy its signing secret into native Sites secret storage. `accepted` means the API accepted the request; `delivered` means the recipient mail server accepted delivery, not that the person read it. Failed delivery is terminal in this queue; late failure events do not downgrade an already delivered record. Signed events are still retained for operational review. [Resend event meanings](https://resend.com/docs/webhooks/event-types).

Users verify the signed-in account email through an eight-digit, ten-minute code. Codes are never returned by an API or stored in plaintext; five attempts and three requests/hour/account are enforced. Changing/reverifying a destination resets that channel's consent and enabled state, requiring fresh opt-in.

## WhatsApp setup

Use the official Business Platform, an approved sender and current API version. Scheduled contact outside the customer-service window requires an approved template and explicit opt-in, with an effective opt-out. Confirm the sender's current business verification, permissions, limits, payment setup and template category in Meta; no approval is presumed. [WhatsApp Business Policy](https://whatsappbusiness.com/policy/), [Meta's official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

The digest template must accept one body text variable. The authentication template must support the code body variable and a copy-code button (sent using Meta's URL-button code parameter). Test the exact approved template before enablement. Messages stay within a conservative 1,000-character body variable limit; the short WhatsApp summary links to the full matches and provides STOP/unsubscribe. Missing or mismatched configuration fails safely.

Configure `https://YOUR_RELAY_HOST/webhooks/whatsapp` as the callback, with the exact verification token and subscribed message/delivery events. Incoming payloads are checked with raw-body `X-Hub-Signature-256` HMAC-SHA256 and must reference the configured sender. Signed STOP messages revoke consent and cancel queued work atomically. Provider acceptance and delivery timestamps are separate. Unknown acceptance is kept `uncertain`; it is not blindly retried because this integration does not have documented durable send idempotency. [Meta's signature-validation sample](https://github.com/fbsamples/whatsapp-api-examples/blob/main/signature-validation-with-webhooks-payloads/app.py).

## Server scheduler and private callback relay

The current Sites manifest does not expose a native Cron/Queue deployment binding. A separate Cloudflare Worker is supplied in `worker/scheduler.ts` and `worker/wrangler.scheduler.example.jsonc`. It invokes the authenticated `/api/career/internal/scheduler` endpoint every minute. It relays only fixed provider callback paths and signed unsubscribe links; caller identity/cookies, arbitrary paths, redirects and user-provided fetch URLs are not forwarded.

1. Keep the Sites audience private. Obtain supported private service access through Sites; no token is minted by this build. Its service credential does not grant a candidate identity or notification consent.
2. In a separate authorized Cloudflare account, copy the example to `worker/wrangler.scheduler.jsonc`. Replace `CAREER_SITE_ORIGIN` with the exact site origin and retain `SITES_PRIVATE_AUDIENCE:"true"` for this private deployment.
3. Store `CAREER_SCHEDULER_SECRET` and `SITES_SERVICE_BEARER` in that Worker's secret storage. Install the same scheduler secret in native Sites secret storage. Do not place either in source, configuration files, browser code or logs.
4. Deploy the separate Worker with its one-minute Cron only after external setup is authorized. Confirm no existing schedule runs the same digest before adding it. Use HTTPS callback URLs above and set `CAREER_ALERT_RELAY_ORIGIN` to its public origin. The site remains private; the relay's public unsubscribe path validates a signed, expiring token on the server.
5. Configure Cloudflare rate limits/bot controls for callback endpoints, restrict operator access with MFA, and avoid logging query strings containing unsubscribe tokens or private service credentials. Alert on scheduler HTTP errors, stale scheduler health, failed dispatches and provider quota problems.
6. In private staging, use authorized test destinations to confirm code verification, fresh consent, delivery callback, STOP and one-click unsubscribe. Record actual results before enabling real users. Disable flags immediately if signature or consent checks fail.

For the external deployment only, after the configuration file is prepared, run from `worker/`:

```text
node ../node_modules/wrangler/bin/wrangler.js secret put CAREER_SCHEDULER_SECRET --config wrangler.scheduler.jsonc
node ../node_modules/wrangler/bin/wrangler.js secret put SITES_SERVICE_BEARER --config wrangler.scheduler.jsonc
node ../node_modules/wrangler/bin/wrangler.js deploy --config wrangler.scheduler.jsonc
```

These are setup instructions, not evidence that this Worker was deployed. Cron is UTC; the server uses the user's IANA time zone, default Asia/Kolkata, and 08:00 corresponds to 02:30 UTC there. DST and local-day deduplication are handled through `Intl` and a database unique key. [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Durable queue, safeguards and pilot limits

D1 is the durable outbox: one dispatch per owner/local day/channel, persistent per-channel/per-job reservations, atomic claims, retry limits and a distributed scheduler lease. It records the profile revision and owned active resume ID/version. Changing career context cancels old queued work. Each channel proceeds independently. Sources are freshly checked before dispatch; failed-board cached jobs are not sent. Current consent and the verified destination are loaded immediately before the provider call. An unsubscribe cannot recall a provider request that has already started. Reservations for uncertain attempts remain in place through cancellation/unsubscribe, preventing an unconfirmed send from being sent again the next day. Uncertain acceptance needs provider reconciliation; no exactly-once external-delivery guarantee is made.

Callback acceptance, state changes and the processing marker commit in one transaction. Failed transactions remain retryable; duplicate events and out-of-order terminal events cannot restore a failed delivery or reverse a delivered record. Unknown callback IDs produce a retryable response, covering a callback that arrived before send acceptance was saved.

Statuses distinguish `no_new_jobs`, `source_unavailable`, `queued`, `sending`, `retry`, `accepted`, `delivered`, `failed`, `uncertain` and `cancelled`. No-new-jobs/source failures are recorded without sending a misleading empty success message. Only verified destinations and explicit recorded consent can enable a channel. Candidate status APIs disclose configuration and masked destinations, never secrets. Provider/scheduler health records contain status, timestamps and error codes; administrator access remains disabled pending trusted authorization and MFA.

This is a bounded pilot scheduler: 50 account scans and 30 dispatch attempts per minute, with a 60-minute catch-up window and 120-second leases. These bounds are safeguards, **not measured production capacity**. Fifty users/minute implies at least 200 minutes for a 10,000-account scan, exceeding the catch-up window; 20,000 dual-channel dispatches need at least 667 minutes at the dispatch bound. Large synchronized 08:00 audiences are therefore a release blocker. Add an indexed per-user next-due schedule and scalable approved queue consumers, then measure provider throughput and the stated load before promising larger service levels. Even a pilot must be measured against actual feed sizes and database work.

Original PDF/DOCX upload processing additionally requires a genuinely private isolated scanner/converter binding. That hosting capability is not exposed by the current manifest tools. Keep document processing disabled until the host supports it and the adversarial upload/recovery corpus passes. AI, merchant setup and administrator MFA are separate prerequisites described in their handover documents.

## Actual verification evidence

Executed locally on 12 October 2026, using the checked-in migrations and SQLite prepared statements, injected senders/job responses, and actual Resend SDK signature verification:

```text
node --experimental-strip-types --test tests/provider-alerts.test.mjs
27 tests passed; 0 failed; 907.6258 ms total test duration.

node node_modules/typescript/bin/tsc --noEmit --incremental false
Passed, exit code 0.

node node_modules/eslint/bin/eslint.js lib/career-providers.ts lib/career-alerts.ts worker/scheduler.ts tests/provider-alerts.test.mjs
Passed, exit code 0; no warnings in the verified files.
```

Covered: missing configuration, explicit source rights, fixed origins and redirects, bounded/incomplete feeds, stable IDs, closure and cross-user isolation; nullable unknown data; 08:00 time zones; hashed verification, expiry, attempts, rate limits and single use; repeated/concurrent digest deduplication; maximum job count; independent channels, identical-body email retry, idempotency conflict fences and uncertain WhatsApp acceptance; consent/context cancellation; fresh-source failure; raw-body signatures, callback replay/order and injected transaction rollback; signed STOP/unsubscribe; private relay identity isolation; and expired lease recovery. No real provider credentials, messages, source license, Cloudflare Cron invocation, production D1 transaction behavior, DNS verification, private service access or measured load was tested. The fake Graph version is explicitly test data, never a recommendation for a production API version.

## Costs and release decisions

The historical cost model in `integrations-costs.md` is a planning allowance, not a quotation: approximately USD **140 / 810 / 7,400 monthly** for 100 / 1,000 / 10,000 active users. Assumptions: 30-day month, both channels enabled, 32 emails/user, 30 WhatsApp digests/user, 20 text AI requests/user, 50 MB retained files/user, and roughly 30% contingency. The USD 0.01 average AI request and WhatsApp digest allowances are unverified assumptions; actual model tokens, message category/market/provider markup, source contracts, hosting arrangement and scanner costs must replace them. Taxes, labour, legal/security review, paid job feeds and payment fees are excluded. The 10,000-user figure is a budget scenario, not supported scheduler capacity. Reconfirm provider rates and pilot usage before commercial pricing.

Billing remains disabled. No card credentials, orders, gateway secrets or paid entitlement are processed by these adapters. A future hosted checkout needs merchant approval, server trusted pricing/integer units, signed callbacks, provider paid-state reconciliation and concurrency/refund tests before activation. OWASP ASVS 5.0.0 is the current stable checklist reviewed for Level 2; this handover does not claim verification of all its controls. [Stripe hosted checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [OWASP ASVS releases](https://github.com/OWASP/ASVS/releases).

Recommended next step: a small private pilot with one authorized employer board and an approved email sender, after relay/scheduler setup and actual acceptance tests. Add WhatsApp only after template, destination and STOP tests. Keep live billing and broad sensitive-data collection disabled until the separate security, recovery and load blockers are resolved. Review provider failures and costs daily during the pilot, dependencies weekly, consent/rights and privacy retention monthly; rehearse restore and incident recovery on staging before release.
