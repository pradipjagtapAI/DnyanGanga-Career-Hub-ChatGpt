import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {handleAdminRequest} from "../../../../lib/career-admin-auth";
import type {AdminAuthEnv} from "../../../../lib/career-admin-auth";
export const dynamic="force-dynamic";
const handler=(request:Request)=>handleAdminRequest(request,env as AdminAuthEnv,{getNativeOwner:async()=>getChatGPTUser()});
export const GET=handler;
export const POST=handler;
