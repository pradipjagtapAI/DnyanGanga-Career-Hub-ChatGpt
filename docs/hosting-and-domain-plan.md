# Test → Git → GitHub → Hostinger → Domain → Update

Prepared 13 October 2026 for the existing local repository `E:/Websites/Dnyanganga Career Hub/ChatGPT`. This document records the selected hosting route and verified progress. GitHub is connected; Hostinger DNS and native domain/TLS are active. Authenticated new-host journeys remain unverified while this resolver has the old address cached.

## Current status

| Stage | Verified status | Next dependency |
| --- | --- | --- |
| Test | Fresh local 250 server tests passed; type check, focused lint, Worker build and production dependency audit passed | Hosted identity, provider, restore and load checks remain separate |
| Git | Existing independent repository and six imported revisions preserved; preparation committed as `0de8bd8` | Local Git history and receipt preserved |
| GitHub | Source pushed to the user-selected public repository; actual verification run succeeded | Branch protection remains external setup |
| Hostinger | User selected Hostinger domain/DNS with existing platform hosting; no hosting migration; DNS records applied and exported | Future DNS access remains through the owner account |
| Domain | `dolphincreation.com` attached to the same Site; DNS/TLS Active; 9 post-deployment anonymous perimeter checks passed | Authenticated new-host sign-in, owned data and CSRF acceptance after DNS cache refresh |
| Update | Test/review/version/deploy/verify/rollback procedure prepared | Correct target-specific deployment, never an assumed automatic push |

The existing private website remains `https://dolphin-career-studio.livelymelon2.chatgpt.site`, version 6, same project `appgprj_6acba9a286e8819187fe91a333c9f53f`, one owner and no groups. The original URL and owner-private audience remain. Apex DNS now targets the same Site; saved version 6 was redeployed with only public-origin environment revision 2. No candidate records, files or authentication system were migrated.

## Choose the hosting route

**Selected route: Hostinger domain/DNS + existing platform hosting.** Keep the same Sites application, managed sign-in, D1 database and private R2 binding. Use the supported native custom-domain connection. This is honestly Hostinger domain management, not Hostinger application-server hosting. Do not move or recreate accounts merely to give the platform a new hostname.

**Full Hostinger application hosting:** requires a staged backend/authentication/storage migration first. Hostinger currently supports managed Node apps on Business Web Hosting and its Cloud plans, GitHub/ZIP deployment and Node 22/24. VPS provides control for custom processes and private document processing. These available Node runtimes do not make the current Worker application portable by themselves. [Official managed deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), [VPS/CloudPanel](https://www.hostinger.com/support/9553137-how-to-set-up-a-node-js-application-using-hostinger-cloudpanel/).

The current `npm start` launches a loopback local Wrangler preview, not a production Node server. Do not use it as a Hostinger production command, publish its mock development identity, or upload only `dist/client` and call the account dashboard complete.

The full migration must replace or adapt `cloudflare:workers`, D1 prepared queries/atomic batches/revisions/leases, R2/processor bindings, Worker HTMLRewriter CSP handling and the Sites sign-in/dispatch boundary. The old application trusts authenticated headers supplied by Sites; an ordinary Hostinger request must never be allowed to forge those headers. Use established server-validated authentication and an explicit verified ownership mapping. Email equality alone cannot authorize merging accounts. [Official Vinext deployment](https://github.com/cloudflare/vinext#deployment).

The source copy contains schema and code, not live hosted records, original resumes, sessions, provider secrets or real resource IDs. Obtain authorized exports, preserve IDs and version relationships, transfer private objects with hash comparisons, rehearse restore and two-user isolation, then cut over. Do not delete the current data or reverse additive migrations. [D1 exports](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [R2 S3 access](https://developers.cloudflare.com/r2/get-started/s3/).

## GitHub preparation and access

The user-selected repository is `https://github.com/pradipjagtapAI/DnyanGanga-Career-Hub-ChatGpt` and is publicly readable. It was empty before the non-force push. Source and all prior revisions are uploaded; no private runtime files or hosted user data were uploaded. Repository visibility was not changed. Do not commit environment files, API tokens, private uploads, databases, caches or release archives. The copied `outputs/` folder remains ignored. The existing source history has been reviewed for real credentials; secret-format scans are heuristic and do not replace provider key controls.

Connect GitHub using the suggested integration or an official authenticated client. No password, access token, recovery code or OTP should be pasted into chat or source. If the target repository already has content, fetch and reconcile it; do not force-push or overwrite its unrelated history. Keep collaborators and deployment-app access limited to this repository. Hostinger GitHub app authorization is a separate access decision; avoid authorizing all repositories unnecessarily.

Use the new workflow in `.github/workflows/verify.yml`. It validates source and creates no paid entitlement, hosting service, domain or public audience. A successful GitHub test run is not a production security assessment. Require its successful status on the release branch before promoting a change. Configure branch rules in the selected repository; they have not been applied here.

## Domain connection without migration

1. Confirm the user-owned bare hostname and authoritative DNS provider. A Hostinger-registered domain may use another provider's nameservers. Prefer an intentional subdomain if replacing the apex would affect an existing website.
2. Preserve the exact existing Site ID and owner-private audience. Call native `sites_add_custom_domain` with that ID and the approved hostname. No new Site is needed.
3. Export or record the existing DNS zone first. Copy only the returned CNAME target for a subdomain, apex A targets and exact validation records. Do not guess an IP or CNAME to the current chatgpt.site URL. Preserve MX, SPF, DKIM, DMARC and unrelated records. [Official Hostinger DNS management](https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/).
4. Read/refresh native domain status until routing is Active and TLS is ready. A submitted record or successful DNS editor click is not confirmation that propagation/TLS completed.
5. Test the new hostname: valid certificate, private audience, sign-in/out and native callback, stable account ownership and existing records, anonymous denial, spoofed-header denial, protected resume download and same-origin mutation checks.
6. Update server-side `CAREER_PUBLIC_ORIGIN` and applicable approved callback/relay/provider URLs after the new host works. Use native server configuration and keep provider flags disabled until their own acceptance checks. Inspect old and new host behavior explicitly; do not assume identical cookie/origin behavior.
7. Keep the original URL and saved Site version available. Roll back only the new web/validation records and canonical configuration if verification fails, using the recorded original values. Do not touch mail or delete stored candidate data.

The same-Site apex connection is Active with Active TLS. Exact issued DNS values were applied; zone comparison preserved email and unrelated records. Public-origin revision 2 was deployed successfully. Exact records, actual tests, remaining authenticated checks and rollback are in `dolphincreation-domain-setup.md`.

## Updates after setup

For the recommended route: edit locally → test → review Git diff → commit → push the reviewed GitHub branch → confirm CI → publish the exact approved source through the existing Sites source/version workflow → verify the domain and private journeys. A GitHub push alone does not deploy Sites. Keep the user-owned GitHub remote separate from the native Sites source destination; never force-rewrite either.

For a completed Hostinger port: edit → test → reviewed release-branch commit → GitHub CI → deploy to Hostinger staging → verify sign-in, owned data, private files and workers → promote the reviewed production revision → verify domain/TLS → monitor. Hostinger documents automatic deployments on push: do not connect an unrestricted development branch directly to live production. Enable this only after compatible runtime, safeguards and release-branch checks exist.

Before promoting either target, create/rehearse an encrypted backup, keep outbound workers paused during restore/cutover, reconcile uncertain external actions, and save the last valid release. Roll back application code to a known-good revision while retaining additive schema/data. Keep secrets in target server secret storage, never GitHub files or browser code. Scheduled workers are deployed separately, not proved by a frontend build.

## Remaining launch limits

Fresh production dependency audit reports zero findings. The full audit still reports eight high development/build/lint findings propagated from the unpatched braces advisory; braces latest remains 3.0.3 at this check. Existing full-repository lint errors remain. The existing handover lists all unconfigured providers and unfinished voice/OAuth/admin/sharing/deletion capabilities. Keep the release private; no broad launch, new paid plan or legal/security certification is implied.

See `release-workflow.md`, `platform-handover.md` and `platform-test-results.md` for implementation details, existing controls and historical test evidence. Fresh pipeline logs/audits are in ignored `outputs/pipeline-*-2026-10-13.*`. GitHub-hosted CI succeeded for `0de8bd8` in run `38375858560`. Hostinger DNS changes and anonymous native perimeter checks are complete. New-domain authenticated journeys, backup restoration and production load tests remain unperformed. GitHub checks are verification, not an automatic deployment or security certification.
