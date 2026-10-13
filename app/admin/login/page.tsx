import { AdminLogin } from "../../ui/admin";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function AdminSignInPage() {
  const origin = (env as { CAREER_PUBLIC_ORIGIN?: string }).CAREER_PUBLIC_ORIGIN;
  let canonical: URL | null = null;
  try { if (origin) canonical = new URL(origin); } catch { /* The API rejects invalid configuration. */ }
  if (canonical?.protocol === "https:") {
    const host = (await headers()).get("host");
    if (host && host.toLowerCase() !== canonical.host.toLowerCase()) redirect(canonical.origin + "/admin/login");
  }
  return <AdminLogin />;
}