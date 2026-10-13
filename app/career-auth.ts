import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { CareerError } from "../lib/career-core";
import { resolveAdminCareerIdentity, type AdminAuthEnv } from "../lib/career-admin-auth";
import { resolveCandidateCareerIdentity, type CandidateAuthEnv } from "../lib/career-candidate-auth";
import { selectedWorkspaceRealm, hasCandidateSessionCookie, type WorkspaceRealm } from "../lib/career-auth-realm";

// An expired selected session never falls through into another private realm.
// A realm hint selects context only; every session still needs server validation.
export async function getCareerUser(request?: Request) {
  const input = request ?? await headers();
  const realm = selectedWorkspaceRealm(input);
  try {
    if (realm === "candidate" || (!realm && hasCandidateSessionCookie(input))) return await resolveCandidateCareerIdentity(input, env as CandidateAuthEnv);
    if (realm === "admin" || !realm) return await resolveAdminCareerIdentity(input, env as AdminAuthEnv);
    return null;
  } catch (error) {
    if (error instanceof CareerError && [401, 403, 503].includes(error.status)) return null;
    throw error;
  }
}
export function careerSignInPath(returnTo = "/dashboard", realm: WorkspaceRealm | null = null) {
  if (returnTo === "/admin" || realm === "admin") return "/admin/login?return_to=" + encodeURIComponent(returnTo === "/admin" ? "/admin" : "/dashboard");
  return "/login?return_to=%2Fdashboard";
}
export async function requireCareerUser(returnTo: string) {
  const user = await getCareerUser();
  if (user) return user;
  redirect(careerSignInPath(returnTo, selectedWorkspaceRealm(await headers())));
}
