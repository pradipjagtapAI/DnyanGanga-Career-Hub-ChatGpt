import { CandidateAccount, type AccountMode } from "./ui/account";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function AccountPage({ mode, path }: { mode: AccountMode; path: string }) {
  let canonical: URL | null = null;
  try { const origin = (env as { CAREER_PUBLIC_ORIGIN?: string }).CAREER_PUBLIC_ORIGIN; if (origin) canonical = new URL(origin); } catch { /* APIs reject invalid configuration. */ }
  if (canonical?.protocol === "https:") {
    const host = (await headers()).get("host");
    if (host && host.toLowerCase() !== canonical.host.toLowerCase()) redirect(canonical.origin + path);
  }
  return <CandidateAccount mode={mode} />;
}
