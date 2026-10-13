# Sole administrator login

The application is configured for one administrator. Its login email is a server setting, separate from the email in the professional profile. No other application login method, public registration, social login or magic link grants workspace access. Platform-reserved native sign-in routes may still exist but do not authorize application records.

## Implementation

- Better Auth 1.7.7 uses the existing Worker and D1 database for passwords and server sessions. TOTP uses the maintained two-factor plugin. Passwords retain their exact submitted characters and require 14–128 characters.
- Auth and permission tables use the `career_admin_` prefix. Migration `0007_conscious_strong_guy.sql` adds 11 tables and protective triggers; existing candidate tables, keys, files and records are not rewritten.
- A verified native owner provisions the first account once. A durable reservation blocks concurrent setup. The new account receives an immutable mapping to that exact existing workspace ID. Profile email is not a linking credential.
- A password/enrollment session cannot enter the workspace. Successful authenticator verification records server proof tied to the database session. Workspace sessions expire after one hour; operational administration requires a code verified within five minutes.
- Cookies are Secure, HttpOnly, SameSite Strict, host-only and path `/`. Logout revokes database sessions and pending challenges. There is no remembered-device bypass. Concurrent/repeated TOTP attempts cannot produce duplicate fresh proofs.
- Server requests enforce the configured HTTPS origin, bounded JSON, the action header, explicit route/field allowlists and durable rate limits. Status queries are bounded at 120/minute; denial-audit admission is bounded at 60/minute. Counters saturate and indicate suppression rather than retaining exact excess counts. Concurrent session revocation prevents stale TOTP proof creation. Secrets and credential payloads are excluded from audit records. QR codes render locally using react-qr-code.

Main files: `lib/career-admin-auth.ts`, `app/career-auth.ts`, `app/api/admin/[...path]/route.ts`, the career API and dashboard entry, `app/admin/login/page.tsx`, `app/ui/admin.tsx`, `app/admin.css`, `db/schema.ts`, the additive migration and its Drizzle metadata.

Official references: [Better Auth database](https://better-auth.com/docs/concepts/database), [email/password](https://better-auth.com/docs/authentication/email-password), [two-factor authentication](https://better-auth.com/docs/plugins/2fa).

## Server settings

Configure `CAREER_ADMIN_ENABLED`, `CAREER_ADMIN_AUTH_SECRET`, `CAREER_ADMIN_EMAIL`, `CAREER_ADMIN_BOOTSTRAP_OWNER_ID` and the existing `CAREER_PUBLIC_ORIGIN` in server-only native environment settings. Real passwords, seeds, secrets, login email and legacy identity values do not belong in Git. The example configuration contains placeholders only.

Keep the random auth secret stable and backed up securely: it protects encrypted authenticator data. Blind secret rotation can prevent sign-in. Missing/placeholder configuration fails closed. Every environment change requires deploying a saved version to apply it.

## Safe rollout

1. Confirm the native Site is still owner-private with its sole allowed owner. Keep the existing Site ID, D1 and R2 bindings.
2. Deploy and test the reviewed auth code and additive migration privately. No migration is executed from an arbitrary login request.
3. Temporarily enable `CAREER_ADMIN_PRIVATE_SETUP=true` only on that confirmed owner-private Site. The `/admin/ownership` page reveals only the current native workspace identifier, not an account export. Do not substitute a workspace allowlist ID: native per-Site identity may be different.
4. Set `CAREER_ADMIN_BOOTSTRAP_OWNER_ID` to the exact verified identity. Set `CAREER_ADMIN_PRIVATE_SETUP=false` and redeploy before changing the outer hosting perimeter.
5. The human owner enters the configured email and chooses the password directly on `/admin/login`. Enable an authenticator, scan the local QR or enter its setup key, and verify a current code. Do not send passwords, OTPs or setup seeds through chat.
6. Verify the existing dashboard and profile using the new account; do not silently create a replacement workspace or copy credentials into profile fields.
7. Removing the platform ChatGPT gate requires an explicit native audience change. Public landing/login pages can then rely on the separately tested application guards for all private routes. Do not change audience until bootstrap, session/MFA guards and ownership checks pass.
8. Immediately test the custom domain and original alias without a session, with spoofed native identity headers, and with invalid/expired independent cookies. Private state, export, documents and admin health must fail. The temporary ownership page must be unavailable. Restore the owner-private perimeter if any sensitive route succeeds incorrectly.

## Repeatable checks

```text
npm test
npm run test:admin
npm run test:admin:worker
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=low
python -B tests/admin_hosted_access.py
# After confirming the approved public hosting perimeter:
python -B tests/admin_hosted_access.py --execute
```

The administrator suite executes the actual Better Auth implementation against SQLite through its native D1 dialect. The workerd smoke test executes the implementation with an actual isolated local D1 binding. Both use synthetic identities and credentials; neither proves hosted identity, TLS, production password-hash CPU allowance or a completed live setup. Hosted acceptance remains a separate recorded check.

Final verification on 13 October 2026: 273 regression tests passed (250 existing + 23 administrator tests), with zero failures/skips in 5265.2591 ms. Nine native-D1 workerd request groups also passed after the final hardening. Typecheck, focused lint and the full Worker build passed; the source/browser secret heuristic found zero violations in 236 source files and 15 browser assets. Production dependency audit reported zero findings. The complete audit retains eight high development-tool findings from the previous baseline; broad release is not approved by these selected tests.

## Remaining controls and recovery

Operational administration initially shows aggregate processing, notifications and AI usage. Private resume browsing, account/role management, provider credential editing, payment control and user impersonation are unavailable.

Automatic email password reset, backup-code login, factor disabling and password changes are closed until their recovery/authorization controls are implemented and tested. Do not promise automated recovery. If setup partially fails, its durable reservation remains closed: an authorized operator must inspect only the `career_admin_` state and audit before repair. Never reset candidate tables or choose another account by email to recover access.

Monitor failed sign-ins, rejected MFA, throttling, unfinished bootstrap and unexpected role/mapping changes. Review dependency alerts weekly and deploy security patches after tests. Maintain encrypted database/storage backups and an independently verified restore procedure. Test expiry, logout and the two public domain aliases after auth changes. Never publish an ASVS certification or security guarantee based on this checklist.

## Activation status

On 13 October 2026, saved version 7 (source `c957b27ac46bb02cee3ab1153b722bc60d50f95f`) deployed successfully on the existing Site and storage bindings. Native environment revision 4 contains the independent random authentication key, administrator email and exact verified legacy ownership mapping as masked server settings. No real credentials are present in source, browser assets or the metadata-only verification receipts.

The human owner completed password creation and authenticator enrollment directly in the website. Browser acceptance opened the fresh-MFA protected service panel and the preserved career workspace. Visible profile completion remained 14%, with the same existing zero-record counts. This confirms the observed workspace continuity; no private resume/profile export or full-record comparison was performed.

After those checks and explicit owner approval, native audience revision 2 made the landing/login pages public. The application workspace continues to require the independent administrator session and MFA. The temporary ownership route is disabled. The original site alias redirects administrator sign-in to `https://dolphincreation.com/admin/login`; host-only cookies are not shared across domains. Platform-owned native authentication routes can remain, but do not grant career-record access.

Thirty-four live anonymous checks passed with normal DNS and verified TLS. They included private state, export, original/generated document and application-package downloads, empty uploads, synthetic cookies, spoofed native identity headers, origin/action-header rejection, disabled setup/internal-auth routes, canonical routing and unsigned callbacks. Each checked response retained no-store, restricted CORS and the tested security headers. The test stores metadata and safe error codes only; it stops immediately if a private endpoint returns 2xx. Running without `--execute` prints the plan and makes no requests.

| Control | Evidence/status |
| --- | --- |
| Password and required authenticator setup | Implemented; human hosted setup and fresh admin panel verified |
| Sole configured administrator and exact workspace mapping | Implemented; private native-owner proof, immutable mapping and observed workspace continuity verified |
| Anonymous, forged-cookie and spoofed-native-header denial | Implemented and tested in 34 hosted probes |
| Private downloads and exports | Anonymous denial tested with synthetic IDs; real file ownership covered by local tests, not a hosted two-account comparison |
| Closed public bootstrap and disabled ownership screen | Implemented; anonymous status/setup route checked after bootstrap |
| CSRF origin and action header | Local tests and unauthenticated hosted rejection tested; live authenticated forged-action check untested |
| Session expiry, logout, revocation and TOTP replay | Actual library/D1 local coverage; hosted logout followed by a new password/MFA login untested |
| Secrets | Native secret settings masked; source/browser heuristic passed; no credential values in evidence |
| Recovery, restore, load/CPU envelope | Manual verified recovery required; automatic reset/backup-code login disabled; restore/load envelope not tested. Human hosted setup demonstrates the observed hashing path succeeded |
| Live jobs, AI, email/WhatsApp and payments | Still disabled or unconfigured; no provider sends or payment changes claimed |

Selected local verification passed 273 tests and nine workerd groups. GitHub Actions run `38416322545` passed for the original application source. The full dependency audit still has eight high development-tool findings from the existing baseline; production dependency audit has zero findings. These checks do not certify ASVS compliance or approve every original launch requirement.

Local ignored evidence: `outputs/admin-hosted-access-2026-10-13.json`, `outputs/admin-saved-version-2026-10-13.json` and the previous local test logs. The repeatable network test is `tests/admin_hosted_access.py` and needs Python 3. Use only this owned deployment; do not turn it into an unrestricted target scanner.
