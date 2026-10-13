import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import {makeSignature,constantTimeEqual} from "better-auth/crypto";
import {parseCookies} from "better-auth/cookies";
import { CareerError, assertMutationRequest, keys, readJsonBounded, string } from "./career-core";

/** Administrator credentials form a separate identity realm, never a candidate
 * account. Only this bounded REST surface can invoke the private auth instance. */
export type AdminAuthEnv = { DB?:D1Database; CAREER_ADMIN_ENABLED?:string; CAREER_ADMIN_AUTH_SECRET?:string; CAREER_ADMIN_BOOTSTRAP_OWNER_ID?:string; CAREER_ADMIN_EMAIL?:string; CAREER_PUBLIC_ORIGIN?:string };
export type NativeOwner = {userId:string} | null;
export type AdminPrincipal = {userId:string;email:string;sessionId:string;generation:number;mfaFreshUntil:string};
export type AdminAuthDependencies = {getNativeOwner?:()=>Promise<NativeOwner>; now?:()=>number};
export const ADMIN_SESSION_SECONDS=3600;
export const ADMIN_FRESH_SECONDS=300;
const COOKIE_PREFIX="__Secure-career_admin";
const PRIVATE_HEADERS={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Vary":"Cookie","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"};
const POST_PATHS=new Set(["auth/bootstrap","auth/sign-in","auth/totp/enroll","auth/totp/verify","auth/sign-out","auth/revoke-all"]);
function q(db:D1Database,sql:string,...values:(string|number|null)[]){return db.prepare(sql).bind(...values);}
function response(value:unknown,status=200,cookies:Headers|null=null){const headers=new Headers(PRIVATE_HEADERS);if(cookies)for(const cookie of cookies.getSetCookie())headers.append("Set-Cookie",cookie);return Response.json(value,{status,headers});}
function adminOrigin(env:AdminAuthEnv){try{const u=new URL(env.CAREER_PUBLIC_ORIGIN??"");if(u.protocol!=="https:"||u.username||u.password||u.port||u.pathname!=="/"||u.search||u.hash||!u.hostname.includes(".")||u.hostname==="localhost"||/^[\d.]+$/.test(u.hostname)||u.hostname.startsWith("["))return null;return u.origin;}catch{return null;}}
export function adminAuthAvailability(env:AdminAuthEnv){const secret=env.CAREER_ADMIN_AUTH_SECRET;const configured=env.CAREER_ADMIN_ENABLED==="true"&&Boolean(env.DB&&adminOrigin(env)&&Boolean(env.CAREER_ADMIN_EMAIL&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.CAREER_ADMIN_EMAIL.trim())&&!/REPLACE|PLACEHOLDER/i.test(env.CAREER_ADMIN_EMAIL))&&secret&&secret.length>=32&&secret.length<=512&&!/REPLACE|PLACEHOLDER|CHANGEME/i.test(secret)&&new Set(secret).size>=8);return {configured,reason:configured?"Separate administrator sign-in requires a password and a fresh authenticator code.":"Administrator authentication is not configured. The owner must complete server-side setup."};}
function configuration(env:AdminAuthEnv){if(!adminAuthAvailability(env).configured)throw new CareerError(503,"ADMIN_AUTH_UNAVAILABLE",adminAuthAvailability(env).reason);return {db:env.DB!,origin:adminOrigin(env)!,secret:env.CAREER_ADMIN_AUTH_SECRET!};}
async function keyedHash(secret:string,value:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");}
async function event(db:D1Database,action:string,actorId:string|null,outcome:string){await q(db,"INSERT INTO career_admin_security_events(id,action,actor_id,outcome,created_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),action,actorId,outcome,new Date().toISOString()).run();}
/** Unauthenticated denials share one bounded audit admission bucket. The fixed
 * counter records excess volume while additional private rows are suppressed;
 * successful security events retain their separate durable audit path. */
async function denialEvent(db:D1Database,action:string,actorId:string|null,outcome:string,now=Date.now()){
  if((await consumeAdminLimit(db,"admin-denial-audit",60,60,now)).allowed)await event(db,action,actorId,outcome);
}
/** Atomic fixed-window reservation: no caller-provided forwarded IP can select
 * or evade a bucket. Account keys are keyed hashes, never plaintext emails. */
export async function consumeAdminLimit(db:D1Database,key:string,windowSeconds:number,max:number,now=Date.now()){
  const start=Math.floor(now/(windowSeconds*1000))*windowSeconds*1000;
  const row=await q(db,"INSERT INTO career_admin_throttle(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN MIN(count+1,?) ELSE 1 END,window_start=excluded.window_start RETURNING count",key,start,max+1).first<{count:number}>();
  if(!row)throw new CareerError(503,"ADMIN_AUTH_UNAVAILABLE","Administrator authentication is temporarily unavailable.");
  return {allowed:row.count<=max,retryAfter:row.count<=max?null:Math.max(1,Math.ceil((start+windowSeconds*1000-now)/1000))};
}
const cache=new WeakMap<D1Database,Map<string,ReturnType<typeof buildAuth>>>();
function authInstance(env:AdminAuthEnv,bootstrap=false){
  const {db,origin,secret}=configuration(env);const key=`${origin}:${secret}:${bootstrap}`;let instances=cache.get(db);if(!instances){instances=new Map();cache.set(db,instances);}const existing=instances.get(key);if(existing)return existing;const auth=buildAuth(env,bootstrap);instances.set(key,auth);return auth;
}
function buildAuth(env:AdminAuthEnv,bootstrap=false){
  const {db,origin,secret}=configuration(env);return betterAuth({
    appName:"DnyanGanga Career Hub Administration",baseURL:origin,basePath:"/api/admin-auth-internal",secret,database:db,trustedOrigins:[origin],telemetry:{enabled:false},logger:{disabled:true},
    emailAndPassword:{enabled:true,disableSignUp:!bootstrap,minPasswordLength:14,maxPasswordLength:128,autoSignIn:true,requireEmailVerification:false,revokeSessionsOnPasswordReset:true},
    user:{modelName:"career_admin_users",fields:{emailVerified:"email_verified",createdAt:"created_at",updatedAt:"updated_at"}},
    session:{modelName:"career_admin_sessions",fields:{userId:"user_id",expiresAt:"expires_at",createdAt:"created_at",updatedAt:"updated_at",ipAddress:"ip_address",userAgent:"user_agent"},expiresIn:ADMIN_SESSION_SECONDS,disableSessionRefresh:true,freshAge:ADMIN_FRESH_SECONDS,cookieCache:{enabled:false}},
    account:{modelName:"career_admin_accounts",fields:{userId:"user_id",accountId:"account_id",providerId:"provider_id",accessToken:"access_token",refreshToken:"refresh_token",idToken:"id_token",accessTokenExpiresAt:"access_token_expires_at",refreshTokenExpiresAt:"refresh_token_expires_at",createdAt:"created_at",updatedAt:"updated_at"},accountLinking:{enabled:false}},
    verification:{modelName:"career_admin_verifications",fields:{expiresAt:"expires_at",createdAt:"created_at",updatedAt:"updated_at"}},
    plugins:[twoFactor({issuer:"DnyanGanga Admin",twoFactorCookieMaxAge:300,skipVerificationOnEnable:false,allowPasswordless:false,accountLockout:{enabled:true,maxFailedAttempts:5,durationSeconds:300},twoFactorTable:"career_admin_two_factors",schema:{user:{fields:{twoFactorEnabled:"two_factor_enabled"}},twoFactor:{fields:{userId:"user_id",backupCodes:"backup_codes",failedVerificationCount:"failed_verification_count",lockedUntil:"locked_until"}}}})],
    advanced:{useSecureCookies:true,disableCSRFCheck:false,disableOriginCheck:false,crossSubDomainCookies:{enabled:false},cookiePrefix:"career_admin",defaultCookieAttributes:{secure:true,httpOnly:true,sameSite:"strict",path:"/"},cookies:{session_token:{name:"career_admin_session"},two_factor:{name:"career_admin_challenge"},trust_device:{name:"career_admin_trust"},dont_remember:{name:"career_admin_dont_remember"}},ipAddress:{disableIpTracking:true},database:{generateId:"uuid",validateSchema:true}},
    rateLimit:{enabled:true,window:60,max:30,customStorage:{consume:async(key,rule)=>consumeAdminLimit(db,`better:${await keyedHash(secret,key)}`,rule.window,rule.max)}},
  });
}
function authHeaders(request:Request){const h=new Headers();h.set("Origin",new URL(request.url).origin);h.set("Content-Type","application/json");h.set("User-Agent","career-admin");const cookies=(request.headers.get("cookie")??"").split(";").map(c=>c.trim()).filter(c=>c.startsWith(`${COOKIE_PREFIX}_`)&&!c.startsWith(`${COOKIE_PREFIX}_trust=`));if(cookies.length)h.set("Cookie",cookies.join("; "));return h;}
function withCookies(request:Request,headers:Headers){const h=authHeaders(request),current=new Map((h.get("cookie")??"").split(";").filter(Boolean).map(c=>{const i=c.indexOf("=");return[c.slice(0,i).trim(),c.slice(i+1)];}));for(const c of headers.getSetCookie()){const pair=c.split(";",1)[0],i=pair.indexOf("=");current.set(pair.slice(0,i),pair.slice(i+1));}h.set("cookie",Array.from(current,([k,v])=>`${k}=${v}`).join("; "));return new Request(request.url,{headers:h});}
async function signedChallenge(request:Request,secret:string){const value=parseCookies(request.headers.get("cookie")??"").get(`${COOKIE_PREFIX}_challenge`);if(!value||value.length>1024)return null;const at=value.lastIndexOf(".");if(at<1)return null;const identifier=value.slice(0,at),signature=value.slice(at+1);if(!/^2fa-[a-zA-Z0-9_-]{20}$/.test(identifier)||signature.length!==44)return null;return constantTimeEqual(await makeSignature(identifier,secret),signature)?identifier:null;}
/** Invalid cookie strings must never create distinct durable rate-limit rows.
 * Only an existing permitted member or its signed, unexpired challenge gets an
 * account bucket; every other request shares one anonymous bucket. */
async function totpLimitIdentity(request:Request,env:AdminAuthEnv,old:Awaited<ReturnType<typeof session>>,now:number){
  const {db,secret}=configuration(env);const email=env.CAREER_ADMIN_EMAIL!.trim().toLowerCase();
  if(old&&old.user.email.trim().toLowerCase()===email){const member=await membership(db,old.user.id);if(member?.role==="owner"&&member.enabled===1)return old.user.id;}
  const challenge=await signedChallenge(request,secret);
  if(challenge){const row=await q(db,"SELECT v.value AS user_id,v.expires_at FROM career_admin_verifications v JOIN career_admin_memberships m ON m.user_id=v.value JOIN career_admin_users u ON u.id=m.user_id WHERE v.identifier=? AND m.role='owner' AND m.enabled=1 AND LOWER(u.email)=?",challenge,email).first<{user_id:string;expires_at:string}>();if(row&&Date.parse(row.expires_at)>now)return row.user_id;}
  return "anonymous";
}
async function callAuth(request:Request,env:AdminAuthEnv,path:string,payload:unknown,bootstrap=false){const {origin}=configuration(env);return authInstance(env,bootstrap).handler(new Request(`${origin}/api/admin-auth-internal${path}`,{method:"POST",headers:authHeaders(request),body:JSON.stringify(payload)}));}
async function session(request:Request,env:AdminAuthEnv){return authInstance(env).api.getSession({headers:authHeaders(request),query:{disableCookieCache:true,disableRefresh:true}});}
async function membership(db:D1Database,userId:string){return q(db,"SELECT * FROM career_admin_memberships WHERE user_id=?",userId).first<{user_id:string;role:string;enabled:number;generation:number;workspace_user_id:string}>();}
async function activeMember(db:D1Database,userId:string){const row=await membership(db,userId);if(!row||row.role!=="owner"||row.enabled!==1)throw new CareerError(403,"ADMIN_FORBIDDEN","Administrator access is not permitted.");return row;}
export async function requireAdminSession(request:Request,env:AdminAuthEnv,deps:AdminAuthDependencies={},fresh=true):Promise<AdminPrincipal>{
  const {db,origin}=configuration(env);if(new URL(request.url).origin!==origin)throw new CareerError(403,"ADMIN_ORIGIN_REJECTED","Use the configured administrator website.");
  const found=await session(request,env);if(!found)throw new CareerError(401,"ADMIN_SIGN_IN_REQUIRED","Sign in to administration.");const member=await activeMember(db,found.user.id);if(found.user.email.trim().toLowerCase()!==env.CAREER_ADMIN_EMAIL?.trim().toLowerCase())throw new CareerError(403,"ADMIN_FORBIDDEN","Administrator access is not permitted.");
  const factor=await q(db,"SELECT verified FROM career_admin_two_factors WHERE user_id=?",found.user.id).first<{verified:number}>();
  const proof=await q(db,"SELECT * FROM career_admin_mfa_proofs WHERE session_id=? AND user_id=?",found.session.id,found.user.id).first<{generation:number;verified_at:number;expires_at:number}>();const now=(deps.now??Date.now)();
  if(!found.user.twoFactorEnabled||factor?.verified!==1||!proof||proof.generation!==member.generation||proof.verified_at>now||(fresh?proof.expires_at<=now:proof.verified_at+ADMIN_SESSION_SECONDS*1000<=now)||Date.parse(String(found.session.expiresAt))<=now)throw new CareerError(403,"ADMIN_MFA_REQUIRED","Verify a fresh authenticator code to continue.");
  return {userId:found.user.id,email:found.user.email,sessionId:found.session.id,generation:member.generation,mfaFreshUntil:new Date(proof.expires_at).toISOString()};
}
async function status(request:Request,env:AdminAuthEnv,deps:AdminAuthDependencies){
  const availability=adminAuthAvailability(env);if(!availability.configured)return {configured:false,setupAvailable:false,stage:"unconfigured",admin:null,mfaFreshUntil:null,reason:availability.reason};
  const {db}=configuration(env);const bootstrap=await q(db,"SELECT status FROM career_admin_bootstrap WHERE key='first-owner'").first<{status:string}>();
  const owner=await deps.getNativeOwner?.();const setupAvailable=!bootstrap&&Boolean(env.CAREER_ADMIN_BOOTSTRAP_OWNER_ID&&owner?.userId===env.CAREER_ADMIN_BOOTSTRAP_OWNER_ID);
  const found=await session(request,env);
  if(!found)return {configured:true,setupAvailable,stage:setupAvailable?"needs_setup":(request.headers.get("cookie")??"").includes(`${COOKIE_PREFIX}_challenge=`)?"verify_totp":"signed_out",admin:null,mfaFreshUntil:null};
  await activeMember(db,found.user.id);
  if(!found.user.twoFactorEnabled)return {configured:true,setupAvailable:false,stage:"enroll_totp",admin:{email:found.user.email},mfaFreshUntil:null};
  try{const principal=await requireAdminSession(request,env,deps);return {configured:true,setupAvailable:false,stage:"authenticated",admin:{email:principal.email},mfaFreshUntil:principal.mfaFreshUntil};}
  catch(error){if(!(error instanceof CareerError&&error.code==="ADMIN_MFA_REQUIRED"))throw error;return {configured:true,setupAvailable:false,stage:"reauthenticate",admin:{email:found.user.email},mfaFreshUntil:null};}
}
function validateEmail(value:unknown){const email=string(value,"Email",254,true).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new CareerError(400,"INVALID_INPUT","Provide a valid administrator email.");return email;}
function password(value:unknown){if(typeof value!=="string"||value.length<14||value.length>128||/[\u0000-\u001f\u007f]/.test(value))throw new CareerError(400,"INVALID_INPUT","Use a password with 14 to 128 characters and no control characters.");return value;}
function clearCookies(){const h=new Headers();for(const key of["session","challenge","trust","dont_remember"])h.append("Set-Cookie",`${COOKIE_PREFIX}_${key}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`);return h;}
async function acceptResponse(result:Response){const data=await result.json().catch(()=>null) as Record<string,unknown>|null;if(!result.ok){const locked=result.status===429;throw new CareerError(locked?429:401,locked?"ADMIN_RATE_LIMITED":"ADMIN_AUTH_FAILED",locked?"Too many attempts. Wait before trying again.":"Sign-in or authenticator verification failed. Check your details and try again.");}if(!data)throw new CareerError(503,"ADMIN_AUTH_UNAVAILABLE","Administrator authentication is unavailable.");return data;}
async function health(principal:AdminPrincipal,db:D1Database){
  const processing=await q(db,"SELECT COUNT(*) AS count FROM career_documents WHERE status='error'").first<{count:number}>();const notifications=await q(db,"SELECT COUNT(*) AS count FROM career_alert_dispatches WHERE status IN ('failed','uncertain')").first<{count:number}>();
  const usage=await q(db,"SELECT COUNT(*) AS requests,COALESCE(SUM(reserved_tokens),0) AS reservedTokens,COALESCE(SUM(actual_tokens),0) AS actualTokens FROM career_ai_usage WHERE day=?",new Date().toISOString().slice(0,10)).first<{requests:number;reservedTokens:number;actualTokens:number}>();
  return {admin:{email:principal.email,mfaFreshUntil:principal.mfaFreshUntil},asOf:new Date().toISOString(),processing:{failedTasks:processing?.count??0},notifications:{failedOrUncertain:notifications?.count??0},ai:{...usage,estimatedCost:null,costBasis:"Actual invoice rates are not configured; no monetary estimate is invented."},access:{privateResumeAccess:false,userManagement:false,providerSecretsVisible:false,billingControls:false}};
}
export async function handleAdminRequest(request:Request,env:AdminAuthEnv,deps:AdminAuthDependencies={}):Promise<Response>{
  let auditDB:D1Database|undefined;let auditAction="";
  try{
    const path=new URL(request.url).pathname.replace(/^\/api\/admin\/?/,"");
    if(request.method==="GET"&&path==="auth/status"){if(adminAuthAvailability(env).configured){const {db,origin}=configuration(env);if(!(await consumeAdminLimit(db,"admin-status-requests",60,120,(deps.now??Date.now)())).allowed)throw new CareerError(429,"ADMIN_RATE_LIMITED","Too many requests. Wait before trying again.");if(new URL(request.url).origin!==origin)throw new CareerError(403,"ADMIN_ORIGIN_REJECTED","Use the configured administrator website.");}return response(await status(request,env,deps));}
    if(request.method==="GET"&&path==="health"){const principal=await requireAdminSession(request,env,deps);const {db}=configuration(env);await event(db,"admin.health",principal.userId,"allowed");return response(await health(principal,db));}
    if(request.method!=="POST"||!POST_PATHS.has(path))return response({error:"This administrator action is not available.",code:"ADMIN_ROUTE_DISABLED"},404);
    const {db,origin,secret}=configuration(env);auditDB=db;auditAction=path;if(new URL(request.url).origin!==origin)throw new CareerError(403,"ADMIN_ORIGIN_REJECTED","Use the configured administrator website.");assertMutationRequest(request);const payload=await readJsonBounded(request,4096);const now=(deps.now??Date.now)();
    const limit=await consumeAdminLimit(db,"all-admin-mutations",60,60,now);if(!limit.allowed)throw new CareerError(429,"ADMIN_RATE_LIMITED","Too many attempts. Wait before trying again.");
    if(path==="auth/bootstrap"){
      keys(payload,["email","password"]);const email=validateEmail(payload.email),pw=password(payload.password),owner=await deps.getNativeOwner?.();if(!env.CAREER_ADMIN_BOOTSTRAP_OWNER_ID||owner?.userId!==env.CAREER_ADMIN_BOOTSTRAP_OWNER_ID){await denialEvent(db,"admin.bootstrap",null,"denied",now);throw new CareerError(403,"ADMIN_SETUP_FORBIDDEN","Only the configured site owner can provision administration.");}
      const existing=await q(db,"SELECT key FROM career_admin_bootstrap WHERE key='first-owner'").first();if(existing)throw new CareerError(409,"ADMIN_SETUP_CLOSED","Administrator provisioning has already started or completed.");
      if(email!==env.CAREER_ADMIN_EMAIL?.trim().toLowerCase())throw new CareerError(403,"ADMIN_EMAIL_NOT_ALLOWED","Use the configured administrator email.");
      const attempt=crypto.randomUUID(),reserved=await q(db,"INSERT OR IGNORE INTO career_admin_bootstrap(key,owner_id,attempt_id,status,created_at) SELECT 'first-owner',?,?,'reserved',? WHERE NOT EXISTS(SELECT 1 FROM career_admin_users)",owner.userId,attempt,new Date(now).toISOString()).run();if(reserved.meta.changes!==1)throw new CareerError(409,"ADMIN_SETUP_CLOSED","Administrator provisioning has already started or completed.");
      let userId:string|null=null;
      try{const result=await callAuth(request,env,"/sign-up/email",{email,password:pw,name:"Site administrator"},true);const data=await acceptResponse(result);const user=data.user as {id?:string}|undefined;if(!user?.id)throw new Error("Invalid provisioning response");userId=user.id;
        await db.batch([q(db,"INSERT INTO career_admin_memberships(user_id,role,enabled,generation,workspace_user_id,created_by_owner,created_at) VALUES(?,'owner',1,0,?,?,?)",userId,owner.userId,owner.userId,new Date(now).toISOString()),q(db,"UPDATE career_admin_bootstrap SET status='completed',user_id=?,completed_at=? WHERE key='first-owner' AND attempt_id=? AND status='reserved'",userId,new Date(now).toISOString(),attempt)]);await event(db,"admin.bootstrap",userId,"completed");return response({ok:true,stage:"enroll_totp",admin:{email}},201,result.headers);
      }catch{await q(db,"UPDATE career_admin_bootstrap SET status='failed' WHERE key='first-owner' AND attempt_id=?",attempt).run();if(userId)await q(db,"DELETE FROM career_admin_sessions WHERE user_id=?",userId).run();await event(db,"admin.bootstrap",userId,"failed");throw new CareerError(503,"ADMIN_SETUP_INCOMPLETE","Provisioning did not complete. The site owner must review the private setup state before retrying.");}
    }
    if(path==="auth/sign-in"){
      keys(payload,["email","password"]);const email=validateEmail(payload.email),pw=password(payload.password);
      if(email!==env.CAREER_ADMIN_EMAIL?.trim().toLowerCase())throw new CareerError(401,"ADMIN_AUTH_FAILED","Sign-in or authenticator verification failed. Check your details and try again.");
      const attempt=await consumeAdminLimit(db,`email:${await keyedHash(secret,email)}`,300,10,now);if(!attempt.allowed)throw new CareerError(429,"ADMIN_RATE_LIMITED","Too many attempts. Wait before trying again.");
      const result=await callAuth(request,env,"/sign-in/email",{email,password:pw,rememberMe:false});const data=await acceptResponse(result);
      if(data.twoFactorRedirect===true){await event(db,"admin.sign_in",null,"totp_required");return response({ok:true,stage:"verify_totp"},200,result.headers);}
      const found=await session(withCookies(request,result.headers),env);if(!found)throw new CareerError(401,"ADMIN_AUTH_FAILED","Administrator sign-in failed.");await activeMember(db,found.user.id);await event(db,"admin.sign_in",found.user.id,"enrollment_only");return response({ok:true,stage:found.user.twoFactorEnabled?"reauthenticate":"enroll_totp"},200,result.headers);
    }
    if(path==="auth/totp/enroll"){
      keys(payload,["password"]);const found=await session(request,env);if(!found)throw new CareerError(401,"ADMIN_SIGN_IN_REQUIRED","Sign in before setting up an authenticator.");await activeMember(db,found.user.id);if(found.user.twoFactorEnabled)throw new CareerError(409,"ADMIN_TOTP_ALREADY_ENABLED","Your authenticator is already enrolled.");
      const result=await callAuth(request,env,"/two-factor/enable",{password:password(payload.password),method:"totp",issuer:"DnyanGanga Admin"});const data=await acceptResponse(result);if(typeof data.totpURI!=="string")throw new Error("Missing enrollment URI");await event(db,"admin.totp_enroll",found.user.id,"pending_confirmation");return response({ok:true,totpURI:data.totpURI,stage:"verify_totp"},200,result.headers);
    }
    if(path==="auth/totp/verify"){
      keys(payload,["code"]);const code=string(payload.code,"Authenticator code",6,true);if(!/^\d{6}$/.test(code))throw new CareerError(400,"INVALID_INPUT","Enter the six-digit authenticator code.");
      const old=await session(request,env);const identity=await totpLimitIdentity(request,env,old,now);const attempts=await consumeAdminLimit(db,`totp:${identity}`,300,10,now);if(!attempts.allowed)throw new CareerError(429,"ADMIN_RATE_LIMITED","Too many attempts. Wait before trying again.");const startingMember=identity==="anonymous"?null:await activeMember(db,identity);if(!startingMember)throw new CareerError(401,"ADMIN_AUTH_FAILED","Sign-in or authenticator verification failed. Check your details and try again.");
      const result=await callAuth(request,env,"/two-factor/verify-totp",{code,trustDevice:false});await acceptResponse(result);const found=await session(withCookies(request,result.headers),env);if(!found)throw new CareerError(401,"ADMIN_AUTH_FAILED","Authenticator verification did not create a valid session.");await activeMember(db,found.user.id);const factor=await q(db,"SELECT verified FROM career_admin_two_factors WHERE user_id=?",found.user.id).first<{verified:number}>();if(found.user.id!==identity||!found.user.twoFactorEnabled||factor?.verified!==1)throw new CareerError(403,"ADMIN_MFA_REQUIRED","Authenticator enrollment is not complete.");
      const hash=await keyedHash(secret,`totp:${found.user.id}:${code}`);await q(db,"DELETE FROM career_admin_totp_replay WHERE expires_at<=?",now).run();
      try{const recorded=await db.batch([q(db,"INSERT INTO career_admin_totp_replay(hash,user_id,expires_at) VALUES(?,?,?)",hash,found.user.id,now+120000),q(db,"INSERT INTO career_admin_mfa_proofs(session_id,user_id,generation,verified_at,expires_at) SELECT ?,m.user_id,m.generation,?,? FROM career_admin_memberships m JOIN career_admin_sessions s ON s.user_id=m.user_id WHERE m.user_id=? AND m.role='owner' AND m.enabled=1 AND m.generation=? AND s.id=? ON CONFLICT(session_id) DO UPDATE SET user_id=excluded.user_id,generation=excluded.generation,verified_at=excluded.verified_at,expires_at=excluded.expires_at",found.session.id,now,now+ADMIN_FRESH_SECONDS*1000,found.user.id,startingMember.generation,found.session.id)]);if(recorded[1].meta.changes!==1)throw new Error("Administrator verification generation changed");}catch{if(old?.session.id!==found.session.id)await q(db,"DELETE FROM career_admin_sessions WHERE id=? AND user_id=?",found.session.id,found.user.id).run();await event(db,"admin.totp_verify",found.user.id,"rejected_or_unavailable");return response({error:"This code was already used or verification could not be recorded. Wait for a new code and try again.",code:"ADMIN_TOTP_REPLAY_OR_UNAVAILABLE"},409,old?.session.id===found.session.id?null:clearCookies());}
      await event(db,"admin.totp_verify",found.user.id,"verified");return response({ok:true,stage:"authenticated",mfaFreshUntil:new Date(now+ADMIN_FRESH_SECONDS*1000).toISOString()},200,result.headers);
    }
    if(path==="auth/sign-out"){
      keys(payload,[]);const found=await session(request,env);const challenge=await signedChallenge(request,secret);if(challenge)await db.batch([q(db,"DELETE FROM career_admin_verifications WHERE identifier=?",challenge),q(db,"DELETE FROM career_admin_verifications WHERE identifier=?",`2fa-attempts-${challenge}`)]);if(found){await db.batch([q(db,"DELETE FROM career_admin_mfa_proofs WHERE session_id=?",found.session.id),q(db,"DELETE FROM career_admin_sessions WHERE id=? AND user_id=?",found.session.id,found.user.id)]);await event(db,"admin.sign_out",found.user.id,"revoked");}return response({ok:true,stage:"signed_out"},200,clearCookies());
    }
    if(path==="auth/revoke-all"){
      keys(payload,[]);const principal=await requireAdminSession(request,env,deps);await db.batch([q(db,"UPDATE career_admin_memberships SET generation=generation+1 WHERE user_id=?",principal.userId),q(db,"DELETE FROM career_admin_mfa_proofs WHERE user_id=?",principal.userId),q(db,"DELETE FROM career_admin_sessions WHERE user_id=?",principal.userId),q(db,"DELETE FROM career_admin_verifications WHERE identifier IN(SELECT '2fa-attempts-'||identifier FROM career_admin_verifications WHERE value=? AND identifier LIKE '2fa-%')",principal.userId),q(db,"DELETE FROM career_admin_verifications WHERE value=? AND identifier LIKE '2fa-%'",principal.userId)]);await event(db,"admin.revoke_all",principal.userId,"revoked");return response({ok:true,stage:"signed_out"},200,clearCookies());
    }
    return response({code:"ADMIN_ROUTE_DISABLED",error:"This administrator action is not available."},404);
  }catch(error){if(auditDB&&auditAction){try{await denialEvent(auditDB,`admin.${auditAction.replaceAll("/",".")}`,null,error instanceof CareerError?error.code:"unavailable",(deps.now??Date.now)());}catch{/* A failed logger never leaks auth data or bypasses denial. */}}if(error instanceof CareerError){const result=response({error:error.message,code:error.code},error.status);if(error.status===429)result.headers.set("Retry-After","60");return result;}return response({error:"Administrator authentication is temporarily unavailable. Contact the site owner with the time of the error.",code:"ADMIN_AUTH_UNAVAILABLE"},503);}
}


/** Career ownership is the immutable, owner-proved legacy record ID. The admin
 * login email is deliberately not copied into the professional profile. */
export async function resolveAdminCareerIdentity(input:Request|Headers,env:AdminAuthEnv,deps:AdminAuthDependencies={}){
  const {db,origin}=configuration(env);const request=input instanceof Request?input:new Request(`${origin}/dashboard`,{headers:input});
  const principal=await requireAdminSession(request,env,deps,false);const member=await activeMember(db,principal.userId);
  const legacy=await q(db,"SELECT profile FROM career_accounts WHERE user_id=?",member.workspace_user_id).first<{profile:string}>();
  const profile=legacy?JSON.parse(legacy.profile) as {email?:string;fullName?:string}:null;
  return {userId:member.workspace_user_id,email:profile?.email??principal.email,fullName:profile?.fullName??null,displayName:profile?.fullName||"Career workspace owner"};
}
