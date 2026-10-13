import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://dolphincreation.com';
const email='admin-owner@example.test';
const password='Private synthetic Worker password 927!';
await mkdir('outputs/admin-worker',{recursive:true});
await build({stdin:{contents:'import {handleAdminRequest} from "./lib/career-admin-auth.ts"; export default {fetch:(request,env)=>handleAdminRequest(request,env,{getNativeOwner:async()=>({userId:"worker-fixture-owner"})})};',resolveDir:process.cwd(),sourcefile:'admin-test-worker.ts',loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',conditions:['workerd','worker','browser'],external:['node:*','cloudflare:*'],outfile:'outputs/admin-worker/worker.mjs',logLevel:'silent'});
const mf=new Miniflare(convertV4MiniflareOptions({scriptPath:'outputs/admin-worker/worker.mjs',modules:true,compatibilityDate:'2026-10-13',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'isolated-admin-test'},bindings:{CAREER_ADMIN_ENABLED:'true',CAREER_ADMIN_AUTH_SECRET:randomBytes(32).toString('base64url'),CAREER_ADMIN_BOOTSTRAP_OWNER_ID:'worker-fixture-owner',CAREER_ADMIN_EMAIL:email,CAREER_PUBLIC_ORIGIN:origin}}));
try{
const db=await mf.getD1Database('DB');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){for(const statement of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();}
let cookie='';let checks=0;
async function call(path,body){const headers={...(cookie?{cookie}:{}),...(body===undefined?{}:{origin,'content-type':'application/json','x-career-action':'1'})};const response=await mf.dispatchFetch(origin+'/api/admin/'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});const jar=new Map(cookie.split(';').filter(Boolean).map(c=>{const i=c.indexOf('=');return[c.slice(0,i).trim(),c.slice(i+1)];}));for(const c of response.headers.getSetCookie()){const pair=c.split(';',1)[0],i=pair.indexOf('=');if(pair.slice(i+1))jar.set(pair.slice(0,i),pair.slice(i+1));else jar.delete(pair.slice(0,i));}cookie=Array.from(jar,([k,v])=>k+'='+v).join('; ');return{status:response.status,data:await response.json(),headers:response.headers};}
assert.equal((await call('health')).status,401);checks++;
let r=await call('auth/bootstrap',{email,password});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.stage,'enroll_totp');assert.equal(Object.hasOwn(r.data,'token'),false);checks++;
assert.equal((await call('health')).status,403);checks++;
r=await call('auth/totp/enroll',{password});assert.equal(r.status,200,JSON.stringify(r.data));const secret=new URL(r.data.totpURI).searchParams.get('secret');let bits='';for(const c of secret)bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');const bytes=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)));function code(offset=0){const n=Buffer.alloc(8);n.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));const hash=createHmac('sha1',bytes).update(n).digest(),at=hash[19]&15;return((hash.readUInt32BE(at)&0x7fffffff)%1000000).toString().padStart(6,'0');}checks++;
r=await call('auth/totp/verify',{code:code()});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(Object.hasOwn(r.data,'token'),false);for(const c of r.headers.getSetCookie()){assert.match(c,/Secure/);assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);assert.doesNotMatch(c,/Domain=/);}checks++;
assert.equal((await call('health')).status,200);checks++;
const copied=cookie;assert.equal((await call('auth/sign-out',{})).status,200);cookie=copied;assert.equal((await call('health')).status,401);checks++;
r=await call('auth/sign-in',{email,password});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.stage,'verify_totp');assert.equal((await call('health')).status,401);checks++;
assert.equal((await call('auth/totp/verify',{code:code(1)})).status,200);assert.equal((await call('health')).status,200);checks++;
console.log(JSON.stringify({runtime:'actual local workerd/Miniflare with native D1 binding',checks,result:'passed',hostedIdentityVerified:false}));
}finally{await mf.dispose();}
