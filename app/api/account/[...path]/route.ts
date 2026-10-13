import { env } from "cloudflare:workers";
import { handleCandidateRequest, type CandidateAuthEnv } from "../../../../lib/career-candidate-auth";
export const dynamic = "force-dynamic";
const handler = (request: Request) => handleCandidateRequest(request, env as CandidateAuthEnv);
export const GET = handler;
export const POST = handler;
