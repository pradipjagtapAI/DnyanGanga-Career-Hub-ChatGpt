# Candidate sign-up setup

This update adds candidate accounts alongside the existing administrator account. It does not change administrator credentials, MFA, pricing, existing career records or the domain. Candidates receive a separate private workspace and cannot become administrators by choosing an email address or changing a request.

## What is available

- `/sign-up`: candidate registration and provider availability.
- `/login`: candidate sign-in.
- `/verify-email`: explicit email confirmation and resend help.
- `/forgot-password` and `/reset-password`: candidate password recovery.
- `/logout`: explicit sign-out, preserving the administrator sign-out flow.
- `/admin/login`: existing administrator password and authenticator login.

All account options remain unavailable on production until their protected server configuration is complete. This is intentional: no email delivery or social-login success is simulated. A Google account covers Gmail sign-in; the app does not request access to a Gmail inbox.

## Hosting configuration

The site continues to run on Sites, with Hostinger managing `dolphincreation.com` DNS. Configure runtime environment values on the existing Sites project `appgprj_6acba9a286e8819187fe91a333c9f53f`; a local `.env` file or Hostinger DNS entry does not configure the application. Preserve existing environment entries. Never put secrets into GitHub, browser code, a screenshot or `.openai/hosting.json`.

1. Generate an independent cryptographically random candidate authentication secret of at least 32 characters (48 random bytes recommended). Enter it directly into protected server runtime settings as `CAREER_CANDIDATE_AUTH_SECRET`, marked secret. Do not send it in chat or reuse the administrator key.
2. Set `CAREER_CANDIDATE_ENABLED=true` and keep `CAREER_PUBLIC_ORIGIN=https://dolphincreation.com`.
3. Configure at least one sign-up method below. Leave unconfigured methods disabled.
4. Deploy the saved website version again to apply its new environment revision.
5. Test signup with a test account, verify the email or provider login, then check login, logout and a second candidate's isolation before announcing availability.

Automatic approval review rejected generating a secret into tool output during this update because that could disclose a credential. No candidate secret was generated or saved through that rejected action. Production candidate authentication remains disabled until direct protected setup is completed.

## Email and password

Use the existing Resend integration dependency, independently of daily job-alert configuration. A verified email sender is required to deliver verification and reset links.

1. Create a [Resend account](https://resend.com/docs/send-with-nodejs).
2. Add and verify an owned sending domain using the DNS records shown by Resend. Preserve existing mail records; do not replace your mailbox's MX records unless the provider specifically requires an approved change.
3. Create a sending API key. Save `RESEND_API_KEY` as a server secret.
4. Set `RESEND_FROM` to the verified sender address, `RESEND_SENDER_VERIFIED=true`, and `CAREER_CANDIDATE_EMAIL_ENABLED=true`.
5. Confirm a verification email reaches the recipient and that the verification link works. Repeat with password recovery and verify old sessions are revoked after reset.

Email signup requires a password of 14–128 characters. Unverified identities cannot access career records. Reset and verification links expire and cannot be used repeatedly. Account creation/recovery replies do not reveal whether an email is already registered. Sender configuration alone is not proof of delivery.

## Google / Gmail

Create a Google Cloud OAuth **Web application**. Configure consent-screen branding, the website domain, homepage and privacy information. Add permitted test users while the application is in testing; complete applicable publishing/verification requirements before broad use.

- Authorized origin: `https://dolphincreation.com`
- Exact redirect URI: `https://dolphincreation.com/api/account/callback/google`
- Scopes: `openid email profile`; no Gmail inbox scopes.
- Server values: `CAREER_GOOGLE_ENABLED=true`, `CAREER_GOOGLE_CLIENT_ID`, `CAREER_GOOGLE_CLIENT_SECRET` (secret).

Official instructions: [Google client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## LinkedIn

Create a LinkedIn developer application and request the **Sign In with LinkedIn using OpenID Connect** product. Complete the developer application's ownership/product requirements.

- Exact redirect URI: `https://dolphincreation.com/api/account/callback/linkedin`
- Scopes: `openid profile email`.
- Server values: `CAREER_LINKEDIN_ENABLED=true`, `CAREER_LINKEDIN_ACCESS_APPROVED=true`, `CAREER_LINKEDIN_CLIENT_ID`, `CAREER_LINKEDIN_CLIENT_SECRET` (secret).

LinkedIn may omit email or verified-email information. Missing/unverified email must not grant a verified candidate workspace automatically. The app does not connect job-search access merely by signing in.

Official instructions: [LinkedIn sign-in product](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [authorization setup](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

## Indeed

Indeed provides an official **Log in with Indeed** integration. Obtain partner-provisioned credentials and approved identity scopes, follow integration verification, and keep testing and production applications separate. Job-data access and submission permissions are separate from login.

- Exact redirect URI: `https://dolphincreation.com/api/account/callback/indeed`
- Identity scope: `email`; do not request employer or offline access for sign-in alone.
- Server values: `CAREER_INDEED_ENABLED=true`, `CAREER_INDEED_ACCESS_APPROVED=true`, `CAREER_INDEED_CLIENT_ID`, `CAREER_INDEED_CLIENT_SECRET` (secret).
- Authorization endpoint: `https://secure.indeed.com/oauth/v2/authorize`.
- Token endpoint: `https://apis.indeed.com/oauth/v2/tokens`.
- User-info endpoint: `https://secure.indeed.com/v2/api/userinfo`.

Official instructions: [Log in with Indeed](https://docs.indeed.com/authentication/log-in-with-indeed), [OAuth requirements](https://docs.indeed.com/legal-terms/oauth).

## Naukri

A public, approved third-party Naukri identity integration could not be verified. Its option stays disabled. Obtain written approval, supported identity documentation, credentials, scopes and callback requirements before implementing it. Do not collect candidates' Naukri passwords, scrape their account pages or treat a job-feed API as a sign-in API.

## Implementation and validation

The existing Better Auth 1.7.7 dependency manages candidate credentials and social authorization. Separate candidate tables and cookie names prevent candidate sign-in from becoming administrator access. Social linking by matching email is disabled. OAuth callbacks are limited to enabled providers and fixed dashboard destinations. Candidate workspaces use namespaced, immutable user IDs, preserving legacy administrator ownership.

The additive candidate migrations 0008–0010 create new tables without rewriting existing accounts or documents. Native Sites applies packaged migrations during deployment; do not manually edit the production database. Take an operational backup before further data migrations. If rolling back code, leave additive tables in place and disable candidate authentication rather than deleting candidate records.

From the project folder, run:

```text
npm run typecheck
npm test
npm run test:candidates
npm run test:candidates:worker
npm run build
```

After starting the built site with `npm start`, run `node tests/candidate-http-smoke.mjs` to check public pages and anonymous access. Set `CAREER_BUILT_URL=https://dolphincreation.com` to repeat the same read-only checks on the live website. No accounts or emails are created by that script.

Use test-only identities in the automated tests. No real provider credentials are included. Live email delivery and real OAuth round trips require the external setup above and are not proven by local tests. Keep production disabled until those checks pass.

## Ongoing operation

Monitor account failure/rate-limit metadata without logging passwords, email tokens, OAuth codes or resume text. Maintain the existing administrator MFA. Rotate provider credentials through protected runtime settings, redeploy, and test an actual sign-in. Review dependency updates regularly. Independent security review and backup/restore checks remain necessary before collecting substantial candidate data.

## Verification completed for this update

- Complete offline regression: 291 passed, 0 failed/skipped.
- Authentication subset: 41 passed (17 candidate and 24 administrator).
- Actual isolated local workerd / native D1 candidate workflow: 10 grouped checks passed.
- Built website anonymous readiness: 14 checks passed.
- Type checking and focused lint passed.
- Production dependency audit: 0 reported vulnerabilities; the broader development-tool audit is reported separately by CI.
- Browser review passed on desktop and measured 320, 390 and 430 CSS-pixel widths, with no horizontal/provider-button overflow.

| Control | Evidence/status |
| --- | --- |
| Candidate data ownership and administrator separation | Implemented and tested with two synthetic candidates and private records |
| Verified email before career access | Implemented and tested; actual provider delivery still required |
| Secure host-only sessions, expiry and logout | Implemented and tested |
| Concurrent/replayed recovery and OAuth logout cancellation | Implemented and tested |
| Fixed OAuth destinations, state checks and missing-provider handling | Implemented and tested locally; real provider round trips untested |
| Secrets outside browser/source | Server configuration only; production candidate secret still externally required |
| Verification/reset link referrer protection | Implemented; token pages and account API use no-referrer |
| Provider approval, sending domain and live mail/OAuth acceptance | Externally required; disabled until completed |
| Hosting access-log redaction, traffic capacity and independent review | Externally required; not verified by these tests |

These results do not certify ASVS compliance or guarantee security. No real candidate account was created or email sent during local verification.
