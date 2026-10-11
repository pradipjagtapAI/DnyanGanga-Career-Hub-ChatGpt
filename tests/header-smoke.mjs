import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=await fetch('http://127.0.0.1:8787/demo');assert.equal(r.status,200);const expected={'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'};for(const [k,v] of Object.entries(expected))assert.equal(r.headers.get(k),v);assert.ok(r.headers.get('content-security-policy')?.includes("object-src 'none'"));assert.ok(r.headers.get('permissions-policy')?.includes('microphone=()'));
const p=await fetch('http://127.0.0.1:8787/api/career/state');assert.equal(p.status,401);assert.ok(p.headers.get('cache-control')?.includes('no-store'));
fs.writeFileSync('docs/header-results.json',JSON.stringify({passed:true,checks:7,scope:'Built Worker on loopback; HSTS applies only to HTTPS and was not locally verified',csp:r.headers.get('content-security-policy')},null,2));console.log(JSON.stringify({passed:true,checks:7}));
