import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { handleAdminRequest, type AdminAuthEnv } from "../../../../lib/career-admin-auth";
import { candidateAuthAvailability, type CandidateAuthEnv } from "../../../../lib/career-candidate-auth";
export const dynamic = "force-dynamic";
const handler = (request: Request) => handleAdminRequest(request, env as AdminAuthEnv, {
  getNativeOwner: async () => getChatGPTUser(),
  candidateAvailability: () => candidateAuthAvailability(env as CandidateAuthEnv),
});
export const GET = handler;
export const POST = handler;
