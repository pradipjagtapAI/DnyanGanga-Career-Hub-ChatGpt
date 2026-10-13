# Standalone source verification and release workflow

This guide applies to the copy in `E:/Websites/Dnyanganga Career Hub/ChatGPT`. It adds repeatable verification and an operator evidence gate. See also `docs/hosting-and-domain-plan.md` for the hosting decision and outstanding access. It does not create a GitHub repository, upload source, configure Hostinger, edit DNS, supply credentials or deploy anything. Earlier `platform-*`, `agentic-*` and provider guides remain historical evidence; passing a new source check does not replace their outstanding acceptance checks.

## Choose the hosting route before changing the domain

| Route | What changes | Required before connecting the domain |
| --- | --- | --- |
| Private GitHub source/CI + Hostinger domain/DNS + existing Sites Worker | GitHub holds source; Hostinger manages the domain/DNS; the current Worker, managed sign-in, D1 and private R2 continue serving the app | Native Sites custom-domain support and its exact issued DNS records; custom-host HTTPS, sign-in/callback/logout, owner isolation, private files and headers tested on that origin |
| Full application hosting at Hostinger | The application server and services move to a verified supported plan | A completed backend, storage, trusted-auth and background-worker migration with tests and restore evidence. The current source is not a generic Node or static application ready for this route |

The first route does **not** host the application server at Hostinger. Do not describe domain registration or DNS management as application hosting. For a native custom domain, use only the records issued by the actual Sites custom-domain operation after ownership verification. This guide contains no guessed A, CNAME, verification, nameserver or IP value. Preserve email/MX and other required records, export the previous DNS zone, and verify the exact host before changing a live origin.

The source still imports `cloudflare:workers`, uses Worker-specific `HTMLRewriter`, D1 and R2 bindings, and reads trusted `oai-authenticated-*` dispatch identity. Exposing that code behind an ordinary web server where visitors can send these headers would create an identity-forgery risk. A full migration must strip untrusted identity headers at a trusted boundary and replace dispatch identity with a maintained server authentication/session integration. A Hostinger plan providing Node alone does not supply those controls or recreate D1/R2/private service bindings.

## What the new CI actually checks

`.github/workflows/verify.yml` runs on pull requests, pushes to `main`, and explicit manual requests. It uses ephemeral GitHub-hosted Ubuntu runners, the locally tested Node 24.16.0 LTS runtime, read-only repository permission, no retained checkout credential, no deployment job, no production secrets and no dependency cache. It invokes the existing portable installation/build helpers and the committed lockfile. It checks:

1. Source prerequisites and migration files; this is explicitly **not** release approval.
2. The existing eight offline policy/storage/export test suites, using synthetic data.
3. TypeScript and **focused lint** of the reviewed career modules, API route and new readiness script.
4. The current Worker application build.
5. The existing heuristic scan of tracked/new source and built browser assets; current output goes to ignored `outputs/ci/secret-heuristic.json`, preserving historical reports.
6. A production dependency audit that fails on any reported severity.
7. A separate diagnostic full dependency audit under ignored `outputs/ci/full-audit.json`. A successful production audit does not repair a development dependency finding. A registry failure is reported as unavailable, not as zero findings.

The workflow does not run full-repository lint. Previous full lint has legacy findings; do not label this focused check as a clean full lint. A complete audit is diagnostic because the recorded `braces` development/build denial-of-service advisory has no published patched release at the time of this handover; do not use a forced framework downgrade merely to change the audit count. Review the current audit on every release. Keep build inputs trusted and development services private.

No deployed browser, provider, Hostinger or custom-domain test result is invented by this workflow. HTTP/browser tests require an isolated loopback Worker with migrations and a synthetic account; run them sequentially as documented in `docs/platform-test-results.md`. Live scanner, OAuth, AI, messaging, backups, MFA, privacy and load tests retain their previous external prerequisites. Never point the fixed-account browser tests at production user records.

Actions are pinned to official verified release commits checked on 2026-10-13: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), commit `3d3c42e5aac5ba805825da76410c181273ba90b1`, and [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), commit `949feb2413d6458794dcd2491c4babbbce0c15c1`. Review and refresh these action pins and the Node patch through a tested change. Their action runtime requires a supported runner; this workflow uses GitHub-hosted runners. The [official secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) supports least privilege, pinned actions and avoiding privileged untrusted pull-request execution. This workflow does not use `pull_request_target` or `workflow_run`.

## Local checks before a GitHub push

From the standalone folder, use the existing installer rather than modifying the lockfile to make an installation pass:

```powershell
Set-Location 'E:/Websites/Dnyanganga Career Hub/ChatGPT'
npm run install:ci
node scripts/check-release-readiness.mjs --self-test
node scripts/check-release-readiness.mjs --source-only
npm test
npm run typecheck
npm run build
New-Item -ItemType Directory -Force outputs/ci | Out-Null
$env:CAREER_SECRET_RESULTS = 'outputs/ci/secret-heuristic.json'
node tests/release-secrets.mjs
npm audit --omit=dev --audit-level=low
npm audit --json
```

Focused lint matches the exact scope in the workflow. If this Windows host's npm launcher fails, use the documented Node/npm CLI fallback; do not confuse a launcher failure with application test failure. Inspect `git status`, the actual diff and tracked filenames before committing. Do not add `.env`, `.dev.vars`, private key files, local databases, uploaded resumes, ignored `outputs`, `work`, `.wrangler`, `.sites-runtime`, `node_modules` or build artifacts to Git. Rotate any exposed real credential; deleting it from the latest diff does not remove it from Git history.

The source prerequisites mode can pass while release readiness fails. A clean build does not show that Hostinger, DNS, deployed identity or a provider is configured.

## Private GitHub setup

The owner/account, repository name and remote URL must come from the user or the actual repository creation result. Keep the repository private. Authenticate through the normal GitHub browser/credential-manager flow; do not place a token in a remote URL or send it in chat. After the repository exists, add its actual HTTPS remote to this standalone checkout, inspect `git remote -v`, and push the reviewed branch. A placeholder remote is not a completed upload.

In repository settings:

- Enable Actions for the private repository and approve only the actions actually used. Keep the default workflow token read-only.
- Protect `main` with pull-request review and required `Offline checks and Worker build` verification, where the account plan supports the chosen rules. Verify the exact reported status name after its first real run.
- Keep changes and CI reviews separate from deployment. Do not add hosting, domain, database or provider credentials to this verification workflow.
- Configure supported dependency/security alerts and secret scanning where the private repository's account plan makes them available. The local heuristic is narrower than a complete secret/history scan.
- Use named individual operator accounts with MFA and review access. Never run untrusted contributions on a privileged persistent self-hosted deployment runner.

The GitHub workflow has not run until source is uploaded and GitHub reports an actual run. A local YAML parse or unit test is not evidence of a successful remote run.

## Fail-closed release evidence

`node scripts/check-release-readiness.mjs` requires a clean checkout and defaults to ignored `outputs/release/evidence.json`. It exits nonzero if the manifest or required evidence is missing, stale, modified, for another commit/origin, or unsupported. The script never edits files, fetches a supplied URL, changes DNS or deploys. `--source-only` and `--self-test` do not approve a release.

For the current route, use target kind `sites-cloudflare-worker`, audience `private-test`, and the **actual** final HTTPS origin. A Sites custom domain can use Hostinger DNS while retaining that kind. Target kind `hostinger` is rejected while Worker bindings and trusted Sites identity remain in source, even if an evidence file claims success. Public launch is deliberately outside this private-test gate.

Required checks are: `technical_verification`, `hosting_plan`, `runtime_compatibility`, `authentication_boundary`, `domain_routing`, `private_storage`, `database_migration`, `backup_restore`, `hosted_owner_isolation`, `hosted_headers_tls`, `dependency_review`, `retention_incident_review`, and `rollback_rehearsal`. Each must be `verified`; missing auth, hosting or migration controls cannot be waived as not applicable. Keep unsupported optional integrations disabled and explicitly record their gaps. A `release-blocker` gap fails the gate.

An operator-reviewed manifest uses this structure. The tokens below describe required values; **do not save this example as passed evidence**:

```json
{
  "schemaVersion": 1,
  "commit": "EXACT_40_CHARACTER_COMMIT_SHA",
  "reviewedAt": "ACTUAL_RECENT_UTC_REVIEW_TIMESTAMP",
  "reviewedBy": "ACTUAL_OPERATOR_IDENTIFIER",
  "target": {
    "kind": "sites-cloudflare-worker",
    "audience": "private-test",
    "origin": "ACTUAL_HTTPS_ORIGIN"
  },
  "checks": {
    "authentication_boundary": {
      "status": "verified",
      "file": "outputs/release/authentication-boundary.json",
      "sha256": "SHA256_OF_THE_ACTUAL_REVIEWED_FILE"
    }
  },
  "knownGaps": [
    {"id": "unconfigured-payments", "status": "disabled", "reason": "No live checkout or entitlement is enabled."}
  ]
}
```

Include **all** required check keys, not just the one illustrated. Origin syntax requires a DNS-based HTTPS hostname and denies literal IPv4/IPv6 and local hostnames; the script does not resolve DNS or infer public reachability. Actual domain routing and TLS require the separate observed evidence. Evidence files must be bounded workspace-relative regular JSON files, with no symbolic links or parent traversal. Each contains `schemaVersion:1`, its exact `checkId`, current `commit`, exact origin string, `observedAt` UTC, `result:"pass"` and a bounded `scope` describing the actual observation. Preserve sanitized commands, observed results and reviewer references as appropriate; no tokens, private resumes or customer identifiers. Generate each SHA-256 from its actual bytes after review. A recorded claim and matching hash establish integrity, not independent proof that a test happened. The reviewer must inspect the supporting result; never generate fake passed metadata to satisfy the script.

Review and observations must be no older than 30 days and must still apply to the same source commit and chosen origin. Run:

```powershell
node scripts/check-release-readiness.mjs --evidence outputs/release/evidence.json
```

Run this gate locally after the release source commit is fixed, using evidence kept under ignored `outputs/release`. Do not commit an evidence manifest that names its own commit: doing so changes the commit and makes the claim stale. GitHub CI runs the policy self-tests and source prerequisites, not this operator deployment approval. A green CI check cannot substitute for local current-commit evidence or read ignored evidence from your computer. No secrets or fake metadata are needed to make source verification pass.

## Update and rollback sequence

1. Create a small branch from the approved source commit. Change the requested application files; leave private records and historical evidence intact. Review the diff, run local checks, then commit only the intended files. Push to the actual private remote and review the real CI run.
2. Before a runtime update, pause scheduled agents and outbound delivery. Back up D1 and private original/preview objects with encrypted access. Restore into separate private staging, check owner/version/hash/object references, and record the real result.
3. Test the chosen staging runtime with two separate real test accounts: trusted sign-in, denied forged identity headers, denied cross-owner CRUD/export/download, logout/session behaviour, private storage, fresh authentication prerequisites, HTTPS/CSP/no-store and provider gates. Use the existing safe synthetic browser/HTTP checks only in their appropriate local environment.
4. Apply reviewed additive migrations in journal order using the actual hosting platform's supported tool. Record the database/resource identity privately and schema/result evidence. Do not drop tables, reset storage or automatically replay a failed destructive migration. Migration 0006 preserves existing records but its real target execution still requires evidence.
5. For a Sites deployment, use its authorized deployment workflow, unchanged storage bindings and private audience. For a custom domain, request/verify the domain through native Sites support, then enter only its issued records at the actual DNS operator. Test callbacks, host-scoped cookies, assets, API paths, private exports and TLS at the exact custom host before promoting traffic. A source push does not deploy it.
6. Run the evidence gate and record the exact tested commit, app version, migration set, domain state and paused integration configuration. Enable only externally approved features whose own acceptance checks passed. Recheck consent before queued messages; reconcile accepted/uncertain sends before resuming.
7. If health, identity or data checks fail, pause external work and restore the previous supported app version/route. Keep additive database columns/tables intact. Restore data only through a reviewed compatible recovery procedure; restoring the app and restoring the database are separate decisions. Never automatically reverse migrations or replay uncertain submissions/messages.
8. Keep the previous DNS zone and native domain association for a reviewed DNS rollback when needed. DNS caches and certificate/identity propagation mean changing a record is not instantaneous proof of recovery. Recheck the old origin and verify actual recovery before reopening work.

There is no automatic deployment, payment activation, account/data reset, domain transfer or rollback execution in the delivered CI. Hostinger application-plan access, actual GitHub ownership, the chosen domain, deployed identity evidence and migration/backup results remain external dependencies until observed.

## Actual verification of these new files

The readiness script's 36 synthetic policy checks and source-prerequisite check were executed locally on 2026-10-13. They cover missing required auth/migration evidence, stale/wrong-commit records, public audience denial, unsupported Hostinger runtime, known blockers and unsafe evidence paths. They do not demonstrate successful GitHub CI, custom-domain DNS, hosted authentication, Hostinger deployment, backup restoration or a production launch. The default gate is expected to fail while this checkout is modified or release evidence is missing. Repeat the checks above and preserve fresh results under ignored `outputs` rather than overwriting older test reports.
