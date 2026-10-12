// Only the fixed localhost synthetic identity. Do not run alongside browser mutations.
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const base=new URL(process.env.CAREER_TEST_BASE_URL??"http://127.0.0.1:5173");assert.ok(base.protocol==="http:"&&["localhost","127.0.0.1"].includes(base.hostname));
const checks=[];const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const login=await fetch(new URL("/signin-with-chatgpt?return_to=%2Fdashboard",base),{redirect:"manual"});
const cookie=login.headers.getSetCookie().find(value=>value.startsWith("__sites_local_auth="))?.split(";")[0];assert.ok(cookie);
async function call(path,method="GET",body){const response=await fetch(new URL("/api/career/"+path,base),{method,headers:{cookie,...(method==="GET"?{}:{origin:base.origin,"content-type":"application/json","x-career-action":"1",connection:"close"})},...(method==="GET"?{}:{body:JSON.stringify(body??{})})});const type=response.headers.get("content-type")??"";return {response,data:type.includes("json")?await response.json():null};}
const initial=(await call("state")).data;assert.equal(initial.profile.email,"seedy@sites.test","Refusing real account mutations");const marker="Synthetic Platform HTTP "+Date.now();let original,variant,goal;const cleanup=[];
try{
 const missing=await fetch(new URL("/api/career/platform/state",base));check(missing.status===401,"Anonymous platform records fail closed");
 const start=await call("platform/state");check(start.response.status===200&&Array.isArray(start.data.platform.goals),"Platform state contains actual owned records");
 const forged=await call("platform/__proto__","POST",{title:"Injected",confirmed:true});check(forged.response.status===404,"Prototype-name resource is rejected as404");
 const created=await call("resumes","POST",{title:marker,targetRole:"Engineer",source:"manual",text:"SYNTHETIC CANDIDATE\nSUMMARY\nConfirmed local test information.\nEXPERIENCE\nSynthetic company, 2025-2020\nImproved test throughput 40%.\nEDUCATION\nConfirmed test degree\nSKILLS\nPython\nPROJECTS\nLocal synthetic example"});assert.equal(created.response.status,201);original=created.data.id;
 const review=await call(`resumes/${original}/analysis`);check(review.response.status===200&&review.data.factCheck.flags.some(flag=>flag.category==="dates"),"Owned review flags reversed dates without modifying resume");
 const sections=review.data.sections;
 const metadata={kind:"target",template:"modern",sectionOrder:sections.map(s=>s.id),hiddenSections:[sections.find(s=>s.heading==="PROJECTS").id],linkedJobId:null,parentResumeId:original,userReviewed:true};
 const invalid=await call(`resumes/${original}/variant`,"POST",{title:marker+" invalid",metadata:{...metadata,userReviewed:false}});check(invalid.response.status===400&&invalid.data.code==="REVIEW_REQUIRED","Unreviewed formatted variant cannot be stored");
 const saved=await call(`resumes/${original}/variant`,"POST",{title:marker+" target",metadata});assert.equal(saved.response.status,201);variant=saved.data.id;
 const old=saved.data.state.resumes.find(r=>r.id===original),copy=saved.data.state.resumes.find(r=>r.id===variant);
 check(old.text.includes("Local synthetic example")&&!copy.text.includes("Local synthetic example")&&copy.parentId===original,"Separate formatted variant preserves original and traceable parent");
 check(saved.data.state.activeResumeId===initial.activeResumeId,"Formatting never changes selected active resume");
 for(const format of ["txt","pdf","docx"]){const download=await call(`resumes/${variant}/download?format=${format}`);const bytes=new Uint8Array(await download.response.arrayBuffer());check(download.response.status===200&&download.response.headers.get("cache-control")?.includes("no-store")&&(format==="pdf"?new TextDecoder().decode(bytes.slice(0,5))==="%PDF-":format==="docx"?bytes[0]===0x50:new TextDecoder().decode(bytes).includes("SYNTHETIC CANDIDATE")),"Private "+format.toUpperCase()+" export returns actual file bytes");}
 const publicDownload=await fetch(new URL(`/api/career/resumes/${variant}/download?format=pdf`,base));check(publicDownload.status===401,"Anonymous generated PDF download is denied");
 const compare=await call(`resumes/${variant}/analysis?compareTo=${original}`);check(compare.data.difference.lines.some(line=>line.kind==="removed"&&line.text.includes("Local synthetic example")),"API difference exposes explicitly hidden content");
 const archived=await call(`resumes/${variant}/archive`,"PATCH",{archived:true,expectedArchived:false,confirmed:true});check(archived.response.status===200&&archived.data.state.resumes.find(r=>r.id===variant).archived,"Candidate can archive a nonactive version");
 const activate=await call(`resumes/${variant}/active`,"POST",{});check(activate.response.status===409&&activate.data.code==="RESUME_ARCHIVED","Archived resume cannot become active");
 const stale=await call(`resumes/${variant}/archive`,"PATCH",{archived:false,expectedArchived:false,confirmed:true});check(stale.response.status===409,"Stale archive update is rejected");
 const unarchive=await call(`resumes/${variant}/archive`,"PATCH",{archived:false,expectedArchived:true,confirmed:true});check(unarchive.response.status===200,"Unarchive preserves the original content");
 const createdGoal=await call("platform/goals","POST",{title:marker+" goal",confirmed:true});assert.equal(createdGoal.response.status,200);goal=createdGoal.data.record;
 const history=await call(`platform/goals/${goal.id}/history`);check(history.response.status===200&&history.data.history.length===1,"Owned platform history is available through server permission checks");
 const exported=await call("export");check(exported.data.platform.career_goals.some(g=>g.id===goal.id)&&Array.isArray(exported.data.platform.career_platform_history),"Full account export includes owned platform records and revision history");
 for(const path of ["ai-career-agents","resume-tools","job-discovery","interview-preparation","career-coaching","about","login","sign-up"]){const page=await fetch(new URL("/"+path,base));assert.equal(page.status,200,"Public route: "+path);}checks.push("Eight original public feature/about/account-entry routes render");
}finally{
 for(const id of [variant,original].filter(Boolean))try{const r=await call("resumes/"+id,"DELETE",{confirmActive:false});if(!r.response.ok)throw new Error(r.data?.error||r.response.status);}catch(error){cleanup.push(String(error));}
 if(goal)try{const r=await call("platform/goals/"+goal.id,"DELETE",{confirmed:true,expectedRevision:goal.revision});if(!r.response.ok)throw new Error(r.data?.error||r.response.status);}catch(error){cleanup.push(String(error));}
 const result={passed:cleanup.length===0,checks,cleanupErrors:cleanup,executedAt:new Date().toISOString(),scope:"Migrated localhost Vite/Worker and fixed synthetic identity. Private synthetic audit history remains; no live provider or real candidate used."};await writeFile("docs/platform-http-results.json",JSON.stringify(result,null,2));assert.deepEqual(cleanup,[]);
}
console.log(JSON.stringify({passed:true,checks:checks.length}));
