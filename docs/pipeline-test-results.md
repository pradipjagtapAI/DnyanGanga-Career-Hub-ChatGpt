# Pipeline preparation — actual local test results

Observed on 13 October 2026 in `E:/Websites/Dnyanganga Career Hub/ChatGPT`, using Node 24.16.0 and the unchanged published application source from commit `615edd17ab0494fba6eab180b4eab6fed8083b38`. The release-preparation change adds CI, local policy checks and guides; it does not change live application behavior or migrate accounts.

| Check | Actual result | Evidence / scope |
| --- | --- | --- |
| Clean lockfile installation | 727 packages installed successfully | Existing portable installer; no lockfile/package edits |
| Eight server suites | 250 passed; 0 failed/skipped; 4,955.4665 ms | `outputs/pipeline-tests-2026-10-13.txt`; isolated fictional storage/provider fixtures |
| TypeScript | Exit 0 | `tsc --noEmit --incremental false` |
| Focused application lint | Exit 0 | Eight named new career/API/UI modules; whole-repository lint is not claimed |
| Worker production build | Exit 0 | `outputs/pipeline-build-2026-10-13.txt`; not a Hostinger production server |
| Secret-format/browser-bundle heuristic | Passed, zero detected violations | `outputs/pipeline-secret-results-2026-10-13.json`; heuristic limitations remain |
| Production dependency audit | Exit 0, zero vulnerabilities reported | `outputs/pipeline-production-audit-2026-10-13.json` |
| Complete dependency audit | Exit 1, 8 high / 0 critical | `outputs/pipeline-full-audit-2026-10-13.json`; unresolved braces development/build chain |
| Current braces registry version | 3.0.3 | Official npm registry query; no speculative patch installed |
| Release policy self-test | 36 checks passed | `node scripts/check-release-readiness.mjs --self-test`; synthetic cases only |
| Source prerequisites | Passed; 7 migrations; Worker-bound | `--source-only` expressly does not approve a deployment |
| Readiness script syntax/lint | Exit 0 | `node --check` and focused ESLint |
| Local workflow YAML/policy review | Passed | One verification job, 11 steps, pinned official action commits, Node 24.16.0, read-only token, no retained credential/deployment secrets/deploy job |
| Default release gate | Expected nonzero while actual deployment evidence is absent | Blocks unsafe release; never manufactures evidence or deploys |
| Existing hosted Site inspection | Same version 6 / owner-private; apex binding now pending | Domain binding added later; no hosted user records modified |
| Actual GitHub verification | Completed successfully for `0de8bd8` | Run `38375858560`; all verification steps passed; full audit is a diagnostic |

The eight new release-preparation application lint targets are `lib/career-platform-store.ts`, `lib/career-intelligence.ts`, `lib/career-resume-tools.ts`, `app/ui/career-platform-tools.tsx`, `app/ui/resume-toolkit.tsx`, `app/ui/agent-command-center.tsx`, `app/ui/career-view-types.ts` and `app/api/career/[...path]/route.ts`. The new readiness script was linted separately. Historical full lint still has its documented legacy findings.

The existing browser/HTTP/provider results in `platform-test-results.md` were copied from the prior private release; they were not rerun merely to add CI/docs. No application code changed. A full Hostinger port or custom-domain change must have fresh relevant hosted journeys before cutover.

## Repeat from this repository

```powershell
node --experimental-strip-types --test tests/career-security.test.mjs tests/career-ai.test.mjs tests/provider-alerts.test.mjs tests/agent-matching.test.mjs tests/agent-store.test.mjs tests/agent-orchestrator.test.mjs tests/platform-store.test.mjs tests/resume-tools.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-release-readiness.mjs --self-test
node scripts/check-release-readiness.mjs --source-only
node node_modules/eslint/bin/eslint.js scripts/check-release-readiness.mjs
npm run build
$env:CAREER_SECRET_RESULTS='outputs/pipeline-secret-results-2026-10-13.json'
node tests/release-secrets.mjs
npm audit --omit=dev --json
npm audit --json
```

Use the README's direct Node/npm CLI fallback on this host if its npm launcher fails. Run `node scripts/check-release-readiness.mjs` after committing reviewed source; without current reviewed deployment evidence it must exit nonzero. This expected denial is separate from passing source checks.

## Work not performed

The source was later pushed to the selected GitHub repository and actual Actions verification succeeded. The owned apex dolphincreation.com was registered on the same Site and remains pending DNS/TLS. No Hostinger DNS records or hosting migration have been changed; browser sign-in remains required. The existing Site remains available with its private audience. Live providers, scheduled workers, hosted multi-user/session/cookie tests, backup restore, load testing and independent security review remain subject to the existing handover requirements.

The verification CI intentionally has no automatic deployment. The user selected Hostinger domain/DNS plus the existing platform, so no Hostinger application-hosting plan is needed. Hostinger sign-in and domain acceptance checks are still needed. See `hosting-and-domain-plan.md` and `release-workflow.md` for the concrete next steps.
