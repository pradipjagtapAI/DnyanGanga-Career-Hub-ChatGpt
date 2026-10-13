"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { ShieldCheck, KeyRound, ArrowRight, LogOut, RefreshCw } from "lucide-react";
import { Brand } from "./public";

type AuthStage = "unconfigured" | "needs_setup" | "signed_out" | "enroll_totp" | "verify_totp" | "reauthenticate" | "authenticated";
type AuthStatus = { configured: boolean; setupAvailable: boolean; stage: AuthStage; admin: null | { email: string }; mfaFreshUntil: string | null };
type JsonResult = { error?: string; code?: string; stage?: AuthStage; totpURI?: string; [key: string]: unknown };

async function adminRequest(path: string, payload?: Record<string, unknown>): Promise<JsonResult> {
  const response = await fetch("/api/admin/" + path, {
    method: payload === undefined ? "GET" : "POST",
    credentials: "same-origin", cache: "no-store",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json", "X-Career-Action": "1" }, body: JSON.stringify(payload) }),
  });
  let result: JsonResult;
  try { result = await response.json() as JsonResult; }
  catch { throw new Error("Administrator access is temporarily unavailable. Please try again."); }
  if (!response.ok) throw Object.assign(new Error(typeof result.error === "string" ? result.error : "This request could not be completed."), { status: response.status, code: result.code });
  return result;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="public-site dg-admin-site"><header className="public-header"><Brand /><Link className="dg-admin-home" href="/">Back to home</Link></header><main className="dg-admin-layout"><aside className="dg-admin-intro"><span className="eyebrow">YOUR ADMINISTRATOR WORKSPACE</span><h1>A clear place<br />to take the next step.</h1><p>Manage your career workspace with your own administrator account.</p><div className="dg-admin-assurance"><ShieldCheck size={23} /><div><h2>Two steps to sign in</h2><p>Your email and password, followed by a code from your authenticator app.</p></div></div><div className="dg-admin-assurance"><KeyRound size={23} /><div><h2>Your details stay yours</h2><p>Private career records stay behind your account. There is no public administrator registration.</p></div></div><Link className="text-link" href="/security">Security information <ArrowRight size={15} /></Link></aside><section className="dg-admin-card" aria-label="Administrator access">{children}</section></main></div>;
}

export function AdminLogin() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const value = await adminRequest("auth/status") as unknown as AuthStatus;
    setStatus(value);
    if (value.stage === "authenticated") {
      const destination = new URLSearchParams(window.location.search).get("return_to");
      window.location.replace(destination === "/dashboard" ? "/dashboard" : "/admin");
    }
    return value;
  }, []);
  useEffect(() => {
    let active = true;
    void adminRequest("auth/status").then(raw => {
      if (!active) return;
      const value = raw as unknown as AuthStatus;
      setStatus(value);
      if (value.stage === "authenticated") {
        const destination = new URLSearchParams(window.location.search).get("return_to");
        window.location.replace(destination === "/dashboard" ? "/dashboard" : "/admin");
      }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function perform(path: string, payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const value = await adminRequest("auth/" + path, payload);
      if (typeof value.totpURI === "string") {
        const uri = new URL(value.totpURI);
        if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || !uri.searchParams.get("secret")) throw new Error("The authenticator setup could not be displayed. Please try again.");
        setTotpURI(value.totpURI);
      }
      const latest = await refresh();
      if (value.stage && latest.stage === "signed_out" && value.stage === "verify_totp") setStatus({ ...latest, stage: "verify_totp" });
      if (path === "totp/verify") { setTotpURI(""); setCode(""); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPassword(""); setConfirmation(""); setCode(""); setBusy(false); }
  }
  const stage = status?.stage;
  const setup = stage === "needs_setup" && status?.setupAvailable;
  const verify = stage === "verify_totp" || stage === "reauthenticate" || (stage === "enroll_totp" && !!totpURI);
  let manualKey = "";
  try { if (totpURI) manualKey = new URL(totpURI).searchParams.get("secret") || ""; } catch { /* Never display an invalid setup response. */ }
  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    if (setup && password !== confirmation) { setMessage("The passwords do not match."); return; }
    void perform(setup ? "bootstrap" : "sign-in", { email: email.trim(), password });
  }
  return <AdminShell><div className="dg-admin-card-heading"><span className="dg-admin-icon"><ShieldCheck size={24} /></span><span className="eyebrow">DNYANGANGA CAREER HUB</span><h2>{setup ? "Create your admin account" : stage === "enroll_totp" ? "Set up your authenticator" : verify ? "Verify your sign-in" : "Administrator sign in"}</h2><p>{setup ? "Choose your administrator password. This setup is available only to the verified website owner." : stage === "enroll_totp" ? "Add a second step to protect your administrator account." : verify ? "Enter the current six-digit code from your authenticator app." : "Use your administrator email and password to continue."}</p></div>
    {message && <div className="dg-admin-message" role="alert">{message}</div>}
    {!status && !message && <p role="status">Checking account access…</p>}
    {!status && message && <button className="btn outline" disabled={busy} onClick={() => void refresh().catch(error => setMessage(error.message))}><RefreshCw size={16} />Try again</button>}
    {stage === "unconfigured" && <div className="dg-admin-message" role="status">Administrator access needs secure server setup before it can accept sign-ins. No password has been created.</div>}
    {stage === "needs_setup" && !setup && <div className="dg-admin-message" role="status">The website owner must complete the first administrator setup. Public account creation is unavailable.</div>}
    {(stage === "signed_out" || setup) && <form className="dg-admin-form" onSubmit={submitCredentials}>
      <label htmlFor="dg-admin-email">Administrator email<input id="dg-admin-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} /></label>
      <label htmlFor="dg-admin-password">Password<input id="dg-admin-password" type="password" autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={setup ? 14 : undefined} maxLength={128} required disabled={busy} /></label>
      {setup && <><p className="dg-admin-hint">Use at least 14 characters and a password unique to this account.</p><label htmlFor="dg-admin-confirm">Confirm password<input id="dg-admin-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={14} maxLength={128} required disabled={busy} /></label></>}
      <button className="btn primary" disabled={busy}>{busy ? "Please wait…" : setup ? "Create administrator account" : "Continue"}<ArrowRight size={16} /></button>
    </form>}
    {stage === "enroll_totp" && !totpURI && <form className="dg-admin-form" onSubmit={event => { event.preventDefault(); void perform("totp/enroll", { password }); }}><label htmlFor="dg-enroll-password">Confirm your password<input id="dg-enroll-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={128} required disabled={busy} /></label><button className="btn primary" disabled={busy}>{busy ? "Preparing…" : "Set up authenticator"}<KeyRound size={16} /></button></form>}
    {totpURI && <div className="dg-admin-qr"><QRCode value={totpURI} size={180} title="Scan with your authenticator app" /><p>Scan this code in your authenticator app. The code is generated here, without an external QR service.</p><details><summary>Enter a setup key manually</summary><p className="dg-admin-hint">Keep this key private.</p><code>{manualKey}</code></details></div>}
    {verify && <form className="dg-admin-form" onSubmit={event => { event.preventDefault(); void perform("totp/verify", { code }); }}><label htmlFor="dg-admin-code">Authenticator code<input id="dg-admin-code" className="dg-admin-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ""))} required disabled={busy} /></label><button className="btn primary" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}<ArrowRight size={16} /></button></form>}
    {status && ["enroll_totp", "verify_totp", "reauthenticate"].includes(stage || "") && <button className="dg-admin-back" disabled={busy} onClick={() => { setTotpURI(""); void perform("sign-out", {}); }}>Cancel and return to sign in</button>}
    <p className="dg-admin-footnote">The app does not save passwords or verification codes in browser storage. Account recovery requires the website owner&apos;s verified recovery process.</p>
  </AdminShell>;
}

export function AdminPanel() {
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setMessage("");
    try { setState(await adminRequest("health")); }
    catch (error) {
      const failure = error as Error & { status?: number };
      if (failure.status === 401 || failure.status === 403) { window.location.replace("/admin/login"); return; }
      setMessage(failure.message);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void adminRequest("health").then(value => { if (active) setState(value); }).catch(error => {
      if (!active) return;
      if (error.status === 401 || error.status === 403) window.location.replace("/admin/login");
      else setMessage(error.message);
    });
    return () => { active = false; };
  }, []);
  async function signOut() {
    setBusy(true); setMessage("");
    try { await adminRequest("auth/sign-out", {}); window.location.replace("/admin/login"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); setBusy(false); }
  }
  return <div className="public-site dg-admin-site"><header className="public-header"><Brand /><div className="dg-admin-header-actions"><Link className="btn outline small" href="/dashboard">Career workspace</Link><button className="btn outline small" onClick={() => void signOut()} disabled={busy}><LogOut size={15} />Sign out</button></div></header><main className="public-content dg-admin-operations"><span className="eyebrow">ADMINISTRATOR WORKSPACE</span><h1>Service operations</h1><p className="public-intro">Review connection health and operational records. Private candidate documents are not displayed here.</p><div className="dg-admin-toolbar"><Link className="btn primary" href="/dashboard">Open career workspace<ArrowRight size={16} /></Link><button className="btn outline" disabled={busy} onClick={() => void load()}><RefreshCw size={16} />Refresh status</button></div>{message && <p className="dg-admin-message" role="alert">{message}</p>}{!state && !message ? <p role="status">Checking administrator access…</p> : state && <div className="admin-status-grid">{Object.entries(state).map(([key, value]) => <section className="panel dg-admin-health" key={key}><h2>{key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}</h2><pre>{JSON.stringify(value, null, 2)}</pre></section>)}</div>}<p className="dg-admin-footnote">Sensitive administration requires a recent authenticator check. A configured connection is not evidence that jobs, messages or payments were processed.</p></main></div>;
}
export function AdminLogout() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function endSession() {
    setBusy(true); setMessage("");
    try { await adminRequest("auth/sign-out", {}); window.location.replace("/admin/login"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); setBusy(false); }
  }
  return <AdminShell><div className="dg-admin-card-heading"><h2>Sign out</h2><p>End this browser&apos;s administrator session. Your saved career records will remain available when you sign in again.</p></div>{message && <p className="dg-admin-message" role="alert">{message}</p>}<button className="btn primary" disabled={busy} onClick={() => void endSession()}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button><Link className="dg-admin-back" href="/dashboard">Return to workspace</Link></AdminShell>;
}