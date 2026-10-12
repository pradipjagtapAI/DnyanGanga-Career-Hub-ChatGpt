# Agentic update verification — 12 October 2026

These are observed results on Windows, Node 24.16.0 and the local D1/SQLite
database. Browser tests used headless Edge and the fixed synthetic loopback
identity. They do not prove hosted identity, live provider delivery, full ASVS
verification, production capacity or backup restoration.

| Check | Observed result | Evidence / repeat command |
| --- | --- | --- |
| Six server/policy suites | **182 passed, 0 failed**, 2,898.8674 ms | `node --experimental-strip-types --test tests/career-security.test.mjs tests/career-ai.test.mjs tests/provider-alerts.test.mjs tests/agent-matching.test.mjs tests/agent-store.test.mjs tests/agent-orchestrator.test.mjs` |
| Private processor policy | **8 passed**, 0.014 s | From `services/document-processor`: `python -B -m unittest test_processor.py`; real DOCX policy parsing, scanner mocked, actual Linux/ClamAV untested |
| Existing HTTP journey | **36 checks passed** | `node tests/http-smoke.mjs`; actual local D1, synthetic identity, private API/CSRF/ownership and preserved resume/draft behavior |
| Command Center browser | **16 checks passed**, no page or cleanup errors | `node tests/agent-browser-smoke.mjs`; [actual results](agent-browser-results.json), desktop/mobile screenshots in ignored `outputs/` |
| Preserved account workflow | **9 checks passed**, no page errors | `node tests/upgrade-browser-smoke.mjs`; [actual results](upgrade-browser-results.json); matching, separate resumes, cover letters, interview history, alerts and admin gate |
| Built Worker/browser headers | **9 checks passed**, no page errors | `node tests/header-smoke.mjs`; [actual results](header-results.json); nonce CSP, inline injection blocked, no-store, anonymous API 401 and navigation |
| TypeScript | **Exit 0** | `node node_modules/typescript/bin/tsc --noEmit --incremental false` |
| Focused changed-module lint | **Exit 0** | Agent modules, AI/alerts/providers, API, schema, Command Center and new tests; command below |
| Production build | **Exit 0** | `node scripts/run-framework.mjs build`; framework static route-classification warnings remain |
| Full frontend lint | **Exit 1: 98 errors, 12 warnings** | `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`; existing frontend hooks, types, entities and unused-code findings remain |
| Production dependency audit | **Zero findings, exit 0** | `npm audit --omit=dev --json`; [raw audit](agentic-production-audit.json) |
| Complete dependency audit | **8 high, 0 critical, exit 1** | `npm audit --json`; [raw audit](agentic-full-audit.json); build/lint dependency chain through braces stack exhaustion, GHSA-vfj7-8cjw-p6xm. No forced framework downgrade was applied |
| Heuristic secret check | **Passed, zero reported patterns or selected server markers in browser assets** | `node tests/release-secrets.mjs`; [actual scope/counts](agentic-secret-results.json). Does not prove all possible secrets or repository history are clean |
| Additive migration | **0004 and 0005 applied successfully locally** | Original migrations preserved; real SQLite tests cover legacy preservation, owner boundaries and database immutability; hosted release migration requires deployment verification |

The focused lint command is:

```powershell
node node_modules/eslint/bin/eslint.js lib/career-agent-contract.ts lib/career-agent-store.ts lib/career-orchestrator.ts lib/career-agent-matching.ts lib/career-ai.ts lib/career-alerts.ts lib/career-providers.ts 'app/api/career/[...path]/route.ts' app/ui/agent-command-center.tsx db/schema.ts tests/agent-matching.test.mjs tests/agent-store.test.mjs tests/agent-orchestrator.test.mjs tests/agent-browser-smoke.mjs tests/release-secrets.mjs
```

## What the tests establish

The tests exercise real prepared SQLite statements and additive migrations, with
injected external providers. They verify two-owner denial, unknown answers,
explicit fact confirmation, history, active resume/provenance, concurrent leases,
exact hash-bound approval and expiry, source-right changes, mode/pause changes,
mandatory cities, salary units/currency boundaries, duplicate destinations,
independent saved searches and source failures. Learning adjusts queue priority
without changing evidence score or mandatory eligibility.

They also exercise consent rechecks, independent email/WhatsApp failure handling,
durable digest fences, uncertain acceptance, signed callbacks, exact minimized
external request manifests and final permission checks before network calls.
Provider mocks do not establish credentials, platform permission or actual sends.
An in-flight action already accepted before pause cannot be recalled.

The browser suite uses real APIs and local records: search creation/editing,
bounded run continuation, global/category pauses, default Approval mode, settings,
vault history, screening answers, cover edits, package download and approval
invalidation. Screens fit 390, 768 and 1,440 pixels in the exercised journey.
Standalone resume/session cleanup does not purge copied private manifests or
package history. The UI and handover disclose that retention limitation.

## Repeating the checks

Follow README to install dependencies, apply pending migrations and start the
development server. Run unit tests, then HTTP and browser checks sequentially;
the account tests mutate only a fixed synthetic identity and must not run
concurrently against that identity. Browser dependencies and host-specific Edge
settings are listed in README. Header and secret checks require a successful
build; headers also require the separate built Worker preview at port 8787.

On this host the npm wrapper is broken. Equivalent commands use
`C:/Program Files/nodejs/node.exe` and
`C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` directly. Set
`$env:npm_execpath` to that npm CLI path before running the framework build.
Stop the built preview before rebuilding on Windows to release output file locks.

## Untested work and release decision

No live external AI, authorized job-feed request, email send, WhatsApp template
send/delivery/STOP or deployed unattended scheduler was tested. Private scanner
and conversion source remains gated pending real Linux isolation, malware and
adversarial PDF verification. No production two-account session/file test,
independent security assessment, full accessibility audit, stated-load test,
encrypted backup restoration or retained-history purge was completed. Account
deletion and administrator actions remain disabled where trusted fresh
authentication/MFA is unavailable. There is no active payment or application
submission adapter to test; this update creates no paid entitlement.

Keep the existing owner-private audience. The high build-tool findings, legacy
lint, retention/purge policy and external acceptance work need review before broad
launch or sensitive live collection. Do not describe this build as certified,
fully secure, legally compliant or capable of unattended live applications.

See [handover](agentic-handover.md), [data controls](agentic-data.md),
[workflow implementation](agentic-workflows.md) and [UI verification](agentic-ui.md).
The earlier source's dated results are preserved in `test-results.md`.
