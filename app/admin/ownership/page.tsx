import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "../../chatgpt-auth";
import { Brand } from "../../ui/public";
export const dynamic = "force-dynamic";
// Temporary, metadata-only bootstrap check. Enable only after the control plane
// confirms the Site has exactly its sole owner as its private viewer. Disable
// before changing the hosting perimeter. This never exports candidate records.
export default async function OwnershipCheck() {
  if ((env as { CAREER_ADMIN_PRIVATE_SETUP?: string }).CAREER_ADMIN_PRIVATE_SETUP !== "true") notFound();
  const owner = await getChatGPTUser();
  if (!owner) notFound();
  return <div className="public-site"><header className="public-header"><Brand /></header><main className="public-content"><span className="eyebrow">ONE-TIME OWNERSHIP CHECK</span><h1>Link your existing workspace</h1><p>This protected setup check shows only your current workspace identifier. It does not export your profile, resumes or activity.</p><section className="panel"><h2>Existing workspace ownership ID</h2><code data-ownership-id>{owner.userId}</code></section><p>This check will be disabled before independent administrator access is made available.</p></main></div>;
}