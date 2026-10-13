#!/usr/bin/env node
/** Local evidence gate only. It neither authenticates operators nor deploys. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const requiredChecks = [
  'technical_verification', 'hosting_plan', 'runtime_compatibility',
  'authentication_boundary', 'domain_routing', 'private_storage', 'database_migration',
  'backup_restore', 'hosted_owner_isolation', 'hosted_headers_tls',
  'dependency_review', 'retention_incident_review', 'rollback_rehearsal',
];
function git(...values) { return execFileSync('git', ['-C', root, ...values], { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value; }
function onlyKeys(value, keys, label) { if (Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${label} includes unsupported fields.`); }
function text(value, label, max = 250) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`${label} must be bounded plain text.`); return value; }
function relativeFile(value) { const name = text(value, 'Evidence path', 500); if (path.isAbsolute(name) || /^[A-Za-z]:/.test(name) || name.includes('\\') || name.split('/').some(part => ['', '.', '..'].includes(part))) throw new Error('Evidence paths must be simple workspace-relative paths.'); return name; }
function sourceFile(name) { return readFileSync(path.join(root, name), 'utf8'); }
function parseJSON(value, label) { try { return JSON.parse(value); } catch { throw new Error(label + ' is not valid JSON; review its contents locally.'); } }
function checkedFile(name) {
  const relative = relativeFile(name), location = path.resolve(root, relative);
  if (!location.startsWith(path.resolve(root) + path.sep)) throw new Error('Evidence must remain in this checkout.');
  let current = root;
  for (const piece of relative.split('/')) { current = path.join(current, piece); if (lstatSync(current).isSymbolicLink()) throw new Error('Evidence must not use symbolic links.'); }
  const resolved = realpathSync(location);
  if (!resolved.startsWith(realpathSync(root) + path.sep) || !lstatSync(resolved).isFile() || lstatSync(resolved).size > 256_000) throw new Error('Evidence must be a bounded regular file in this checkout.');
  return readFileSync(resolved);
}
function recent(value, now, label) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new Error(`${label} needs a UTC timestamp.`); const time = Date.parse(value); if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19) || time > now + 300_000 || time < now - 30 * 86_400_000) throw new Error(`${label} is stale or invalid; repeat the check for this release.`); }
function originURL(value) { const raw = text(value, 'Target origin', 300), url = new URL(raw); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port || !url.hostname.includes('.') || /^[\d.]+$|\[|\.(?:local|localhost|internal)$/i.test(url.hostname)) throw new Error('Use a DNS-based HTTPS origin without credentials, path or query. Literal IPs and local hostnames are denied; public routing requires separate evidence.'); return url.origin; }
function unsafeTrackedFile(name) { const n = name.replaceAll('\\', '/'); return /(^|\/)(?:\.env(?:\.|$)|\.dev\.vars(?:\.|$)|\.wrangler\/|\.sites-runtime\/)/.test(n) && !/\.example$/.test(n) || /\.(?:pem|key|p12|pfx|secret|db|sqlite|sqlite3)$/i.test(n); }
function validateManifest(value, commit, now, workerBound) {
  const record = object(value, 'Release evidence'); onlyKeys(record, ['schemaVersion', 'commit', 'reviewedAt', 'reviewedBy', 'target', 'checks', 'knownGaps'], 'Release evidence');
  if (record.schemaVersion !== 1 || record.commit !== commit || !/^[0-9a-f]{40}$/.test(record.commit)) throw new Error('Evidence must identify this exact full source commit.');
  recent(record.reviewedAt, now, 'Operator review'); text(record.reviewedBy, 'Reviewer identifier', 100);
  const target = object(record.target, 'Target'); onlyKeys(target, ['kind', 'audience', 'origin'], 'Target');
  if (!['sites-cloudflare-worker', 'hostinger'].includes(target.kind)) throw new Error('Select the actual hosting target.');
  if (target.audience !== 'private-test') throw new Error('This gate supports private test releases only; public launch needs the outstanding independent acceptance review.');
  const origin = originURL(target.origin);
  if (target.kind === 'hostinger' && workerBound) throw new Error('Hostinger is blocked: source still uses Cloudflare Worker bindings and Sites trusted dispatch. A verified backend/auth migration is required first.');
  const checks = object(record.checks, 'Checks'); onlyKeys(checks, requiredChecks, 'Checks');
  for (const id of requiredChecks) { const check = object(checks[id], `Missing required ${id} evidence`); onlyKeys(check, ['status', 'file', 'sha256'], id); if (check.status !== 'verified' || typeof check.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(check.sha256)) throw new Error(`${id} is unverified. Required controls cannot be waived by this script.`); relativeFile(check.file); }
  if (!Array.isArray(record.knownGaps) || record.knownGaps.length > 100) throw new Error('Include the current known-gap register.');
  for (const gap of record.knownGaps) { object(gap, 'Known gap'); onlyKeys(gap, ['id', 'status', 'reason'], 'Known gap'); text(gap.id, 'Gap identifier', 100); text(gap.reason, 'Gap reason', 1000); if (!['disabled', 'resolved', 'release-blocker'].includes(gap.status)) throw new Error('Known-gap status is invalid.'); if (gap.status === 'release-blocker') throw new Error(`Unresolved launch blocker: ${gap.id}.`); }
  return { record, origin };
}
function prerequisites() {
  const manifest = parseJSON(sourceFile('package.json'), 'Package manifest'), lock = parseJSON(sourceFile('package-lock.json'), 'Package lock');
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) throw new Error('A supported committed npm lockfile is required.');
  for (const name of ['install:ci', 'test', 'typecheck', 'build']) if (typeof manifest.scripts?.[name] !== 'string') throw new Error(`Missing repeatable ${name} command.`);
  for (const name of ['scripts/install-ci.mjs', 'scripts/run-framework.mjs', 'tests/release-secrets.mjs', 'db/schema.ts', '.openai/hosting.json', 'build/sites-worker.ts']) sourceFile(name);
  const hosting = parseJSON(sourceFile('.openai/hosting.json'), 'Runtime descriptor');
  if (hosting.d1 !== 'DB' || hosting.r2 !== 'BUCKET') throw new Error('Current Worker storage binding names differ; explicitly review the runtime migration.');
  const journal = parseJSON(sourceFile('drizzle/meta/_journal.json'), 'Migration journal');
  if (!Array.isArray(journal.entries) || !journal.entries.length) throw new Error('Migration journal is missing.');
  for (const entry of journal.entries) { if (!/^[0-9]{4}_[A-Za-z0-9_-]+$/.test(entry.tag)) throw new Error('Unexpected migration identifier.'); sourceFile(`drizzle/${entry.tag}.sql`); }
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
  const unsafe = tracked.find(unsafeTrackedFile);
  if (unsafe) throw new Error(`A private configuration or key filename is tracked: ${unsafe}. Remove it and review/rotate any exposed value.`);
  const workerBound = sourceFile('app/api/career/[...path]/route.ts').includes('cloudflare:workers') || /oai-authenticated-user-id/.test(sourceFile('app/chatgpt-auth.ts'));
  return { commit: git('rev-parse', 'HEAD'), migrationCount: journal.entries.length, workerBound };
}
function selfTest() {
  let checks = 0;
  const rejects = fn => { assert.throws(fn); checks++; };
  for (const name of ['../secrets', '/tmp/private', 'C:/private', 'a\\b', 'a//b', './a']) rejects(() => relativeFile(name));
  assert.equal(relativeFile('outputs/release/auth.json'), 'outputs/release/auth.json'); checks++;
  for (const url of ['http://example.com', 'https://localhost', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?token=a', 'https://172.16.1.1', 'https://172.31.255.254', 'https://100.64.0.1', 'https://100.127.255.254', 'https://[::1]', 'https://server.internal']) rejects(() => originURL(url));
  for (const name of ['private.db', 'state.sqlite', 'state.sqlite3', 'private.key', 'cert.p12', 'cert.pfx']) { assert.equal(unsafeTrackedFile(name), true); checks++; }
  assert.equal(unsafeTrackedFile('.env.example'), false); checks++;
  assert.equal(unsafeTrackedFile('drizzle/0006_example.sql'), false); checks++;
  const now = Date.parse('2026-10-13T00:00:00Z'), commit = 'a'.repeat(40), required = Object.fromEntries(requiredChecks.map(id => [id, { status: 'verified', file: `outputs/release/${id}.json`, sha256: 'b'.repeat(64) }]));
  const fixture = () => ({ schemaVersion: 1, commit, reviewedAt: '2026-10-13T00:00:00Z', reviewedBy: 'synthetic reviewer', target: { kind: 'sites-cloudflare-worker', audience: 'private-test', origin: 'https://example.com' }, checks: structuredClone(required), knownGaps: [{ id: 'payments', status: 'disabled', reason: 'No live payment feature.' }] });
  assert.equal(validateManifest(fixture(), commit, now, true).origin, 'https://example.com'); checks++;
  rejects(() => validateManifest(fixture(), 'c'.repeat(40), now, true));
  const missing = fixture(); delete missing.checks.authentication_boundary; rejects(() => validateManifest(missing, commit, now, true));
  const missingDomain = fixture(); delete missingDomain.checks.domain_routing; rejects(() => validateManifest(missingDomain, commit, now, true));
  rejects(() => recent('2026-02-30T00:00:00Z', Date.parse('2026-03-02T00:00:00Z'), 'Invalid calendar'));
  const waived = fixture(); waived.checks.database_migration.status = 'not_applicable'; rejects(() => validateManifest(waived, commit, now, true));
  const hostinger = fixture(); hostinger.target.kind = 'hostinger'; rejects(() => validateManifest(hostinger, commit, now, true));
  const publicSite = fixture(); publicSite.target.audience = 'public'; rejects(() => validateManifest(publicSite, commit, now, true));
  const stale = fixture(); stale.reviewedAt = '2026-01-01T00:00:00Z'; rejects(() => validateManifest(stale, commit, now, true));
  const blocked = fixture(); blocked.knownGaps[0].status = 'release-blocker'; rejects(() => validateManifest(blocked, commit, now, true));
  console.log(JSON.stringify({ scope: 'synthetic release-policy tests only; no deployment evidence', passed: checks }));
}
try {
  if (args.length === 1 && args[0] === '--self-test') { selfTest(); }
  else if (args.length === 1 && args[0] === '--help') { console.log('Usage: node scripts/check-release-readiness.mjs [--source-only | --self-test | --evidence workspace/relative/manifest.json]\nDefault requires outputs/release/evidence.json. No command deploys or writes evidence.'); }
  else {
    if (args.length && !(args.length === 1 && args[0] === '--source-only') && !(args.length === 2 && args[0] === '--evidence')) throw new Error('Unsupported options. Use --help.');
    const current = prerequisites();
    if (args[0] === '--source-only') console.log(JSON.stringify({ scope: 'source prerequisites only; release NOT approved', passed: true, ...current, targetStatus: 'Worker/Sites-bound; Hostinger migration unverified' }));
    else {
      if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('The checkout is modified. Commit reviewed source first; evidence must match the exact clean release commit.');
      const name = args[0] === '--evidence' ? args[1] : 'outputs/release/evidence.json', data = checkedFile(name), manifest = parseJSON(data.toString('utf8'), 'Release evidence');
      const { record, origin } = validateManifest(manifest, current.commit, Date.now(), current.workerBound);
      for (const id of requiredChecks) {
        const entry = record.checks[id], bytes = checkedFile(entry.file);
        if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`${id} evidence changed after review.`);
        const proof = object(parseJSON(bytes.toString('utf8'), 'Check proof'), `${id} proof`);
        if (proof.schemaVersion !== 1 || proof.checkId !== id || proof.commit !== current.commit || proof.origin !== origin || proof.result !== 'pass') throw new Error(`${id} proof does not establish a passed current-commit check on the chosen origin.`);
        recent(proof.observedAt, Date.now(), `${id} observation`); text(proof.scope, `${id} scope`, 2000);
      }
      console.log(JSON.stringify({ scope: 'operator evidence integrity for private staging only', passed: true, commit: current.commit, target: record.target.kind, checks: requiredChecks.length, deploymentPerformed: false, limitation: 'Metadata and hashes do not independently prove test execution or replace security review.' }));
    }
  }
} catch (error) {
  // Report reasons, never evidence contents, tokens, environment or private keys.
  console.error(`RELEASE_NOT_READY: ${error.code === 'ENOENT' ? 'Required local evidence or source file is missing.' : error.message}`);
  process.exitCode = 1;
}
