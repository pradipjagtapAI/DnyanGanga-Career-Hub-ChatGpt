# Current private release – actual verification

Observed on 12 October 2026. Tests use fictional records, the fixed loopback development identity, local D1 and deterministic provider fixtures. They do not establish production identity isolation, live integration success, certification or launch readiness.

## Results

| Check | Actual result | Evidence |
| --- | --- | --- |
| Eight server suites | 250 passed, 0 failed/skipped; 4,995 ms | [raw results](platform-server-results.txt) |
| TypeScript and focused new-module lint | Exit 0 | Repeat commands below; full-repository lint remains separate |
| Production Worker build | Exit 0 | [build output](platform-build-output.txt) |
| Expanded authenticated HTTP suite | 19 checks passed; cleanup succeeded | [HTTP results](platform-http-results.json) |
| Existing authenticated HTTP regression | 36 checks passed | [prior API suite](../tests/http-smoke.mjs) |
| New platform browser journeys | 12 checks passed, zero page/cleanup errors | [platform browser](platform-browser-results.json) |
| Agent approval/pause regression | 16 checks passed, zero page/cleanup errors | [agent browser](agent-browser-results.json) |
| Existing career-tool browser regression | 9 checks passed, zero page errors | [upgrade browser](upgrade-browser-results.json) |
| Resume Toolkit browser journeys | 7 checks passed, zero page/cleanup errors | [resume browser](resume-browser-results.json) |
| Built Worker headers/CSP | 9 checks passed, including successful hydration and injected inline script rejection | [headers](platform-header-results.json) |
| Document processor policy tests | 8 passed | `services/document-processor/test_processor.py`; no live scanner claim |
| Resume export unit tests | 9 passed, included in the 250 total | `tests/resume-tools.test.mjs` |
| Independent export parsing/rendering | All 3 templates passed text/bounds/OOXML checks | [export evidence](platform-export-results.json) |
| Source/browser secret heuristic | Passed, no detected violations | [scan](platform-secret-results.json); limited patterns, not proof of every possible secret |
| Production dependency audit | 0 vulnerabilities reported | [production audit](platform-production-audit.json) |
| Full dependency audit | 8 high findings in development/build/lint dependency chain, 0 critical at this recorded run | [full audit](platform-full-audit.json); remediation status is recorded below |
| Full-repository lint | 98 errors, 13 warnings in existing public/workspace modules | [lint output](platform-lint-results.json); the whole repository does not pass lint |

Browser checks covered the actual UI/API/database together. Expanded views were checked at desktop 1440, tablet 768 and mobile 390 pixels; resume controls at 1440/390. Real PDF and DOCX download events produced valid files. Synthetic originals and active selection were preserved through formatting, archive/restore and cleanup. Private synthetic immutable history can remain in the local test database. No tests sent messages, contacted employers, charged money or searched restricted job portals.

## Defects found and repaired

- Required screening questions could be satisfied by an unselected generic answer. Packages now require explicit selected answers, and required answers are scoped to the actual job. Wrong-job keys fail server validation. Regression tests and the final browser run exercise the repaired behavior.
- Duplicate listings could retain a high opportunity priority after fit exclusion. Duplicate exclusion now affects both independent outputs.
- The data-use manifest described document extraction incompletely. The private processing attempt now records that original document bytes are the required payload, without logging their contents.
- Test cleanup hit a temporary local database lock. Sequential suites, retrying cleanup and a private before-state restore repaired the test procedure; final runs report no cleanup errors.

Full lint and the development dependency chain remain unresolved. The eight high entries propagate from one braces stack-exhaustion advisory through build/lint dependencies; they are not eight independent flaws. The official registry still ends at braces 3.0.3, and the [primary advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. There is no maintained patch override to install. Do not accept untrusted glob patterns or build arbitrary uploaded projects; monitor the advisory and test a supported repair when available. Sensitive integrations remain disabled; these results are not a recommendation for broad launch. Never use a forced framework downgrade merely to suppress an audit report.

## Repeat checks

From the site checkout, with current local migrations applied and the loopback preview running:

```powershell
npm test
npm run typecheck
node node_modules/eslint/bin/eslint.js lib/career-platform-store.ts lib/career-intelligence.ts lib/career-resume-tools.ts app/ui/career-platform-tools.tsx app/ui/resume-toolkit.tsx app/ui/agent-command-center.tsx app/ui/career-view-types.ts app/api/career/[...path]/route.ts
npm run build
node tests/platform-http-smoke.mjs
node tests/http-smoke.mjs
$env:CAREER_PLAYWRIGHT_MODULE = 'C:/Users/jagta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CAREER_BROWSER_CHANNEL = 'msedge'
node tests/platform-browser-smoke.mjs
node tests/agent-browser-smoke.mjs
node tests/upgrade-browser-smoke.mjs
node tests/resume-browser-smoke.mjs
python tests/verify-export-files.py
```

Use the documented direct Node/npm CLI fallback if this host's npm launcher is broken. Run the HTTP/browser suites sequentially against their synthetic local account. Independent server suites use isolated databases. The exporter test generates fictional fixtures in ignored `work/export-verification`; parsing requires pypdf and fitz.

Start the built Worker with `npm start` on port 8787 for the header check:

```powershell
$env:CAREER_HEADER_RESULTS = 'docs/platform-header-results.json'
node tests/header-smoke.mjs
$env:CAREER_SECRET_RESULTS = 'docs/platform-secret-results.json'
node tests/release-secrets.mjs
npm audit --omit=dev --json
npm audit --json
```

From `services/document-processor`, run `python -B -m unittest test_processor.py`. Filesystem quarantine policies are tested, but a real private service, scanner engine and Linux resource limits require separate deployment verification.

## Not tested or operationally enabled

The following need real provider/operator access or additional implementation: hosted two-account session tests; identity cookie/logout/recovery/MFA/recent-auth evidence; private object storage/CDN isolation; production scan/conversion and optional OCR; licensed live job data and rights; live AI adversarial/factual evaluations; actual email/WhatsApp verification, acceptance, delivery and opt-out; scheduler service authorization and deployed cron; employer submission; voice/live copilot; email/calendar OAuth; administrator role changes; revocable sharing; full account purging and backup deletion; payments/refunds/reconciliation; restore drills; load/performance measurements; independent ASVS review; legal/retention obligations and monitored incident alerts.

Submission remains unavailable. Unconfirmed actions are never labelled Applied or Delivered. Provider failures are separate from zero matches. Payments, admin, sharing and account deletion stay denied where required prerequisites are absent.

See [handover](platform-handover.md), [integration deployment](integrations-update.md), [data contracts](platform-data.md) and [FMEA](platform-fmea.md) for exact gates and remaining risks. Release/deployment metadata is kept in ignored `outputs` after publication so that the published source commit is unchanged.
