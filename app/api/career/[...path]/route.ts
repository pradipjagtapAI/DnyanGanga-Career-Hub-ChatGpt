import { getChatGPTUser } from "../../../chatgpt-auth";
import { env } from "cloudflare:workers";
import { CareerError, INTEGRATIONS, assertMutationRequest, assertSameOrigin, disabledFeatureForPath, keys, readJsonBounded, string } from "../../../../lib/career-core";
import { CareerStore } from "../../../../lib/career-store";
import { CareerAgentStore } from "../../../../lib/career-agent-store";
import { getCareerAgentState, startCareerAgentRun, executeCareerAgentRun, runCareerAgentScheduler, verifyOwnedJobs, applyOwnedJobFeedback } from "../../../../lib/career-orchestrator";
import { rankAgentJob } from "../../../../lib/career-agent-matching";
import type { AgentId, AgentCategory } from "../../../../lib/career-agent-contract";
import { CareerDocumentService, documentAvailability } from "../../../../lib/career-documents";
import type { DocumentEnv } from "../../../../lib/career-documents";
import { aiAvailability, buildAIContext, generateCareerAI, validateAIRequest } from "../../../../lib/career-ai";
import type { CareerAIEnv } from "../../../../lib/career-ai";
import { approvedGreenhouseBoards, emailProviderReady, getProviderIntegrationState, refreshOwnedJobs, whatsappProviderReady } from "../../../../lib/career-providers";
import type { CareerProviderEnv } from "../../../../lib/career-providers";
import { assertSchedulerRequest, confirmDestinationVerification, getAlertState, handleProviderCallback, handleUnsubscribe, requestDestinationVerification, runAlertScheduler } from "../../../../lib/career-alerts";

export const dynamic = "force-dynamic";
const runtime = env as DocumentEnv & CareerAIEnv & CareerProviderEnv & {DB?:D1Database};
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
function json(data: unknown, status = 200, extra: Record<string, string> = {}) { return Response.json(data, { status, headers: { ...privateHeaders, ...extra } }); }
async function state(store:CareerStore) {
  const base=await store.state(),alerts=await getAlertState(store.db,store.identity.userId,runtime);
  const agentStore=new CareerAgentStore(store),confirmedProfile=await agentStore.confirmedProfile();
  const verifiedFacts=await agentStore.getVault();
  const agentic=await getCareerAgentState(agentStore,runtime);
  const verification=verifyOwnedJobs(base.jobs);
  const active=base.resumes.find(resume=>resume.active);
  const jobs=base.jobs.map(job=>{
    const ranked=rankAgentJob(job,confirmedProfile,base.preferences,active?.text,verifiedFacts);
    ranked.relevance.profileRevision=base.revision;ranked.relevance.resumeVersion=active?.version??null;
    const verified=verification.find(record=>record.id===job.id);
    if(verified?.duplicateOf){ranked.relevance.eligible=false;ranked.relevance.score=null;ranked.relevance.label="Duplicate listing";ranked.relevance.excludedReasons.push("Same original application destination as another listing; excluded from repeated preparation.");}
    return {...job,...applyOwnedJobFeedback(ranked,job.id,agentic.feedback),verification:verified};
  }).sort((a,b)=>Number(b.relevance.eligible)-Number(a.relevance.eligible)||(b.rankingScore??-1)-(a.rankingScore??-1));
  return {...base,jobs,...alerts,agentic,metrics:{...base.metrics,suitableJobs:jobs.filter(job=>job.relevance.eligible).length},notifications:{...base.notifications,nextAlert:alerts.nextAlert},integrations:{...INTEGRATIONS,...getProviderIntegrationState(runtime),ai:aiAvailability(runtime),documents:documentAvailability(runtime)}};
}
/** An external attempt cannot start unless current permissions and its private
 * immutable data manifest are durably recorded. Service secrets are excluded. */
async function externalAction<T>(agents:CareerAgentStore,agent:AgentId,category:AgentCategory,destination:string,data:unknown,action:()=>Promise<T>):Promise<T> {
  await agents.assertCurrentAllowed(category);
  await agents.appendManifest(agent,category,"requested",{destination,authorizationBasis:"Authenticated candidate action; current automation policy",dataSent:data});
  await agents.assertCurrentAllowed(category);
  try {const result=await action();await agents.appendManifest(agent,category,"completed",{destination,result:"Provider response received; no downstream action authorized by this record"});return result;}
  catch(error){await agents.appendManifest(agent,category,"failed",{destination,result:error instanceof CareerError?error.code:"PROVIDER_UNCONFIRMED"});throw error;}
}
function boundedHistory(history:{role:"user"|"assistant";text:string}[]) {
  const output:{role:"user"|"assistant";text:string}[]=[];let size=0;
  for(const turn of history.slice(-12).reverse()){const text=turn.text.slice(0,2000);if(size+text.length>8000)break;size+=text.length;output.unshift({role:turn.role,text});}return output;
}
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\/career\/?/, "").split("/").filter(Boolean);
    if(path[0]==="callbacks"&&path.length===2&&["resend","whatsapp"].includes(path[1])) {
      if(!runtime.DB)throw new CareerError(503,"DATABASE_UNAVAILABLE","The service is unavailable.");
      const response=await handleProviderCallback(request,runtime.DB,runtime,path[1] as "resend"|"whatsapp");
      return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...privateHeaders}});
    }
    if(path.join("/")==="notifications/unsubscribe") {
      if(!runtime.DB)throw new CareerError(503,"DATABASE_UNAVAILABLE","The service is unavailable.");
      const response=await handleUnsubscribe(request,runtime.DB,runtime);
      return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...privateHeaders}});
    }
    if(path.join("/")==="internal/scheduler"&&request.method==="POST") {
      await assertSchedulerRequest(request,runtime);
      if(!runtime.DB)throw new CareerError(503,"DATABASE_UNAVAILABLE","The service is unavailable.");
      // Channel failures and agent failures are independent. Nothing claims a
      // successful dispatch without the delivery provider's response.
      const results=await Promise.allSettled([runCareerAgentScheduler(runtime.DB,runtime),runAlertScheduler(runtime.DB,runtime)]);
      return json({agents:results[0].status==="fulfilled"?results[0].value:{status:"failed"},alerts:results[1].status==="fulfilled"?results[1].value:{status:"failed"}});
    }
    const user = await getChatGPTUser();
    if (!user) return json({ error: "Sign in to use your private workspace.", code: "UNAUTHENTICATED" }, 401);
    const mutation = request.method !== "GET";
    const rawUpload=path.join("/")==="documents/upload"&&request.method==="POST";
    if (mutation) {if(rawUpload)assertSameOrigin(request);else assertMutationRequest(request);}
    const blockedFeature = path[0]==="ai"?null:disabledFeatureForPath(path[0] ?? "", request.method);
    if (blockedFeature) { if (mutation) await readJsonBounded(request); return json({ error: blockedFeature.reason, code: "FEATURE_NOT_CONFIGURED", integration: blockedFeature }, 503); }
    const store = new CareerStore(user, runtime.DB); await store.ensureAccount();
    const agents=new CareerAgentStore(store);
    await agents.ensureSettings();
    const documentEnv={...runtime,CAREER_DOCUMENT_PROCESSOR:runtime.CAREER_DOCUMENT_PROCESSOR?{fetch:async(input:Request)=>externalAction(agents,"resume_intelligence","documents","private isolated document processor",{documentId:input.headers.get("X-Document-Id"),sha256:input.headers.get("X-Document-SHA256"),contentType:input.headers.get("Content-Type")},()=>runtime.CAREER_DOCUMENT_PROCESSOR!.fetch(input))}:undefined};
    const documents=new CareerDocumentService(store,documentEnv as DocumentEnv);
    if (!mutation && path.join("/") === "state") return json(await state(store));
    if (!mutation && path.join("/") === "export") return json({...await store.export(),agentic:await agents.exportData()}, 200, { "Content-Disposition": "attachment; filename=dnyanganga-career-export.json" });
    if (!mutation && path.join("/") === "agents/state") return json({agentic:await getCareerAgentState(agents,runtime)});
    if (!mutation && path[0]==="agents" && path[1]==="packages" && path[2] && path[3]==="download" && path.length===4) return json(await agents.exportPackage(path[2]),200,{"Content-Disposition":"attachment; filename=dnyanganga-application-package.json"});
    if (!mutation && path[0] === "resumes" && path.length === 3 && path[2] === "download") {
      const resume = await store.ownedResume(path[1]);
      return new Response(resume.content, { headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename=resume-v${resume.version}.txt` } });
    }
    if(!mutation&&path[0]==="documents"&&path.length===3&&path[2]==="preview")return json(await documents.preview(path[1]));
    if(!mutation&&path[0]==="documents"&&path.length===3&&path[2]==="original") {
      const {row,file}=await documents.original(path[1]);
      return new Response(file.body,{headers:{...privateHeaders,"Content-Type":row.mime_type,"Content-Disposition":`attachment; filename="resume-original.${row.mime_type==="application/pdf"?"pdf":"docx"}"; filename*=UTF-8''${encodeURIComponent(row.original_filename)}`}});
    }
    if(!mutation&&path[0]==="generated-documents"&&path.length===3&&path[2]==="download") {
      const row=await store.query("SELECT data FROM career_generated_documents WHERE id=? AND user_id=?",path[1],user.userId).first<{data:string}>();
      if(!row)throw new CareerError(404,"NOT_FOUND","The document was not found.");
      return new Response(JSON.parse(row.data).text,{headers:{...privateHeaders,"Content-Type":"text/plain; charset=utf-8","Content-Disposition":"attachment; filename=cover-letter.txt"}});
    }
    if (!mutation) return json({ error: "This page was not found.", code: "NOT_FOUND" }, 404);
    await store.rateLimit();
    if(rawUpload){const id=await documents.upload(request);return json({ok:true,id,state:await state(store)},201);}
    const payload = await readJsonBounded(request);
    const resource = path[0]; const id = path[1]; const action = path[2];
    let createdId: string | undefined;let extra:Record<string,unknown>={};
    if(resource==="agents") {
      const group=path[1],entity=path[2],verb=path[3];
      if(request.method==="PUT"&&group==="settings"&&path.length===2)await agents.saveSettings(payload);
      else if(request.method==="POST"&&group==="searches"&&path.length===2)extra={search:await agents.saveSearch(payload)};
      else if(request.method==="PATCH"&&group==="searches"&&entity&&path.length===3)extra={search:await agents.saveSearch(payload,entity)};
      else if(request.method==="DELETE"&&group==="searches"&&entity&&path.length===3){keys(payload,[]);await agents.deleteSearch(entity);}
      else if(request.method==="POST"&&group==="vault"&&entity==="confirm"&&path.length===3)extra={fact:await agents.confirmFact(payload)};
      else if(request.method==="POST"&&group==="answers"&&path.length===2)extra={answer:await agents.saveAnswer(payload)};
      else if(request.method==="POST"&&group==="feedback"&&path.length===2)extra={feedback:await agents.saveFeedback(payload)};
      else if(request.method==="POST"&&group==="packages"&&path.length===2){
        keys(payload,["jobId"]);
        extra={package:await agents.savePackage({jobId:string(payload.jobId,"Job",100,true),screeningAnswerIds:(await agents.getAnswers()).map(answer=>answer.key),missingQuestions:[{key:"job_specific_screening",question:"Which screening questions does this employer actually require? Confirm the questions and answers before using this package."}]},{serverTrusted:true})};
      }
      else if(request.method==="POST"&&["runs","run"].includes(group)&&path.length===2) {
        keys(payload,["goal","searchId","searchIds","idempotencyKey"]);
        extra={workflow:await startCareerAgentRun(agents,payload,runtime)};
      }
      else if(request.method==="POST"&&group==="runs"&&entity&&verb==="continue"&&path.length===4){keys(payload,[]);extra={workflow:await executeCareerAgentRun(agents,entity,runtime)};}
      else if(request.method==="PATCH"&&group==="packages"&&entity&&path.length===3)extra={package:await agents.editPackage(entity,payload)};
      else if(request.method==="POST"&&group==="packages"&&entity&&verb==="approve"&&path.length===4)extra={package:await agents.approvePackage(entity,payload)};
      else if(request.method==="POST"&&group==="packages"&&entity&&verb==="execute"&&path.length===4)extra={execution:await agents.executePackage(entity,payload)};
      else return json({error:"This agent action was not found.",code:"NOT_FOUND"},404);
    }
    else if (request.method === "PUT" && resource === "profile" && path.length === 1) await store.saveProfile(payload);
    else if (request.method === "PUT" && resource === "draft" && path.length === 1) await store.saveDraft(payload);
    else if (request.method === "DELETE" && resource === "draft" && path.length === 1) await store.deleteDraft(payload);
    else if (request.method === "POST" && resource === "resumes" && path.length === 1) createdId = await store.saveResume(payload);
    else if (request.method === "POST" && resource === "resumes" && id && action === "active" && path.length === 3) { keys(payload, []); await store.setActiveResume(id); }
    else if (request.method === "POST" && resource === "resumes" && id && action === "restore" && path.length === 3) { keys(payload, []); createdId = await store.saveResume({}, await store.ownedResume(id)); }
    else if (request.method === "DELETE" && resource === "resumes" && id && path.length === 2) { keys(payload, ["confirmActive"]); await store.deleteResume(id,payload.confirmActive===true); }
    else if(request.method==="POST"&&resource==="documents"&&id&&action==="review"&&path.length===3)createdId=await documents.review(id,payload);
    else if(request.method==="DELETE"&&resource==="documents"&&id&&path.length===2){keys(payload,[]);await documents.remove(id);}
    else if(request.method==="POST"&&resource==="jobs"&&id==="refresh"&&path.length===2){
      keys(payload,[]);await agents.assertCurrentAllowed("jobs");
      const fetcher:typeof fetch=async(input,init)=>externalAction(agents,"job_discovery","jobs",String(input),{method:init?.method??"GET",personalInformation:"None; authorized employer board token only"},()=>fetch(input,init));
      extra={refresh:await refreshOwnedJobs(store.db,user.userId,runtime,fetcher)};
    }
    else if (request.method === "POST" && resource === "jobs" && path.length === 1) createdId = await store.importJob(payload);
    else if (request.method === "DELETE" && resource === "jobs" && id && path.length === 2) { keys(payload, []); await store.deleteJob(id); }
    else if (request.method === "POST" && resource === "applications" && path.length === 1) createdId = await store.saveApplication(payload);
    else if (request.method === "PATCH" && resource === "applications" && id && path.length === 2) await store.saveApplication(payload, id);
    else if (request.method === "DELETE" && resource === "applications" && id && path.length === 2) { keys(payload, []); await store.deleteApplication(id); }
    else if (request.method === "PUT" && resource === "notifications" && path.length === 1) {
      const destinations=await store.query("SELECT channel,verified_at FROM career_notification_destinations WHERE user_id=?",user.userId).all<{channel:string;verified_at:string|null}>();
      await store.saveNotifications(payload,{email:emailProviderReady(runtime)&&destinations.results.some(d=>d.channel==="email"&&!!d.verified_at),whatsapp:whatsappProviderReady(runtime)&&destinations.results.some(d=>d.channel==="whatsapp"&&!!d.verified_at)});
    }
    else if(request.method==="POST"&&resource==="notifications"&&id==="verify-request"&&path.length===2){keys(payload,["channel","address"]);extra={verification:await requestDestinationVerification(store.db,user,string(payload.channel,"Channel",10,true) as "email"|"whatsapp",string(payload.address,"Destination",254,true),runtime)};}
    else if(request.method==="POST"&&resource==="notifications"&&id==="verify"&&path.length===2){keys(payload,["id","token"]);extra={verification:await confirmDestinationVerification(store.db,user.userId,string(payload.id,"Verification ID",100,true),string(payload.token,"Verification code",8,true),runtime)};}
    else if(request.method==="POST"&&resource==="ai"&&path.length===1) {
      const input=validateAIRequest(payload),account=await store.account();
      const category:AgentCategory=["resume","coverletter"].includes(input.mode)?"documents":input.mode.startsWith("interview_")?"interviews":"career";
      const agent:AgentId=input.mode==="resume"?"resume_tailoring":input.mode==="coverletter"?"cover_letter":input.mode.startsWith("interview_")?"interview_preparation":"career_coach";
      await agents.assertCurrentAllowed(category);
      const previous=input.sessionId?await store.ownedAISession(input.sessionId):null;
      const interviewPair=previous&&["interview_questions","interview_feedback"].includes(previous.mode)&&["interview_questions","interview_feedback"].includes(input.mode);
      if(previous&&previous.mode!==input.mode&&!interviewPair)throw new CareerError(400,"SESSION_MODE","Use a separate session for this tool.");
      if(previous&&(input.expectedRevision===null||input.expectedRevision===undefined||previous.revision!==input.expectedRevision))throw new CareerError(409,"SESSION_CONFLICT","Session changed. Reload before requesting another response.");
      const job=input.jobId?await store.ownedJob(input.jobId):null;
      const assertJobAIRights=()=>{
        const metadata=job as typeof job & {sourceBoard?:string;rightsConfigId?:string};
        if(job&&job.source!=="manual"&&!(job.source==="greenhouse"&&job.aiAllowed===true&&approvedGreenhouseBoards(runtime).some(board=>board.board===metadata?.sourceBoard&&board.rightsConfigId===metadata?.rightsConfigId&&board.aiAllowed)))throw new CareerError(403,"JOB_AI_RIGHTS","This source does not currently permit AI processing of its description.");
      };
      assertJobAIRights();
      const resume=account.active_resume_id?await store.ownedResume(account.active_resume_id):null;
      const context=buildAIContext({profile:await agents.confirmedProfile(),preferences:JSON.parse(account.preferences),profileRevision:account.revision,vaultRevision:(await agents.settings()).vaultRevision,activeResume:resume?{id:resume.id,version:resume.version,text:resume.content}:null,job});
      const basis={profileRevision:context.profileRevision,resumeId:context.resumeId,resumeVersion:context.resumeVersion,jobId:context.jobId,vaultRevision:context.vaultRevision};
      if(previous&&JSON.stringify(previous.data.result.context)!==JSON.stringify(basis))throw new CareerError(409,"SESSION_CONTEXT_CHANGED","Your career context changed. Start a new session for current details.");
      let externalStarted=false;
      const result=await (async()=>{
        try {return await generateCareerAI({...input,context,history:boundedHistory(previous?.data.history??[])},runtime,store.aiBudget(),undefined,async body=>{
          assertJobAIRights();
          await agents.appendManifest(agent,category,"requested",{destination:"https://api.openai.com/v1/responses",authorizationBasis:"Authenticated candidate action and current automation policy",dataSent:body});
          await agents.assertCurrentAllowed(category);externalStarted=true;
        });}
        catch(error){if(externalStarted)await agents.appendManifest(agent,category,"failed",{destination:"https://api.openai.com/v1/responses",result:error instanceof CareerError?error.code:"PROVIDER_UNCONFIRMED",summary:"Provider work did not produce a validated successful result."});throw error;}
      })();
      if(result.source==="ai")await agents.appendManifest(agent,category,"completed",{destination:"https://api.openai.com/v1/responses",result:"Validated evidence response; suggestions remain unapproved",requestId:result.usage?.requestId??null});
      const prompt=input.mode==="interview_feedback"?`Question: ${input.question??""}\nAnswer: ${input.answer??""}`:input.prompt??"";
      createdId=await store.saveAISession(result,prompt,input.sessionId ?? undefined,input.expectedRevision ?? undefined);extra={sessionId:createdId,result};
    }
    else if(request.method==="DELETE"&&resource==="ai-sessions"&&id&&path.length===2){keys(payload,[]);await store.deleteAISession(id);}
    else if(request.method==="POST"&&resource==="ai-sessions"&&id&&action==="review"&&path.length===3){
      const session=await store.ownedAISession(id),currentVault=(await agents.settings()).vaultRevision;
      if((session.data.result.context.vaultRevision??0)!==currentVault)throw new CareerError(409,"DRAFT_STALE","Your confirmed career facts changed. Prepare a new draft before review.");
      createdId=await store.reviewAISession(id,payload);
    }
    else if(request.method==="DELETE"&&resource==="generated-documents"&&id&&path.length===2){keys(payload,[]);const removed=await store.query("DELETE FROM career_generated_documents WHERE id=? AND user_id=?",id,user.userId).run();if(!removed.meta.changes)throw new CareerError(404,"NOT_FOUND","The document was not found.");await store.audit("generated_document.deleted",id).run();}
    else if (request.method === "POST" && resource === "tasks" && path.length === 1) createdId = await store.createTask(payload);
    else if (request.method === "PATCH" && resource === "tasks" && id && path.length === 2) await store.updateTask(id, payload);
    else if (request.method === "DELETE" && resource === "tasks" && id && path.length === 2) { keys(payload, []); await store.deleteTask(id); }
    else return json({ error: "This action was not found.", code: "NOT_FOUND" }, 404);
    return json({ ok: true, id: createdId, ...extra, state: await state(store) }, createdId ? 201 : 200);
  } catch (error) {
    if (error instanceof CareerError) return json({ error: error.message, code: error.code }, error.status, error.status === 429 ? { "Retry-After": "60" } : {});
    return json({ error: "This change could not be completed. Please retry, or contact support with the time of the error.", code: "WORKSPACE_UNAVAILABLE" }, 503);
  }
}
export const GET = handle; export const POST = handle; export const PUT = handle; export const PATCH = handle; export const DELETE = handle;
