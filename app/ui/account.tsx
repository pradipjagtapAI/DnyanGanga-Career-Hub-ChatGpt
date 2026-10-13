"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, KeyRound, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Brand } from "./public";

type Provider = { id: string; label: string; enabled: boolean; reason: string };
type Status = { configured: boolean; emailAvailable: boolean; emailReason: string; providers: Provider[]; authenticated: boolean; user: { name: string; email: string } | null };
type Result = { error?: string; code?: string; message?: string; url?: string; redirect?: string; [key: string]: unknown };
export type AccountMode = "signup" | "login" | "forgot" | "reset" | "verify" | "logout";

async function request(path: string, payload?: Record<string, unknown>): Promise<Result> {
  const response = await fetch("/api/account/" + path, {
    method: payload === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json", "X-Career-Action": "1" }, body: JSON.stringify(payload) }),
  });
  const result = await response.json().catch(() => null) as Result | null;
  if (!result) throw new Error("Account access is temporarily unavailable. Please try again.");
  if (!response.ok) throw new Error(result.error || "This request could not be completed. Please try again.");
  return result;
}

function AccountShell({ children }: { children: ReactNode }) {
  return <div className="public-site dg-admin-site dg-account-site"><header className="public-header"><Brand /><Link className="dg-admin-home" href="/">Back to home</Link></header><main className="dg-admin-layout"><aside className="dg-admin-intro"><span className="eyebrow">YOUR NEXT CAREER CHAPTER</span><h1>Your goals.<br />Your own workspace.</h1><p>Bring your experience, resumes and job search together in DnyanGanga Career Hub.</p><div className="dg-admin-assurance"><FileText size={23} /><div><h2>Build on your experience</h2><p>Review your profile, manage resume versions and prepare applications.</p></div></div><div className="dg-admin-assurance"><ShieldCheck size={23} /><div><h2>Private by default</h2><p>Your career records belong to your account. You decide what to share.</p></div></div><Link className="text-link" href="/demo">Explore the sample workspace <ArrowRight size={15} /></Link></aside><section className="dg-admin-card" aria-label="Candidate account">{children}</section></main></div>;
}

const headings: Record<AccountMode, [string, string]> = {
  signup: ["Create your account", "Start your private career workspace with email or an available account provider."],
  login: ["Welcome back", "Sign in to your candidate account to continue."],
  forgot: ["Reset your password", "Enter your account email. If the account is eligible, we will send a reset link."],
  reset: ["Choose a new password", "Use a unique password with at least 14 characters."],
  verify: ["Verify your email", "Confirm your email before entering your private workspace."],
  logout: ["Sign out", "End your sign-in on this browser. Your saved career records will remain available."],
};

export function CandidateAccount({ mode }: { mode: AccountMode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");
  const [adminSession, setAdminSession] = useState(false);
  const tokenRead = useRef<string | null>(null);
  const credentials = mode === "signup" || mode === "login";
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    if (tokenRead.current === null) {
      tokenRead.current = params.get("token") || "";
      if ((mode === "verify" || mode === "reset") && params.has("token")) window.history.replaceState(null, "", window.location.pathname);
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setToken(tokenRead.current || "");
      if (params.has("error")) setMessage("That account provider could not complete sign-in. Try again or choose another available method.");
    });
    void request("status").then(value => {
      if (!active) return;
      const found = value as unknown as Status; setStatus(found);
      if (found.authenticated && credentials) window.location.replace("/dashboard");
    }).catch(error => { if (active) setMessage(error.message); });
    if (mode === "logout") void fetch("/api/admin/auth/status", { cache: "no-store", credentials: "same-origin" }).then(r => r.json()).then(raw => { const value = raw as { stage?: string }; if (active) setAdminSession(["authenticated", "reauthenticate", "enroll_totp", "verify_totp"].includes(value.stage || "")); }).catch(() => {});
    return () => { active = false; };
  }, [mode, credentials]);

  async function perform(path: string, payload?: Record<string, unknown>) {
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const result = await request(path, payload);
      if (path === "sign-in") { window.location.replace("/dashboard"); return; }
      if (path === "social") {
        const target = new URL(String(result.url || result.redirect || ""));
        const allowed = ["accounts.google.com", "www.linkedin.com", "secure.indeed.com"];
        if (target.protocol !== "https:" || !allowed.includes(target.hostname) || target.username || target.password) throw new Error("The account provider returned an unexpected sign-in address.");
        window.location.assign(target.href); return;
      }
      if (path === "sign-out") {
        if (adminSession) {
          const response = await fetch("/api/admin/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Career-Action": "1" }, body: "{}" });
          if (!response.ok) throw new Error("Your administrator session could not be ended. Use administrator sign out to finish.");
        }
        window.location.replace("/login"); return;
      }
      setSuccess(true);
      setMessage(typeof result.message === "string" ? result.message : path === "sign-up" || path === "resend-verification" ? "Check your inbox for a verification link. Verify your email, then sign in." : path === "verify-email" ? "Your email is verified. You can now sign in." : path === "reset-password" ? "Your password has been updated. Sign in with your new password." : "If your account is eligible, a password reset link will be sent to your email.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPassword(""); setConfirmation(""); setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if ((mode === "signup" || mode === "reset") && password !== confirmation) { setSuccess(false); setMessage("The passwords do not match."); return; }
    if (mode === "signup") void perform("sign-up", { name: name.trim(), email: email.trim(), password });
    if (mode === "login") void perform("sign-in", { email: email.trim(), password });
    if (mode === "forgot") void perform("forgot-password", { email: email.trim() });
    if (mode === "reset") void perform("reset-password", { token, password });
  }
  const emailEnabled = !!status?.configured && ((mode === "login" || mode === "reset") || !!status?.emailAvailable);
  return <AccountShell><div className="dg-admin-card-heading"><span className="dg-admin-icon">{mode === "logout" ? <LogOut size={24} /> : <KeyRound size={24} />}</span><span className="eyebrow">DNYANGANGA CAREER HUB</span><h2>{headings[mode][0]}</h2><p>{headings[mode][1]}</p></div>
    {message && <div className={"dg-admin-message" + (success ? " dg-account-success" : "")} role={success ? "status" : "alert"}>{success && <CheckCircle2 size={17} />}{message}</div>}
    {!status && !message && <p role="status">Checking available sign-in options…</p>}
    {credentials && status && <><div className="dg-account-providers">{status.providers.map(provider => <div className="dg-account-provider" key={provider.id}><button className="dg-account-provider-button" type="button" disabled={busy || !provider.enabled} aria-describedby={`provider-${provider.id}-status`} onClick={() => void perform("social", { provider: provider.id })}><span className={`dg-account-provider-mark provider-${provider.id}`} aria-hidden="true">{provider.id === "google" ? "G" : provider.id === "linkedin" ? "in" : provider.id === "indeed" ? "i" : "n"}</span><span>Continue with {provider.id === "google" ? "Google / Gmail" : provider.label}</span>{!provider.enabled && <span className="dg-account-provider-state">Unavailable</span>}</button>{!provider.enabled && <small id={`provider-${provider.id}-status`}>{provider.reason}</small>}</div>)}</div><div className="dg-account-divider"><span>or use your email</span></div></>}
    {status && !emailEnabled && mode !== "logout" && <div className="dg-account-setup" role="status"><Mail size={18} /><p>{status.emailReason || "Email account verification is being set up. Please check back soon."}</p></div>}
    {["signup", "login", "forgot", "reset"].includes(mode) && !success && <form className="dg-admin-form dg-account-form" onSubmit={submit}>
      {mode === "signup" && <label htmlFor="dg-account-name">Full name<input id="dg-account-name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required disabled={busy || !emailEnabled} /></label>}
      {mode !== "reset" && <label htmlFor="dg-account-email">Email address<input id="dg-account-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={busy || !emailEnabled} /></label>}
      {mode !== "forgot" && <label htmlFor="dg-account-password">{mode === "reset" ? "New password" : "Password"}<input id="dg-account-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === "login" ? undefined : 14} maxLength={128} required disabled={busy || !emailEnabled} /></label>}
      {(mode === "signup" || mode === "reset") && <><p className="dg-admin-hint">At least 14 characters. Use a password unique to this account.</p><label htmlFor="dg-account-confirm">Confirm password<input id="dg-account-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={14} maxLength={128} required disabled={busy || !emailEnabled} /></label></>}
      {mode === "signup" && <label className="dg-account-consent"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required disabled={busy || !emailEnabled} /><span>I agree to the <Link href="/terms">Terms</Link> and have read the <Link href="/privacy">Privacy information</Link>.</span></label>}
      {mode === "login" && <div className="dg-account-help"><Link href="/verify-email">Verify email</Link><Link href="/forgot-password">Forgot password?</Link></div>}
      <button className="btn primary" disabled={busy || !emailEnabled || (mode === "signup" && !accepted) || (mode === "reset" && !token)}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}<ArrowRight size={16} /></button>
      {mode === "reset" && !token && <p className="dg-admin-hint">Open the link from your password reset email to continue.</p>}
    </form>}
    {mode === "verify" && !success && <><button className="btn primary dg-account-full" disabled={busy || !status?.configured || !token} onClick={() => void perform("verify-email", { token })}>{busy ? "Verifying…" : "Verify email"}<ArrowRight size={16} /></button>{!token && <p className="dg-admin-hint">Open the verification link from your inbox, or request a new link below.</p>}<form className="dg-admin-form dg-account-resend" onSubmit={e => { e.preventDefault(); void perform("resend-verification", { email: email.trim() }); }}><label htmlFor="dg-resend-email">Account email<input id="dg-resend-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={busy || !emailEnabled} /></label><button className="btn outline" disabled={busy || !emailEnabled}>Send a new verification link</button></form></>}
    {mode === "logout" && <button className="btn primary dg-account-full" disabled={busy || !status?.configured} onClick={() => void perform("sign-out", {})}><LogOut size={16} />{busy ? "Signing out…" : "Sign out of this browser"}</button>}
    {success && <Link className="btn primary dg-account-full" href={mode === "signup" ? "/verify-email" : "/login"}>{mode === "signup" ? "Verification help" : "Go to sign in"}<ArrowRight size={16} /></Link>}
    <p className="dg-account-switch">{mode === "signup" ? <>Already have an account? <Link href="/login">Sign in</Link></> : mode === "login" ? <>New to DnyanGanga? <Link href="/sign-up">Create an account</Link></> : <Link href={mode === "logout" ? "/dashboard" : "/login"}>{mode === "logout" ? "Return to workspace" : "Back to sign in"}</Link>}</p>
    <p className="dg-admin-footnote">{credentials ? <>Signing in with a job-platform account does not connect job searches or submit applications. <Link href="/admin/login">Administrator sign in</Link></> : "Passwords and verification tokens are not saved in browser storage."}</p>
  </AccountShell>;
}
