import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { makeSignature, constantTimeEqual } from "better-auth/crypto";
import { parseCookies } from "better-auth/cookies";
import { Resend } from "resend";
import { withWorkspaceRealm, selectedWorkspaceRealm } from "./career-auth-realm";
import { CareerError, assertMutationRequest, keys, readJsonBounded, string } from "./career-core";

/** Independent candidate credentials cannot claim administrator or legacy data. */
export type CandidateAuthEnv = {
  DB?: D1Database; CAREER_PUBLIC_ORIGIN?: string;
  CAREER_CANDIDATE_ENABLED?: string; CAREER_CANDIDATE_AUTH_SECRET?: string;
  CAREER_CANDIDATE_EMAIL_ENABLED?: string; RESEND_API_KEY?: string;
  RESEND_FROM?: string; RESEND_SENDER_VERIFIED?: string;
  CAREER_GOOGLE_ENABLED?: string; CAREER_GOOGLE_CLIENT_ID?: string; CAREER_GOOGLE_CLIENT_SECRET?: string;
  CAREER_LINKEDIN_ENABLED?: string; CAREER_LINKEDIN_ACCESS_APPROVED?: string;
  CAREER_LINKEDIN_CLIENT_ID?: string; CAREER_LINKEDIN_CLIENT_SECRET?: string;
  CAREER_INDEED_ENABLED?: string; CAREER_INDEED_ACCESS_APPROVED?: string;
  CAREER_INDEED_CLIENT_ID?: string; CAREER_INDEED_CLIENT_SECRET?: string;
};
export type CandidateMail = { to: string; subject: string; text: string; idempotencyKey: string };
export type CandidateAuthDependencies = { now?: () => number; sendMail?: (message: CandidateMail) => Promise<{ id: string }> };
export const CANDIDATE_SESSION_SECONDS = 3600;
const COOKIE_PREFIX = "__Secure-career_candidate";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Referrer-Policy": "no-referrer" };
const POST_PATHS = new Set(["sign-up", "sign-in", "forgot-password", "reset-password", "resend-verification", "verify-email", "social", "sign-out"]);
const PROVIDERS = ["google", "linkedin", "indeed"] as const;
type Provider = typeof PROVIDERS[number];
function q(db: D1Database, sql: string, ...values: (string | number | null)[]) { return db.prepare(sql).bind(...values); }
function response(value: unknown, status = 200, cookies?: Headers) {
  const headers = new Headers(PRIVATE_HEADERS);
  if (cookies) for (const cookie of cookies.getSetCookie()) headers.append("Set-Cookie", cookie);
  return Response.json(value, { status, headers });
}
function candidateOrigin(env: CandidateAuthEnv) {
  try {
    const u = new URL(env.CAREER_PUBLIC_ORIGIN ?? "");
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash || !u.hostname.includes(".") || u.hostname === "localhost" || /^[\d.]+$/.test(u.hostname) || u.hostname.startsWith("[")) return null;
    return u.origin;
  } catch { return null; }
}
function secretConfigured(value: string | undefined, minimum = 8) {
  return Boolean(value && value.length >= minimum && value.length <= 4096 && !/REPLACE|PLACEHOLDER|CHANGEME/i.test(value) && !/[\r\n]/.test(value));
}
export function candidateAuthAvailability(env: CandidateAuthEnv) {
  const secret = env.CAREER_CANDIDATE_AUTH_SECRET;
  const configured = env.CAREER_CANDIDATE_ENABLED === "true" && Boolean(env.DB && candidateOrigin(env) && secretConfigured(secret, 32) && new Set(secret).size >= 8);
  const sender = env.RESEND_FROM?.trim() ?? "";
  const emailAvailable = configured && env.CAREER_CANDIDATE_EMAIL_ENABLED === "true" && env.RESEND_SENDER_VERIFIED === "true" && secretConfigured(env.RESEND_API_KEY) && Boolean(env.RESEND_API_KEY?.startsWith("re_") && /^[^\r\n]+@[^\r\n]+\.[^\r\n]+$/.test(sender) && !/REPLACE|PLACEHOLDER/i.test(sender));
  const enabled = (provider: Provider) => {
    if (!configured) return false;
    if (provider === "google") return env.CAREER_GOOGLE_ENABLED === "true" && secretConfigured(env.CAREER_GOOGLE_CLIENT_ID) && secretConfigured(env.CAREER_GOOGLE_CLIENT_SECRET);
    if (provider === "linkedin") return env.CAREER_LINKEDIN_ENABLED === "true" && env.CAREER_LINKEDIN_ACCESS_APPROVED === "true" && secretConfigured(env.CAREER_LINKEDIN_CLIENT_ID) && secretConfigured(env.CAREER_LINKEDIN_CLIENT_SECRET);
    return env.CAREER_INDEED_ENABLED === "true" && env.CAREER_INDEED_ACCESS_APPROVED === "true" && secretConfigured(env.CAREER_INDEED_CLIENT_ID) && secretConfigured(env.CAREER_INDEED_CLIENT_SECRET);
  };
  return {
    configured, emailAvailable,
    emailReason: emailAvailable ? "Email sign-up includes a verification link and password recovery." : "Email verification is being set up. Please check back soon.",
    providers: [
      { id: "google", label: "Google / Gmail", enabled: enabled("google"), reason: enabled("google") ? "Sign in with your Google account." : "Google sign-in needs the website owner's Google connection." },
      { id: "linkedin", label: "LinkedIn", enabled: enabled("linkedin"), reason: enabled("linkedin") ? "Sign in with your LinkedIn account." : "LinkedIn sign-in is awaiting an approved connection." },
      { id: "naukri", label: "Naukri", enabled: false, reason: "Naukri sign-in is unavailable until an official identity integration is confirmed." },
      { id: "indeed", label: "Indeed", enabled: enabled("indeed"), reason: enabled("indeed") ? "Sign in with your Indeed account." : "Indeed sign-in is awaiting approved partner access and connection setup." },
    ],
  };
}
function configuration(env: CandidateAuthEnv) {
  if (!candidateAuthAvailability(env).configured) throw new CareerError(503, "ACCOUNT_AUTH_UNAVAILABLE", "Candidate sign-in is not ready. Please try again after setup is complete.");
  return { db: env.DB!, origin: candidateOrigin(env)!, secret: env.CAREER_CANDIDATE_AUTH_SECRET! };
}
async function keyedHash(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
/** Fixed global buckets and existing IDs bound storage; fake emails are not keys. */
export async function consumeCandidateLimit(db: D1Database, key: string, windowSeconds: number, max: number, now = Date.now()) {
  const start = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const row = await q(db, "INSERT INTO career_candidate_throttle(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN MIN(count+1,?) ELSE 1 END,window_start=excluded.window_start RETURNING count", key, start, max + 1).first<{ count: number }>();
  if (!row) throw new CareerError(503, "ACCOUNT_AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable.");
  return { allowed: row.count <= max, retryAfter: row.count <= max ? null : Math.max(1, Math.ceil((start + windowSeconds * 1000 - now) / 1000)) };
}
async function limit(db: D1Database, key: string, window: number, max: number, now: number) {
  if (!(await consumeCandidateLimit(db, key, window, max, now)).allowed) throw new CareerError(429, "ACCOUNT_RATE_LIMITED", "Too many attempts. Please wait before trying again.");
}
async function event(db: D1Database, action: string, actorId: string | null, outcome: string) {
  await q(db, "INSERT INTO career_candidate_security_events(id,action,actor_id,outcome,created_at) VALUES(?,?,?,?,?)", crypto.randomUUID(), action, actorId, outcome, new Date().toISOString()).run();
}
async function denial(db: D1Database, action: string, outcome: string, now: number) {
  if ((await consumeCandidateLimit(db, "denial-audit", 60, 60, now)).allowed) await event(db, action, null, outcome);
}
async function sendMail(env: CandidateAuthEnv, deps: CandidateAuthDependencies, message: CandidateMail) {
  if (!candidateAuthAvailability(env).emailAvailable) throw new CareerError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "Verification emails are not connected yet.");
  if (deps.sendMail) { const result = await deps.sendMail(message); if (!result.id) throw new Error("mail provider did not accept message"); return; }
  const result = await new Resend(env.RESEND_API_KEY!).emails.send({ from: env.RESEND_FROM!, to: [message.to], subject: message.subject, text: message.text }, { idempotencyKey: message.idempotencyKey, signal: AbortSignal.timeout(15000) });
  if (result.error || !result.data?.id) throw new CareerError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "The email service could not accept this request. Please try again later.");
}
function authHeaders(request: Request) {
  const h = new Headers({ Origin: new URL(request.url).origin, "Content-Type": "application/json", "User-Agent": "career-candidate" });
  const cookies = (request.headers.get("cookie") ?? "").split(";").map(c => c.trim()).filter(c => c.startsWith(`${COOKIE_PREFIX}_`));
  if (cookies.length) h.set("Cookie", cookies.join("; "));
  return h;
}
function clearCookies() {
  const h = new Headers();
  for (const key of ["session", "state", "dont_remember", "session_data", "account_data", "oauth_state"]) h.append("Set-Cookie", `${COOKIE_PREFIX}_${key}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`);
  return h;
}
function buildAuth(env: CandidateAuthEnv, deps: CandidateAuthDependencies) {
  const { db, origin, secret } = configuration(env), availability = candidateAuthAvailability(env);
  const enabled = (id: Provider) => availability.providers.find(p => p.id === id)?.enabled;
  const now = () => (deps.now ?? Date.now)();
  const mailReservation = async (userId: string, token: string, purpose: string) => {
    await limit(db, "mail-send", 60, 20, now());
    await limit(db, `mail:${await keyedHash(secret, userId)}`, 900, 5, now());
    const hash = await keyedHash(secret, `${purpose}:${token}`);
    await q(db, "DELETE FROM career_candidate_link_tokens WHERE expires_at<=?", now()).run();
    await q(db, "INSERT INTO career_candidate_link_tokens(hash,purpose,user_id,expires_at,consumed_at) VALUES(?,?,?,?,NULL) ON CONFLICT(hash) DO NOTHING", hash, purpose, userId, now() + 1800000).run();
    return hash;
  };
  return betterAuth({
    appName: "DnyanGanga Career Hub", baseURL: origin, basePath: "/api/account", secret, database: db, trustedOrigins: [origin], telemetry: { enabled: false }, logger: { disabled: true },
    onAPIError: { throw: true, errorURL: `${origin}/login?error=social` },
    emailAndPassword: {
      enabled: true, disableSignUp: !availability.emailAvailable, minPasswordLength: 14, maxPasswordLength: 128, autoSignIn: false, requireEmailVerification: true, revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: async ({ user, token }) => {
        const hash = await mailReservation(user.id, token, "reset");
        await sendMail(env, deps, { to: user.email, subject: "Reset your DnyanGanga Career Hub password", text: `Use this link to reset your password. It expires in 30 minutes:\n${origin}/reset-password?token=${encodeURIComponent(token)}\n\nIf you did not request this, ignore this email.`, idempotencyKey: `candidate-reset/${hash}` });
      },
    },
    emailVerification: {
      expiresIn: 1800, sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const hash = await mailReservation(user.id, token, "verify");
        await sendMail(env, deps, { to: user.email, subject: "Verify your DnyanGanga Career Hub account", text: `Confirm your email to finish creating your account. This link expires in 30 minutes:\n${origin}/verify-email?token=${encodeURIComponent(token)}\n\nIf you did not create an account, ignore this email.`, idempotencyKey: `candidate-verify/${hash}` });
      },
    },
    socialProviders: {
      ...(enabled("google") ? { google: { clientId: env.CAREER_GOOGLE_CLIENT_ID!, clientSecret: env.CAREER_GOOGLE_CLIENT_SECRET!, requireEmailVerification: true, prompt: "select_account" as const, includeGrantedScopes: false } } : {}),
      ...(enabled("linkedin") ? { linkedin: { clientId: env.CAREER_LINKEDIN_CLIENT_ID!, clientSecret: env.CAREER_LINKEDIN_CLIENT_SECRET!, requireEmailVerification: true } } : {}),
    },
    plugins: enabled("indeed") ? [genericOAuth({ config: [{
      providerId: "indeed", name: "Indeed", clientId: env.CAREER_INDEED_CLIENT_ID!, clientSecret: env.CAREER_INDEED_CLIENT_SECRET!,
      authorizationUrl: "https://secure.indeed.com/oauth/v2/authorize", tokenUrl: "https://apis.indeed.com/oauth/v2/tokens", userInfoUrl: "https://secure.indeed.com/v2/api/userinfo", scopes: ["email"], pkce: true,
      accountSubject: ({ profile }) => { if (typeof profile.sub !== "string" || !profile.sub || profile.sub.length > 255) throw new Error("invalid provider subject"); return profile.sub; },
      // Trust only authenticated userinfo over a fixed HTTPS connection.
      // An unverified id_token is never treated as the candidate's identity.
      getUserInfo: async tokens => {
        if (!tokens.accessToken) return null;
        const result = await fetch("https://secure.indeed.com/v2/api/userinfo", { headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
        if (!result.ok) return null;
        const reader = result.body?.getReader(); if (!reader) return null;
        let length = 0; const chunks: Uint8Array[] = []; while (true) { const {done, value} = await reader.read(); if (done) break; length += value.byteLength; if (length > 16384) { await reader.cancel(); return null; } chunks.push(value); }
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
        const data = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        if (typeof data.sub !== "string" || !data.sub || data.sub.length > 255 || typeof data.email !== "string" || data.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return null;
        return { id: data.sub, sub: data.sub, email: data.email.toLowerCase(), emailVerified: true, name: typeof data.name === "string" ? data.name.slice(0, 120) : "Candidate" };
      },
    }] })] : [],
    databaseHooks: { account: { create: { before: async data => ({ data: { ...data, idToken: null } }) }, update: { before: async data => ({ data: { ...data, idToken: null } }) } } },
    user: { modelName: "career_candidate_users", fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" } },
    session: { modelName: "career_candidate_sessions", fields: { userId: "user_id", expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at", ipAddress: "ip_address", userAgent: "user_agent" }, expiresIn: CANDIDATE_SESSION_SECONDS, disableSessionRefresh: true, cookieCache: { enabled: false } },
    account: { modelName: "career_candidate_accounts", fields: { userId: "user_id", accountId: "account_id", providerId: "provider_id", accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at" }, accountLinking: { enabled: false, disableImplicitLinking: true }, storeStateStrategy: "database", storeAccountCookie: false, encryptOAuthTokens: true, updateAccountOnSignIn: false },
    verification: { modelName: "career_candidate_verifications", fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" }, storeIdentifier: "hashed" },
    advanced: { useSecureCookies: true, disableCSRFCheck: false, disableOriginCheck: false, crossSubDomainCookies: { enabled: false }, cookiePrefix: "career_candidate", defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: "lax", path: "/" }, cookies: { session_token: { name: "career_candidate_session" }, state: { name: "career_candidate_state" }, dont_remember: { name: "career_candidate_dont_remember" } }, ipAddress: { disableIpTracking: true }, database: { generateId: "uuid", validateSchema: true } },
    rateLimit: { enabled: true, window: 60, max: 60, customStorage: { consume: async (_key, rule) => consumeCandidateLimit(db, `library:${rule.window}:${rule.max}`, rule.window, rule.max, now()) } },
  });
}
async function session(request: Request, env: CandidateAuthEnv) {
  return buildAuth(env, {}).api.getSession({ headers: authHeaders(request), query: { disableCookieCache: true, disableRefresh: true } });
}
/** UUID namespaces stop email collisions from claiming existing private data. */
export async function resolveCandidateCareerIdentity(input: Request | Headers, env: CandidateAuthEnv) {
  const { origin } = configuration(env);
  const request = input instanceof Request ? input : new Request(`${origin}/dashboard`, { headers: input });
  if (new URL(request.url).origin !== origin) throw new CareerError(403, "ACCOUNT_ORIGIN_REJECTED", "Use the main career website to sign in.");
  const found = await session(request, env);
  if (!found || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(found.user.id)) throw new CareerError(401, "ACCOUNT_SIGN_IN_REQUIRED", "Sign in to your candidate account.");
  const security = await q(env.DB!, "SELECT recovery_pending FROM career_candidate_security_state WHERE user_id=?", found.user.id).first<{ recovery_pending: number }>();
  if (security?.recovery_pending === 1) throw new CareerError(403, "ACCOUNT_RECOVERY_PENDING", "Complete password recovery before opening your workspace.");
  if (found.user.emailVerified !== true || Date.parse(String(found.session.expiresAt)) <= Date.now()) throw new CareerError(403, "ACCOUNT_EMAIL_NOT_VERIFIED", "Verify your email before opening your career workspace.");
  return { userId: `candidate:${found.user.id}`, email: found.user.email, fullName: found.user.name || null, displayName: found.user.name || "Candidate" };
}
function email(value: unknown) { const result = string(value, "Email", 254, true).trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new CareerError(400, "INVALID_INPUT", "Provide a valid email address."); return result; }
function password(value: unknown) { if (typeof value !== "string" || value.length < 14 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) throw new CareerError(400, "INVALID_INPUT", "Use a password with 14 to 128 characters and no control characters."); return value; }
async function callAuth(request: Request, env: CandidateAuthEnv, deps: CandidateAuthDependencies, path: string, payload?: unknown) {
  const { origin } = configuration(env);
  return buildAuth(env, deps).handler(new Request(`${origin}/api/account${path}`, { method: payload === undefined ? "GET" : "POST", headers: authHeaders(request), ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }));
}
async function accept(result: Response) {
  const data = await result.json().catch(() => null) as Record<string, unknown> | null;
  if (result.status >= 500) throw new CareerError(503, "ACCOUNT_AUTH_UNAVAILABLE", "Account sign-in is temporarily unavailable. Please try again later.");
  if (!result.ok || !data) throw new CareerError(result.status === 429 ? 429 : 401, result.status === 429 ? "ACCOUNT_RATE_LIMITED" : "ACCOUNT_AUTH_FAILED", result.status === 429 ? "Too many attempts. Please wait before trying again." : "The request could not be completed. Check your details or request a new verification link.");
  return data;
}
async function tokenReservation(env: CandidateAuthEnv, token: string, purpose: string, now: number) {
  const { db, secret } = configuration(env);
  const hash = await keyedHash(secret, `${purpose}:${token}`);
  const used = await q(db, "UPDATE career_candidate_link_tokens SET consumed_at=? WHERE hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>? RETURNING user_id", now, hash, purpose, now).first<{ user_id: string | null }>();
  if (!used) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "This link is invalid, expired or already used. Request a new link.");
  return used;
}
async function signedState(request: Request, secret: string, state: string) {
  const value = parseCookies(request.headers.get("cookie") ?? "").get(`${COOKIE_PREFIX}_state`);
  if (!value || value.length > 1024) return false;
  const at = value.lastIndexOf(".");
  if (at < 1 || value.slice(0, at) !== state || value.slice(at + 1).length !== 44) return false;
  return constantTimeEqual(await makeSignature(state, secret), value.slice(at + 1));
}
function redirectResponse(destination: string, cookies?: Headers) {
  const headers = new Headers(PRIVATE_HEADERS); headers.set("Location", destination);
  if (cookies) for (const cookie of cookies.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
export async function handleCandidateRequest(request: Request, env: CandidateAuthEnv, deps: CandidateAuthDependencies = {}): Promise<Response> {
  let auditDB: D1Database | undefined; let action = "";
  try {
    const url = new URL(request.url), path = url.pathname.replace(/^\/api\/account\/?/, ""), now = (deps.now ?? Date.now)();
    const availability = candidateAuthAvailability(env);
    if (request.method === "GET" && path === "status") {
      let user = null;
      if (availability.configured) {
        const { db, origin } = configuration(env); await limit(db, "status", 60, 120, now);
        if (url.origin !== origin) throw new CareerError(403, "ACCOUNT_ORIGIN_REJECTED", "Use the main career website to sign in.");
        try { if (selectedWorkspaceRealm(request) !== "admin") { const identity = await resolveCandidateCareerIdentity(request, env); user = { name: identity.fullName, email: identity.email }; } } catch (error) { if (!(error instanceof CareerError && [401, 403].includes(error.status))) throw error; }
      }
      return response({ ...availability, authenticated: Boolean(user), user });
    }
    const callback = /^callback\/(google|linkedin|indeed)$/.exec(path);
    if (request.method === "GET" && callback) {
      const { db, origin, secret } = configuration(env); auditDB = db; action = "oauth_callback";
      if (url.origin !== origin) throw new CareerError(403, "ACCOUNT_ORIGIN_REJECTED", "Use the main career website to sign in.");
      await limit(db, "callbacks", 60, 60, now);
      if (!availability.providers.find(p => p.id === callback[1])?.enabled) return response({ code: "ACCOUNT_PROVIDER_UNAVAILABLE", error: "This sign-in option is not connected." }, 503);
      if (url.search.length > 4096 || Array.from(url.searchParams.keys()).some(key => !["code", "state", "iss", "error", "error_description", "scope", "authuser", "prompt"].includes(key)) || Array.from(new Set(url.searchParams.keys())).some(key => url.searchParams.getAll(key).length !== 1)) throw new CareerError(400, "INVALID_INPUT", "The sign-in callback is invalid.");
      const state = url.searchParams.get("state") ?? "";
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(state) || !(await signedState(request, secret, state))) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "The sign-in request is invalid or expired. Start sign-in again.");
      if (callback[1] === "indeed" && url.searchParams.has("iss") && url.searchParams.get("iss") !== "https://secure.indeed.com") throw new CareerError(401, "ACCOUNT_LINK_INVALID", "The sign-in callback could not be verified.");
      await tokenReservation(env, state, `oauth:${callback[1]}`, now);
      const result = await callAuth(request, env, deps, `/callback/${callback[1]}${url.search}`);
      const location = result.headers.get("Location");
      if (!location) return redirectResponse(`${origin}/login?error=social`, clearCookies());
      const target = new URL(location, origin);
      if (target.origin !== origin || !["/dashboard", "/login"].includes(target.pathname)) return redirectResponse(`${origin}/login?error=social`, clearCookies());
      if (target.pathname === "/dashboard") {
        const next = new Headers(authHeaders(request)); const pairs = result.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]); next.set("cookie", pairs.join("; "));
        try { await resolveCandidateCareerIdentity(new Request(request.url, {headers: next}), env); } catch { return redirectResponse(`${origin}/login?error=social`, clearCookies()); }
      }
      await event(db, "candidate.oauth_callback", null, target.pathname === "/dashboard" ? "completed" : "not_completed");
      return redirectResponse(target.pathname === "/dashboard" ? `${origin}/dashboard` : `${origin}/login?error=social`, target.pathname === "/dashboard" ? withWorkspaceRealm(result.headers, "candidate") : result.headers);
    }
    if (request.method !== "POST" || !POST_PATHS.has(path)) return response({ code: "ACCOUNT_ROUTE_DISABLED", error: "This account action is not available." }, 404);
    const { db, origin, secret } = configuration(env); auditDB = db; action = path;
    if (url.origin !== origin) throw new CareerError(403, "ACCOUNT_ORIGIN_REJECTED", "Use the main career website to sign in.");
    assertMutationRequest(request); const payload = await readJsonBounded(request, 4096); await limit(db, "mutations", 60, 60, now);
    if (path === "sign-out") {
      keys(payload, []); const found = await session(request, env);
      const rawState = parseCookies(request.headers.get("cookie") ?? "").get(`${COOKIE_PREFIX}_state`); const state = rawState?.slice(0, rawState.lastIndexOf("."));
      if (state && /^[A-Za-z0-9_-]{20,128}$/.test(state) && await signedState(request, secret, state)) for (const provider of PROVIDERS) await q(db, "UPDATE career_candidate_link_tokens SET consumed_at=? WHERE hash=? AND purpose=? AND consumed_at IS NULL", now, await keyedHash(secret, `oauth:${provider}:${state}`), `oauth:${provider}`).run();
      if (found) { await q(db, "DELETE FROM career_candidate_sessions WHERE id=? AND user_id=?", found.session.id, found.user.id).run(); await event(db, "candidate.sign_out", found.user.id, "revoked"); }
      return response({ ok: true }, 200, withWorkspaceRealm(clearCookies(), "candidate"));
    }
    if (path === "verify-email") {
      keys(payload, ["token"]); const token = string(payload.token, "Verification token", 2000, true); await limit(db, "verify", 60, 30, now);
      if (!/^[A-Za-z0-9_.-]{32,2000}$/.test(token)) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "The verification link is invalid or expired.");
      const used = await tokenReservation(env, token, "verify", now);
      await accept(await callAuth(request, env, deps, `/verify-email?token=${encodeURIComponent(token)}`));
      await event(db, "candidate.email_verified", used.user_id, "verified");
      return response({ ok: true, message: "Email verified. You can now sign in." });
    }
    if (path === "social") {
      keys(payload, ["provider"]); const provider = string(payload.provider, "Provider", 20, true);
      if (!availability.providers.find(p => p.id === provider)?.enabled || !PROVIDERS.includes(provider as Provider)) throw new CareerError(503, "ACCOUNT_PROVIDER_UNAVAILABLE", "This sign-in option is not connected yet.");
      await limit(db, "social", 60, 30, now);
      const result = await callAuth(request, env, deps, "/sign-in/social", { provider, callbackURL: `${origin}/dashboard`, newUserCallbackURL: `${origin}/dashboard`, errorCallbackURL: `${origin}/login?error=social`, disableRedirect: true });
      const data = await accept(result);
      if (typeof data.url !== "string") throw new CareerError(503, "ACCOUNT_AUTH_UNAVAILABLE", "This sign-in option is temporarily unavailable.");
      const destination = new URL(data.url), hosts: Record<string, string> = { google: "accounts.google.com", linkedin: "www.linkedin.com", indeed: "secure.indeed.com" };
      if (destination.protocol !== "https:" || destination.hostname !== hosts[provider] || destination.port || destination.username || destination.password || destination.searchParams.get("redirect_uri") !== `${origin}/api/account/callback/${provider}`) throw new CareerError(503, "ACCOUNT_AUTH_UNAVAILABLE", "This sign-in option is temporarily unavailable.");
      const state = destination.searchParams.get("state"); if (!state || !/^[A-Za-z0-9_-]{20,128}$/.test(state)) throw new Error("OAuth state unavailable");
      await q(db, "DELETE FROM career_candidate_link_tokens WHERE expires_at<=?", now).run();
      await q(db, "INSERT INTO career_candidate_link_tokens(hash,purpose,user_id,expires_at,consumed_at) VALUES(?,?,NULL,?,NULL)", await keyedHash(secret, `oauth:${provider}:${state}`), `oauth:${provider}`, now + 600000).run();
      return response({ url: destination.href }, 200, result.headers);
    }
    if (["sign-up", "forgot-password", "resend-verification"].includes(path) && !availability.emailAvailable) throw new CareerError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "Email sign-up and password recovery will be available after verification emails are connected.");
    if (path === "sign-up") {
      keys(payload, ["name", "email", "password"]); const name = string(payload.name, "Name", 120, true), address = email(payload.email), pw = password(payload.password); await limit(db, "signup", 60, 10, now);
      const result = await callAuth(request, env, deps, "/sign-up/email", { name, email: address, password: pw });
      if (!result.ok) await denial(db, "candidate.sign_up", "provider_or_request_failed", now); else await event(db, "candidate.sign_up", null, "accepted");
      return response({ ok: true, needsVerification: true, message: "If this address can be registered, check your email for a verification link. Already registered? Sign in or request a new link." }, 202);
    }
    if (path === "sign-in") {
      keys(payload, ["email", "password"]); const address = email(payload.email), pw = password(payload.password);
      const existing = await q(db, "SELECT id FROM career_candidate_users WHERE email=?", address).first<{ id: string }>();
      await limit(db, existing ? `login:${await keyedHash(secret, existing.id)}` : "login:unknown", 60, 10, now);
      const result = await callAuth(request, env, deps, "/sign-in/email", { email: address, password: pw, rememberMe: false }); await accept(result);
      const nextHeaders = new Headers(authHeaders(request));
      const jar = new Map((nextHeaders.get("cookie") ?? "").split(";").filter(Boolean).map(cookie => { const i = cookie.indexOf("="); return [cookie.slice(0, i).trim(), cookie.slice(i + 1)]; }));
      for (const cookie of result.headers.getSetCookie()) { const pair = cookie.split(";", 1)[0], i = pair.indexOf("="); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
      nextHeaders.set("cookie", Array.from(jar, ([key, value]) => `${key}=${value}`).join("; "));
      const identity = await resolveCandidateCareerIdentity(new Request(request.url, { headers: nextHeaders }), env);
      await event(db, "candidate.sign_in", identity.userId.slice("candidate:".length), "authenticated"); return response({ ok: true, user: { name: identity.fullName, email: identity.email } }, 200, withWorkspaceRealm(result.headers, "candidate"));
    }
    if (path === "forgot-password" || path === "resend-verification") {
      keys(payload, ["email"]); const address = email(payload.email); await limit(db, "email-requests", 60, 20, now);
      // Identical results avoid revealing whether an address has an account.
      const started = Date.now(); const result = await callAuth(request, env, deps, path === "forgot-password" ? "/request-password-reset" : "/send-verification-email", path === "forgot-password" ? { email: address, redirectTo: `${origin}/reset-password` } : { email: address });
      if (!result.ok) await denial(db, `candidate.${path}`, "provider_or_request_failed", now);
      const remaining = 500 - (Date.now() - started); if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      return response({ ok: true, message: "If this address has an eligible account, an email has been requested. Check your inbox and spam folder." }, 202);
    }
    if (path === "reset-password") {
      keys(payload, ["token", "password"]); const token = string(payload.token, "Reset token", 128, true), pw = password(payload.password);
      if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "This reset link is invalid or expired.");
      await limit(db, "reset", 60, 20, now);
      const hash = await keyedHash(secret, `reset:${token}`); const eligible = await q(db, "SELECT user_id FROM career_candidate_link_tokens WHERE hash=? AND purpose='reset' AND consumed_at IS NULL AND expires_at>?", hash, now).first<{user_id:string|null}>();
      if (!eligible?.user_id) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "This reset link is invalid or expired.");
      const nonce = crypto.randomUUID(); const reserved = await q(db, "INSERT INTO career_candidate_security_state(user_id,recovery_pending,reset_nonce,reset_started_at) VALUES(?,1,?,?) ON CONFLICT(user_id) DO UPDATE SET recovery_pending=1,reset_nonce=excluded.reset_nonce,reset_started_at=excluded.reset_started_at WHERE recovery_pending=0 OR reset_started_at<=? RETURNING user_id", eligible.user_id, nonce, now, now-120000).first();
      if (!reserved) throw new CareerError(409, "ACCOUNT_RECOVERY_PENDING", "Password recovery is already running. Wait two minutes before using a new link.");
      const used = await tokenReservation(env, token, "reset", now);
      if (!used.user_id) throw new CareerError(401, "ACCOUNT_LINK_INVALID", "This reset link is invalid.");
      // D1 cannot transactionally combine library password updates and revocation.
      // Durable recovery barrier denies all sessions before the update starts.
      await q(db, "DELETE FROM career_candidate_sessions WHERE user_id=?", used.user_id).run();
      await accept(await callAuth(request, env, deps, "/reset-password", { token, newPassword: pw }));
      const completed = await db.batch([q(db, "DELETE FROM career_candidate_sessions WHERE user_id=?", used.user_id), q(db, "UPDATE career_candidate_security_state SET recovery_pending=0,reset_nonce=NULL WHERE user_id=? AND reset_nonce=?", used.user_id, nonce)]);
      if (completed[1].meta.changes !== 1) throw new CareerError(503, "ACCOUNT_RECOVERY_PENDING", "Recovery changed while processing. Use a new reset link to finish recovery.");
      await event(db, "candidate.password_reset", used.user_id, "reset_sessions_revoked"); return response({ ok: true, message: "Password reset. Sign in with your new password." }, 200, clearCookies());
    }
    return response({ code: "ACCOUNT_ROUTE_DISABLED", error: "This account action is not available." }, 404);
  } catch (error) {
    if (auditDB && action) try { await denial(auditDB, `candidate.${action}`, error instanceof CareerError ? error.code : "unavailable", (deps.now ?? Date.now)()); } catch { /* Audit failure cannot turn denial into authorization. */ }
    if (error instanceof CareerError) { const result = response({ error: error.message, code: error.code }, error.status); if (error.status === 429) result.headers.set("Retry-After", "60"); return result; }
    return response({ error: "Account sign-in is temporarily unavailable. Please try again later.", code: "ACCOUNT_AUTH_UNAVAILABLE" }, 503);
  }
}
