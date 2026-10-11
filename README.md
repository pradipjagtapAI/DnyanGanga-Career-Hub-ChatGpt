# DnyanGanga Knowledge Hub — career workspace

A light-theme career platform with a public website, interactive demonstration, and signed-in workspace backed by a relational database. Tagline: Learn Smarter, Build Faster, Grow Further. No reference website was used, as requested.

This is a private test release, not a completed public production service. Live job feeds, document upload processing, external AI, voice recording, scheduled-message delivery, public sharing, administration, and payments stay disabled until their secure integrations are implemented, configured, and tested. Adding a key alone does not activate them.

## What you can review

- Public product pages, real interface preview, original branding, responsive navigation.
- Explicitly fictional `/demo` workspace. Activity stays in current session memory; it is not evidence of real jobs, customers, applications, or alerts.
- `/dashboard`, protected by Sites' ChatGPT sign-in: owned profile/preferences, manually edited resume versions, user-supplied job descriptions, explainable matching, applications, tasks, and notification preferences.
- Profile/resume revision references and owned data export. The tested workspace-deletion routine stays unavailable online until trusted fresh authentication is supported.
- Clear unavailable states for integrations requiring credentials, approvals, or security capabilities.

**Sign in with ChatGPT** is supplied by Sites. The app does not create separate DnyanGanga password accounts, independently verify contact destinations, enforce application-level MFA, or supply its own recovery system. Those requested capabilities require platform support or a reviewed identity design. Career-workspace deletion does not delete a ChatGPT account.

## Handover

- [Architecture, page map, security, acceptance checks, maintenance](docs/architecture-security.md)
- [Integration research and operating-cost assumptions](docs/integrations-costs.md)
- [Executed test evidence](docs/test-results.md)
- [Placeholder configuration](.env.example)

Neither the interface nor the checklist establishes ASVS certification, legal compliance, or PCI DSS compliance.

## Local run

Prerequisites: Node.js **22.13 or newer**, npm, and a terminal. Git is needed for Sites publication. Retain the supplied Vinext starter's Sites build plugin and identity helpers.

Run from this directory, `sites/dolphin-career`:

```powershell
npm run install:ci
npm run build
```

The locked installation is repeatable; do not overlap installers. Build generates `dist/server/wrangler.json`.

The initial migration is `drizzle/0000_odd_reptil.sql`. Apply it once to a new local database; apply future pending migrations in order:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_odd_reptil.sql
```

Do not replay migrations already applied to the same local database. Keep generated migrations and the Drizzle journal together. Local state is separate from hosted data.

```powershell
npm run dev
```

Visit the loopback address printed by the server, normally `http://localhost:5173`. The portable starter simulates sign-in **only in loopback development**. Visit `/signin-with-chatgpt?return_to=/dashboard` for its fictional local identity and `/signout-with-chatgpt?return_to=/` to sign out. The simulated identity is not included in production builds. Do not expose the development server to a network or use real personal data.

For the built Worker preview:

```powershell
npm start
```

This uses loopback Wrangler and does not simulate sign-in. Use `npm run dev` for the local mock-sign-in journey. `.wrangler/state`, `.sites-runtime`, `.vinext`, and environment files are checkout-local and must not be published.

## Repeatable checks

```powershell
node --experimental-strip-types --test tests/career-security.test.mjs
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm audit --omit=dev
```

Review actual output. Compilation does not establish provider security, deployed account isolation, a complete dependency audit, or performance under load. Executed results belong in the security handover. Record failures/unavailable network checks honestly. End-to-end checks require two signed-in test users, anonymous requests, a private test deployment, and provider sandboxes.

## Source map

| Location | Purpose |
| --- | --- |
| `app/` | Public pages, demo, dashboard, auth helper, career API |
| `lib/career-core.ts` | Validation, preferences, matching, safe data helpers |
| `lib/career-store.ts` | Operations tied to the authenticated owner |
| `db/schema.ts` | Relational table definitions |
| `drizzle/` | Schema-only migrations and metadata |
| `tests/career-security.test.mjs` | Policy/security unit tests |
| `.openai/hosting.json` | Site identity and D1/R2 bindings; no secrets |
| `.env.example` | Placeholders; no working credentials |
| `docs/` | Architecture/security/integration/cost handover |

## Private Sites deployment

Sites creates a private site, provisions declared D1/R2 bindings, applies hosted migrations, builds/packages the Worker, and deploys the matching source version.

1. Preserve the registered Site ID and declared `d1: "DB"`, `r2: "BUCKET"` bindings in `.openai/hosting.json`. Never put secrets there.
2. Run checks/build with the installed Sites plugin's `scripts/build-site.mjs` from the project directory; standalone development can use `npm run build`.
3. Synchronize/package through `scripts/site-workflow.mjs`, supplying source credentials through hidden stdin. It returns project ID, commit, and archive. Keep credentials out of files, shell arguments, and output.
4. Save/deploy that archive with the private Sites deployment tool. Preserve private access while launch blockers remain.
5. Confirm the native deployment result and run two-user/anonymous checks on that exact version. Local build success is not deployment evidence.

`npm start` does not publish. Reuse the existing Site on retries.

## Production release

Use separate production Site/database/bucket/domain/provider accounts and secrets. Verify HTTPS, policies, storage privacy, logging, backup restoration, and identity/MFA capability. Obtain job-source/messaging approvals. Implement and test disabled adapters before collecting documents, sending alerts, sharing, or accepting money.

Document workers, a durable queue, timezone scheduler, AI adapters, and hosted checkout are next-stage work described in the handover. Prices remain unconfigured and checkout disabled. Obtain an independent security review before live payments or broad sensitive-data collection.





### This Windows host: launcher fallback

If the npm launcher reports it cannot find `node_modules/npm/bin/npm-cli.js`, use the host's actual npm entrypoint for installation:

```powershell
$env:npm_execpath = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'
node scripts/install-ci.mjs
node scripts/run-framework.mjs build
node scripts/run-framework.mjs dev --host 127.0.0.1
```

This is a local launcher workaround. Other hosts should use their own installed npm path. Keep the dev server on loopback. A build and a database migration are required before using the account dashboard.

### Launch recommendation

Use the private review build with fictional data. Complete the disabled integrations, MFA/recent-auth support, document worker, notification queue, provider rights, remaining build-tool vulnerability review, backup drills, and independent security review before real personal-data collection or live payments. A custom domain has not been attached; DNS ownership and custom-domain configuration are separate steps.


