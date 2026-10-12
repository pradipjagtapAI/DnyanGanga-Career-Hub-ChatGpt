// Heuristic release check. Reports paths/rule names only, never matched contents.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const clientRoot = path.resolve('dist/client');
assert.ok(statSync(clientRoot).isDirectory(), 'Build the website before this check.');
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}
const sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(file => /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|sql|py|sh|md)$/.test(file) || /\.env\.example$/.test(file));
const clients = walk(clientRoot).filter(file => /\.(?:[cm]?js|json|html|css|map)$/.test(file));
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['provider-secret', /\b(?:sk_(?:live|test)_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})\b/],
];
const violations = [];
for (const file of new Set([...sources, ...clients])) {
  // This file intentionally contains the detector patterns, not credentials.
  if (file.replaceAll('\\', '/').endsWith('tests/release-secrets.mjs')) continue;
  const content = readFileSync(file, 'utf8');
  for (const [rule, pattern] of rules) if (pattern.test(content)) violations.push({ file: path.relative(process.cwd(), file), rule });
}
const serverNames = ['CAREER_SCHEDULER_SECRET', 'CAREER_VERIFICATION_SECRET', 'DOCUMENT_PROCESSOR_TOKEN', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'WHATSAPP_BUSINESS_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'SITES_SERVICE_BEARER'];
for (const file of clients) {
  const content = readFileSync(file, 'utf8');
  for (const name of serverNames) if (content.includes(name)) violations.push({ file: path.relative(process.cwd(), file), rule: `server-marker:${name}` });
}
const result = { executedAt: new Date().toISOString(), passed: violations.length === 0, sourceFiles: new Set(sources).size,
  clientFiles: clients.length, violations,
  scope: 'Tracked/new source text and built browser assets; known secret formats and selected server-only markers. This is a heuristic, not proof that all possible secrets are absent.' };
writeFileSync(process.env.CAREER_SECRET_RESULTS || 'docs/agentic-secret-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
assert.equal(violations.length, 0, 'Potential exposed secret or server-only marker detected. Review the reported paths privately.');
