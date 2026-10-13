export type WorkspaceRealm = "candidate" | "admin";
export const WORKSPACE_REALM_COOKIE = "__Host-career_workspace";
// This cookie selects a workspace only. It never grants access or a role;
// the selected realm must independently validate its server-side session.
export function selectedWorkspaceRealm(input: Request | Headers): WorkspaceRealm | null {
  const headers = input instanceof Request ? input.headers : input;
  const value = (headers.get("cookie") ?? "").split(";").map(pair => pair.trim()).find(pair => pair.startsWith(`${WORKSPACE_REALM_COOKIE}=`))?.slice(WORKSPACE_REALM_COOKIE.length + 1);
  return value === "candidate" || value === "admin" ? value : null;
}
export function withWorkspaceRealm(headers: Headers | undefined, realm: WorkspaceRealm) {
  const result = new Headers(headers);
  result.append("Set-Cookie", `${WORKSPACE_REALM_COOKIE}=${realm}; Max-Age=604800; Path=/; Secure; HttpOnly; SameSite=Lax`);
  return result;
}
export function hasCandidateSessionCookie(input: Request | Headers) {
  const headers = input instanceof Request ? input.headers : input;
  return (headers.get("cookie") ?? "").split(";").some(pair => pair.trim().startsWith("__Secure-career_candidate_session="));
}
