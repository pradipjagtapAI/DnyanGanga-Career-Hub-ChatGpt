# dolphincreation.com — domain connection

Issued 13 October 2026 for the existing owner-private Site. The candidate application continues on its current platform; Hostinger manages DNS. No account, database or storage migration is needed for this route.

## Verified progress

- Source uploaded to https://github.com/pradipjagtapAI/DnyanGanga-Career-Hub-ChatGpt at `0de8bd813193a43252cc7ce0a8668370e5627cf2`.
- Repository is public; its visibility was not changed.
- Actual GitHub verification succeeded: https://github.com/pradipjagtapAI/DnyanGanga-Career-Hub-ChatGpt/actions/runs/38375858560.
- Apex `dolphincreation.com` was attached to the same Site: `appgprj_6acba9a286e8819187fe91a333c9f53f`.
- Domain ID: `appgdom_6acdf83ba6088191b94851211e9daa34`. Native domain, provider and TLS statuses are now Active.
- Hostinger apex A and two validation TXT records were saved with TTL 300. Before/after zone exports confirm all mail and unrelated records unchanged. Independent public DNS returns the issued values.
- Normal certificate validation passes on both issued proxy addresses. The expected private sign-in perimeter responds on the apex.
- `CAREER_PUBLIC_ORIGIN=https://dolphincreation.com` applied as environment revision 2 by successfully redeploying saved version 6; no database, storage or identity migration. AI, live job and alert flags remain false.
- Nine post-deployment anonymous perimeter checks passed. Authenticated sign-in/callback/logout, stable account data and CSRF on the new host remain unverified because this computer/upstream resolver still returns the old web address. Private access is unchanged; no broad launch is implied.

## Required DNS records

These are the exact native provider-issued records for the apex. TXT validation values are intended to be public DNS records; they are not application service keys. Refresh native domain metadata before reuse if this connection has been removed/recreated.

| Type | Hostinger name | Value |
| --- | --- | --- |
| A | `@` | `162.159.143.30` |
| A | `@` | `172.66.3.26` |
| TXT | `_openai-site-verification` | `openai-site-verification=VwSe2qca0Vf7NH4ASD1ZEQpbR3q9l0E8xfX-gKeT_Cg` |
| TXT | `_cf-custom-hostname` | `23c0f8f8-ba07-4e0b-9053-3f90655d006d` |

The authoritative DNS zone was exported from Hostinger before and after editing; both exports are kept in ignored local outputs. For future changes, export the current zone again and record all affected web records. The public lookup on this date showed apex A `187.127.167.1`, TTL 14400, nameservers `pixel.dns-parking.com` and `byte.dns-parking.com`. This partial lookup is not a complete zone backup.

Apply the issued apex A records and validation TXT records. Remove conflicting apex web targets only after recording them. Preserve all MX, SPF, DKIM, DMARC and unrelated records; do not reset the zone or change nameservers. Observed Hostinger email MX records were `mx1.hostinger.com` (priority 5) and `mx2.hostinger.com` (priority 10). The existing `www` web address is not included in this apex connection and must not be treated as configured.

## Verification before cutover

1. Refresh native domain status until Active and TLS ready. Verify public DNS, HTTPS certificate and private access independently.
2. Test native sign-in, callback and logout on the new hostname. Verify the same user ID, existing records and private resume permissions; anonymous, spoofed-header and cross-user requests must fail.
3. Test legitimate same-origin saves and denied cross-origin writes. Preserve the request hostname through routing; do not weaken CSRF checks to accommodate a proxy.
4. After these checks, set hosted `CAREER_PUBLIC_ORIGIN` to `https://dolphincreation.com` using native server configuration. This controls digest links; it is not the auth/CSRF allowlist.
5. Keep `CAREER_ALERT_RELAY_ORIGIN` separate. Keep scheduler `CAREER_SITE_ORIGIN` on the currently approved native host until custom-host service-token access has been verified; worker requests reject redirects.
6. Keep provider flags disabled until their own acceptance checks. Old frozen email retries can cancel safely with `MESSAGE_CONTEXT_CHANGED`; preserve accepted/uncertain dedupe records and do not blindly replay them.
7. Compare mail DNS with the zone export. Record results before declaring the domain connected.

## Rollback

Pause outbound work; restore the previous public-origin setting and only the changed web/validation records to their recorded values. Keep the same private Site, original URL, database and storage. Preserve the custom-domain binding while cached DNS still points to it. Verify recovery before resuming workers and reconcile uncertain notifications without replay.

## Future updates

Edit the existing local repository, run tests, commit, push to GitHub and wait for its verification workflow. Publish the exact reviewed source through the existing Sites source/version workflow; GitHub push alone does not deploy the Site. Keep its project ID and private audience. Verify both the original URL and the activated domain after release.

Official DNS instructions: https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/

## Actual cutover evidence — 13 October 2026

| Check | Result | Evidence |
| --- | --- | --- |
| DNS export comparison | Passed; only apex A and issued TXT changes; mail/unrelated records preserved | `outputs/domain-zone-comparison-2026-10-13.json` |
| Public resolver | Exact issued A/TXT records returned | `outputs/domain-public-dns-after-2026-10-13.json` |
| Native domain/TLS | Active | `outputs/domain-cutover-receipt-2026-10-13.json` |
| HTTPS on both provider IPs | Normal certificate validation passed; early transient 404 was diagnosed before the private gate became available | `outputs/domain-tls-routing-active-2026-10-13.json` and `domain-route-diagnosis-2026-10-13.json` |
| Anonymous private perimeter | 9 checks passed: root, state, export, protected file, two spoofed-header forms, anonymous mutation and cross-origin read | `outputs/domain-private-access-2026-10-13.json`; native 401 gate, not authenticated application CSRF evidence |
| Origin configuration | Revision 2; successful native deployment of saved version 6 | Deployment `appgdep_6ace290a4f688191a1e48adebe9bc6b4` |
| Original URL | Expected native private sign-in gate still responds | Same Site/version/data bindings; no destructive migration |
| Authenticated new-host journeys | Not tested | Current default resolver caches `187.127.167.1`; direct fresh-IP checks preserve SNI and certificate validation, without disabling protections |

The native saved application remains source commit `615edd17ab0494fba6eab180b4eab6fed8083b38`. Later GitHub commits add CI/docs and a public configuration example; they do not imply a different application was deployed. Authentication, two-user isolation, owned-download success, restore, load and provider acceptance checks remain separate. Wait for the local/upstream DNS cache to refresh, then verify new-host sign-in and the same existing profile/resumes before considering a broader release.

Repeat the credential-free anonymous checks with `python -B tests/domain_access.py` (Python 3.12 and curl). This uses the exact issued addresses with normal TLS hostname/certificate validation to avoid stale DNS; it does not prove default-resolver propagation or authenticated journeys. It writes only safe metadata to ignored outputs. It is intentionally separate from the offline GitHub workflow.
