# Test evidence

Executed on 11 October 2026 using Node v24.16.0. Results below are observed outputs, not a security certification.

## Backend policy and database tests

Repeat from the project directory:

```sh
node --experimental-strip-types --test tests/career-security.test.mjs
```

Latest observed result after dependency updates: **28 tests passed, 0 failed, 0 skipped**, total duration **473.0273 ms**.

The tests import the real policy code and transpile the actual `lib/career-store.ts` without changing its SQL. Prepared queries run against an in-memory SQLite database initialized with the generated `drizzle/0000_odd_reptil.sql`. The adapter wraps batches in a transaction. It is not a substitute for testing Cloudflare D1 or the hosted identity dispatcher.

Verified in this environment:

- Same-origin mutations, a required custom request header, JSON content type, and streamed request-body limits.
- Rejection of role/user ownership fields and changes to the identity email.
- Finite numeric input, experience ranges, supported statuses, and safe HTTPS link syntax. User links are stored only; the server does not fetch them.
- Mandatory location, work arrangement, and employment filters before explained relevance ranking. Current city is the location fallback, including for remote jobs.
- Closed and excluded jobs, duplicate imports, confirmed skill evidence from the selected active resume, and preservation of explicit preferences.
- Manual provenance, immutable saved versions, new versions on restore, monotonic version numbers after deletion, and explicit active-resume selection.
- A forced database insertion failure rolls back the revision counter and preserves the previous active resume. This is an atomic database failure test; malware scanning and document conversion are disabled and were not tested.
- Owner-specific profile, draft, version, task, job, application, and export queries. User B cannot reference User A's jobs or resumes in an application.
- Profile and draft revision conflicts reject stale writes.
- Marking an application Applied requires explicit submission confirmation. Duplicate tracker records are rejected.
- SQL-like document text remains parameterized data. It cannot alter roles, tables, or another user's records.
- Persisted mutation limits and safe failure when the database binding is missing.
- Capacity checks are repeated in atomic insertion SQL; a stale-preflight test at 100 resume versions confirms no extra version, counter increment, or change to the active resume.
- Separate notification consent, schedule validation, and provider-dependent controls remaining disabled.
- The exact route feature-gate policy blocks payments, uploads, AI, sending, sharing, administration, and account deletion. Account deletion needs a trusted recent-authentication attestation. The underlying owner-specific deletion transaction is tested but is not exposed by the HTTP route.

## Schema generation

```sh
node node_modules/drizzle-kit/bin.cjs generate
```

Observed result: exit 0; seven tables generated into `drizzle/0000_odd_reptil.sql`. Tables are not created during visitor requests.

## Dependency audit

```sh
npm audit --json
```

Initial observed result: exit 1; **30 findings: 1 critical, 21 high, 7 moderate, 1 low**. Full original output is saved in `docs/dependency-audit.json`. This initial report is preserved as evidence and does not establish which vulnerabilities are reachable in this application.

The critical initial finding was Next.js `next/og` remote code execution, [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), affecting the starter's Next 16.3.4. The app does not implement an `ImageResponse` endpoint.

Remediation used official npm registry version, engine, and peer metadata: Next 16.4.0; React, React DOM, and React Server Components 19.2.8; Vinext 1.1.0; Vite 8.3.4; Cloudflare Vite plugin 1.63.1; Wrangler 4.149.0; RSC Vite plugin 0.5.34; ESLint Next config 16.4.0. Scoped overrides use sharp 0.35.5, esbuild 0.25.12 for the legacy schema loader, and fflate 0.8.3. Nonbreaking `npm audit fix --ignore-scripts` refreshed other transitive dependencies. Schema generation still succeeded, reporting no additional changes.

Repeat the complete audit:

```sh
npm audit --json
```

Observed post-remediation result: exit 1; **8 high, 0 critical, 0 moderate, 0 low**. Full output is saved in `docs/dependency-audit-after.json`. All eight package findings trace to one unresolved [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in build/lint glob dependencies. The official registry's latest stable braces is 3.0.3, which remains affected. Audit's forced fix proposes breaking framework/lint downgrades; those were not applied. The application never passes resume contents or imported job text into file glob patterns. Build-tool exposure and the final server bundle still require reachability review, and this unresolved advisory is documented for launch review.

```sh
npm audit --omit=dev --json
```

Observed production-dependency result: exit 0; **0 reported vulnerabilities**. Saved in `docs/dependency-audit-production.json`. This narrower audit excludes development dependencies and is not proof that all compiled server code or deployed platform components are free of vulnerabilities.

## Local HTTP smoke test

`tests/http-smoke.mjs` is prepared to run against the fixed localhost development identity after starting the preview and applying the local D1 migration:

```sh
node tests/http-smoke.mjs
```

Observed result against the migrated local D1 database at `http://127.0.0.1:5173`: **exit 0, 25 checks passed**. The script refuses non-local URLs and refuses to modify any identity other than `seedy@sites.test`. It tests anonymous access, identity header stripping, no-store responses, origin checks, role-field rejection, resume versions/downloads, disabled upload/payment/deletion paths, imports, application confirmation, tasks, exports, and body limits. It cleans its created test records. This localhost test does not establish hosted dispatcher/session security or two-account HTTP isolation.

An actual Vite/Miniflare development transport failure was observed during the first run: after a framework-level cross-origin rejection, the next reused connection could return a development `fetch failed` HTTP 500 before reaching the API. The test uses `Connection: close` to isolate this development bridge behavior. This is recorded, not treated as a resolved production issue. Gated same-origin mutations now consume only bounded JSON before their unavailable response, fixing a separate unread-stream failure after disabled-feature requests. Deployment transport and pooled-request behavior still require review.

## Backend lint and secret-pattern scan

```sh
node node_modules/eslint/bin/eslint.js lib/career-core.ts lib/career-store.ts 'app/api/career/[...path]/route.ts' db/schema.ts tests/career-security.test.mjs tests/http-smoke.mjs
```

Observed result: exit 0, no diagnostics.

```sh
rg -l 'sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|whsec_[A-Za-z0-9]{20,}' app lib public dist/client
```

Observed result: exit 1, no matching files. This limited pattern check inspected source and generated browser assets; it is not a comprehensive credential scanner or an independent review. No real service keys were configured.

## Tests still required before broad launch

- Hosted authentication/session expiry/logout/recovery, header spoofing resistance, MFA, and recent-authentication attestation.
- Real D1 concurrency, quota boundaries, dispatch deployment, and authenticated HTTP isolation with two separate accounts.
- Mobile/desktop browser journeys, accessibility, CSP behavior, headers, and public bundle secret checks.
- Authorized application security scanning, dependency reachability review, and independent security review.
- Backups and documented restoration; retention and deletion from provider backups.
- Measured load/performance under a stated concurrency and data volume.
- Malware scanning, private file download authorization, conversion limits, AI providers, live job feeds, consent-aware idempotent dispatch, signed callbacks, billing reconciliation, and payment event ordering. These capabilities are disabled, so their integrations have no successful test evidence.

Counts and durations here apply only to the command and source state described above. Rerun after changing backend policy, schema, dependencies, or deployment settings.

## Final review checks — 11 October 2026

- `node node_modules/typescript/bin/tsc --noEmit`: exit 0, no diagnostics on final reviewed source.
- `node scripts/run-framework.mjs build`: exit 0, all production Worker/client/SSR build stages completed after the final source corrections. Build warnings about route classification and dynamic imports remain nonfatal; do not infer runtime security from compilation.
- `node tests/browser-smoke.mjs`: exit 0, seven journey groups plus immediate-close draft recovery passed, zero page errors. Desktop 1440×1100 and mobile 390×844; home/dashboard screenshots reviewed and horizontal overflow checks passed. Fictional in-memory demo only.
- `node tests/account-browser-smoke.mjs`: exit 0, eight actual browser/account groups against the local D1 database. Profile saved, draft flushed on immediate close, recovered, resume saved, notification preferences saved, and reload persistence verified. Synthetic created records were removed and original profile restored. Zero page errors. This uses the starter's loopback-only mock identity, not real deployed sign-in.
- `node tests/header-smoke.mjs`: exit 0, seven built-Worker header/status checks passed. Private API responds 401 anonymously and no-store; CSP, nosniff, framing denial, referrer and capability headers are present. Local HTTP cannot verify deployed TLS/HSTS behavior. CSP still permits inline scripts/styles and is not strict nonce-based CSP.

Browser tests use an existing Playwright package and headless Microsoft Edge. To repeat on this host, set `CAREER_PLAYWRIGHT_MODULE` to the installed Playwright directory and `CAREER_BROWSER_CHANNEL=msedge`. In another environment install Playwright in your development/test toolchain and its supported browser, then run the scripts with the loopback preview active. Header checks use the built preview on port 8787.

The native browser helper failed to initialize in this session; developer QA used the installed headless browser instead. Default sandbox process launch also failed; approved host commands were used. The Sites package-manager build wrapper could not find its npm shim on this Windows host; the supplied `scripts/run-framework.mjs` build entrypoint succeeded directly. These environment issues are separate from application functionality.

No deployed two-user isolation test, provider sandbox payment/delivery test, restore drill, ASVS certification or measured load test is claimed. Keep public release and sensitive integrations blocked pending the security checklist.
