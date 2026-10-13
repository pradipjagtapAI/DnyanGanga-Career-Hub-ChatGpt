import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { CareerError } from "../lib/career-core";
import { resolveAdminCareerIdentity, type AdminAuthEnv } from "../lib/career-admin-auth";

// Only the independently authenticated sole administrator can enter the career workspace.
// Native hosting identity is retained separately for the one-time ownership bootstrap.
export async function getCareerUser(request?: Request) {
  try { return await resolveAdminCareerIdentity(request ?? await headers(), env as AdminAuthEnv); }
  catch (error) {
    if (error instanceof CareerError && [401, 403, 503].includes(error.status)) return null;
    throw error;
  }
}
export function careerSignInPath(returnTo = "/dashboard") {
  const safe = returnTo === "/admin" || returnTo === "/dashboard" ? returnTo : "/dashboard";
  return "/admin/login?return_to=" + encodeURIComponent(safe);
}
export async function requireCareerUser(returnTo: string) {
  const user = await getCareerUser();
  if (user) return user;
  redirect(careerSignInPath(returnTo));
}