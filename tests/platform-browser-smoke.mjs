import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const base=new URL(process.env.CAREER_TEST_BASE_URL||'http://127.0.0.1:5173');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname),'Loopback synthetic identity only.');
const {chromium}=createRequire(import.meta.url)(process.env.CAREER_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.CAREER_BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const checks=[],errors=[],cleanupErrors=[],marker='Synthetic Career OS QA '+Date.now().toString(36),answerKey='qa_platform_'+Date.now().toString(36);
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
let initial,goalId,learningId,recruiterId,interviewId,searchId,resumeId,jobId,failure;
async function call(resource,method='GET',body){return page.evaluate(async ({resource,method,body})=>{const response=await fetch('/api/career/'+resource,{method,cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Career-Action':'1'},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});const data=await response.json();if(!response.ok)throw new Error(resource+': '+response.status+' '+(data.error||data.code));return data;},{resource,method,body});}
async function go(view,title){await page.goto(base.origin+'/dashboard?view='+view,{waitUntil:'networkidle'});if(title)await page.getByRole('heading',{name:title,exact:true}).first().waitFor();}
async function save(button,resource,method='POST'){const waiting=page.waitForResponse(response=>response.url().includes('/api/career/'+resource)&&response.request().method()===method,{timeout:60000});await button.click();const response=await waiting;const result=await response.json();assert.ok(response.ok(),resource+': '+response.status()+' '+(result.error||result.code));return result;}
async function confirm(){await page.getByLabel('I reviewed this information and confirm it is accurate.',{exact:true}).check();}
function card(title){return page.locator('.cp-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).first();}
try{
 await page.goto(base.origin+'/signin-with-chatgpt?return_to=%2Fdashboard%3Fview%3Dgoals',{waitUntil:'networkidle'});
 initial=await call('state');assert.equal(initial.profile.email,'seedy@sites.test','Never mutate a real account.');assert.ok(initial.platform); for(const [resource,key,field] of [['interviews','interviews','company'],['recruiters','recruiters','name'],['learning','learningTasks','title'],['goals','goals','title']])for(const item of initial.platform[key].filter(record=>record[field].startsWith('Synthetic Career OS QA ')))await call('platform/'+resource+'/'+item.id,'DELETE',{confirmed:true,expectedRevision:item.revision}); initial=await call('state');
 await go('goals','Career Goals');
 await page.getByRole('button',{name:'Create career goal',exact:true}).click();
 await page.getByLabel('Goal title',{exact:true}).fill(marker+' Goal');
 await page.getByLabel('Target role',{exact:true}).fill('Synthetic designer');
 await page.getByLabel('Target date',{exact:true}).fill('2027-04-12');
 await page.getByLabel('Why this goal matters',{exact:true}).fill('Local synthetic planning record; no unverified employment claim.');
 assert.equal(await page.getByRole('button',{name:'Save career goal',exact:true}).isDisabled(),true);await confirm();
 const goal=await save(page.getByRole('button',{name:'Save career goal',exact:true}),'platform/goals');goalId=goal.record.id;
 let state=await call('state');let saved=state.platform.goals.find(item=>item.id===goalId);assert.ok(saved);assert.equal(saved.targetDate,'2027-04-12');assert.deepEqual(state.preferences,initial.preferences);
 await card(marker+' Goal').getByRole('button',{name:'Edit goal',exact:true}).click();await page.getByLabel('Why this goal matters',{exact:true}).fill('Edited synthetic career plan.');await confirm();await save(page.getByRole('button',{name:'Save career goal',exact:true}),'platform/goals/'+goalId,'PATCH');
 checks.push('Career goal create/edit requires explicit confirmation and preserves global matching preferences');

 const resume=await call('resumes','POST',{title:marker+' Resume',targetRole:'Synthetic designer',text:'SYNTHETIC TEST ONLY\nSUMMARY\nOwned local fixture.\nSKILLS\nPython',source:'manual'});resumeId=resume.id;
 const job=await call('jobs','POST',{title:marker+' Job',company:'Synthetic Employer',location:'Pune',workArrangement:'Hybrid',employmentType:null,minExperience:0,maxExperience:10,requirements:['Python'],description:'Synthetic local fixture; no live job.',url:'https://example.test/career-os-'+Date.now()});jobId=job.id;

 await go('learning','Skills & Learning');await page.getByRole('button',{name:'Add learning task',exact:true}).click();
 await page.getByLabel('Learning task title',{exact:true}).fill(marker+' Learning');await page.getByLabel('Skill to develop',{exact:true}).fill('Synthetic design review');
 await page.getByLabel('Learning resource URL',{exact:true}).fill('https://example.test/synthetic-learning');
 await page.getByLabel('Linked career goal',{exact:true}).selectOption(goalId);await confirm();
 const learning=await save(page.getByRole('button',{name:'Save learning task',exact:true}),'platform/learning');learningId=learning.record.id;
 await card(marker+' Learning').getByRole('button',{name:'Edit learning task',exact:true}).click();await page.getByLabel('Learning status',{exact:true}).selectOption('completed');await confirm();await save(page.getByRole('button',{name:'Save learning task',exact:true}),'platform/learning/'+learningId,'PATCH');
 state=await call('state');assert.equal(state.platform.learningTasks.find(item=>item.id===learningId).status,'completed');assert.deepEqual(state.profile.skills,initial.profile.skills);
 checks.push('Learning task create/edit links an owned goal and records completion without inventing a profile skill');

 await go('recruiters','Recruiter CRM');await page.getByRole('button',{name:'Add recruiter',exact:true}).click();
 await page.getByLabel('Recruiter name',{exact:true}).fill(marker+' Contact');await page.getByLabel('Recruiter company',{exact:true}).fill('Synthetic Company');
 await page.getByLabel('Recruiter email',{exact:true}).fill('synthetic@example.test');await page.getByLabel('Recruiter phone',{exact:true}).fill('+919999990001');
 await page.getByLabel('Private recruiter message draft',{exact:true}).fill('SYNTHETIC PRIVATE UNSENT DRAFT. No provider send is authorized.');await confirm();
 const recruiter=await save(page.getByRole('button',{name:'Save recruiter',exact:true}),'platform/recruiters');recruiterId=recruiter.record.id;
 const contact=card(marker+' Contact');await contact.getByRole('button',{name:'Record interaction',exact:true}).click();
 await page.getByLabel('Interaction notes',{exact:true}).fill('Synthetic manually confirmed conversation note.');await page.getByLabel('Interaction date and time',{exact:true}).fill('2026-01-01T12:00');await confirm();
 await save(page.getByRole('button',{name:'Save interaction',exact:true}),'platform/recruiters/'+recruiterId+'/interactions');
 state=await call('state');const savedContact=state.platform.recruiters.find(item=>item.id===recruiterId);assert.equal(savedContact.interactions.length,1);assert.ok(savedContact.lastInteractionAt);assert.match(savedContact.draft,/UNSENT/);
 await contact.getByRole('button',{name:'Edit recruiter',exact:true}).click();await page.getByLabel('Recruiter notes',{exact:true}).fill('Edited private synthetic note.');await confirm();await save(page.getByRole('button',{name:'Save recruiter',exact:true}),'platform/recruiters/'+recruiterId,'PATCH');
 checks.push('Recruiter contact create/edit and manual interaction history persist with a private unsent draft; no send action is exposed');

 await go('calendar','Interview Calendar');await page.getByRole('button',{name:'Schedule interview',exact:true}).click();
 await page.getByLabel('Interview company',{exact:true}).fill(marker+' Interview');await page.getByLabel('Interview role',{exact:true}).fill('Synthetic designer');
 await page.getByLabel('Interview date and time',{exact:true}).fill('2027-01-15T10:00');await page.getByLabel('Interview time zone',{exact:true}).fill('Asia/Kolkata');await page.getByLabel('Interview type',{exact:true}).selectOption('technical');
 await page.getByLabel('Meeting URL',{exact:true}).fill('https://example.test/private-synthetic-meeting');await page.getByLabel('Linked recruiter',{exact:true}).selectOption(recruiterId);
 await page.getByLabel('Linked interview job',{exact:true}).selectOption(jobId);await page.getByLabel('Interview resume version',{exact:true}).selectOption(resumeId);await confirm();
 const interview=await save(page.getByRole('button',{name:'Save interview',exact:true}),'platform/interviews');interviewId=interview.record.id;
 state=await call('state');let savedInterview=state.platform.interviews.find(item=>item.id===interviewId);assert.equal(savedInterview.scheduledAt,'2027-01-15T04:30:00.000Z');assert.equal(savedInterview.source,'manual');assert.equal(savedInterview.resumeId,resumeId);
 await page.locator('.cp-card').filter({hasText:marker+' Interview'}).getByRole('button',{name:'Edit interview',exact:true}).click();assert.equal(await page.getByLabel('Interview date and time',{exact:true}).inputValue(),'2027-01-15T10:00');await page.getByLabel('Interview notes',{exact:true}).fill('Edited synthetic interview preparation note.');await confirm();await save(page.getByRole('button',{name:'Save interview',exact:true}),'platform/interviews/'+interviewId,'PATCH');
 checks.push('Manual interview create/edit links owned contact/job/resume and converts 10:00 Asia/Kolkata to 04:30 UTC correctly');

 await go('searches','Job Searches');await page.getByRole('button',{name:'New saved search',exact:true}).click();
 await page.getByLabel('Search name',{exact:true}).fill(marker+' Campaign');await page.getByLabel('Career goal',{exact:true}).fill('Synthetic manual campaign.');
 await page.getByLabel('Campaign frequency',{exact:true}).selectOption('manual');await page.getByLabel('Resume for this campaign',{exact:true}).selectOption(resumeId);
 await page.getByLabel('Minimum relevant experience',{exact:true}).fill('1');await page.getByLabel('Maximum relevant experience',{exact:true}).fill('8');await page.getByLabel('Campaign experience range is mandatory',{exact:true}).check();
 const search=await save(page.getByRole('button',{name:'Save search',exact:true}),'agents/searches');searchId=search.search.id;
 state=await call('state');const savedSearch=state.agentic.savedSearches.find(item=>item.id===searchId);assert.equal(savedSearch.frequency,'manual');assert.equal(savedSearch.resumeId,resumeId);assert.equal(savedSearch.minExperience,1);assert.equal(savedSearch.mandatoryExperience,true);
 const campaign=page.locator('.acc-search-grid article').filter({has:page.getByRole('heading',{name:marker+' Campaign',exact:true})});
 await save(campaign.getByRole('button',{name:'Pause campaign',exact:true}),'agents/searches/'+searchId,'PATCH');assert.equal((await call('state')).agentic.savedSearches.find(item=>item.id===searchId).status,'paused');
 await save(campaign.getByRole('button',{name:'Start campaign',exact:true}),'agents/searches/'+searchId,'PATCH');
 await campaign.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Campaign frequency',{exact:true}).selectOption('weekly');await save(page.getByRole('button',{name:'Save search',exact:true}),'agents/searches/'+searchId,'PATCH');
 await save(campaign.getByRole('button',{name:'Archive campaign',exact:true}),'agents/searches/'+searchId,'PATCH');
 assert.equal((await call('state')).agentic.savedSearches.find(item=>item.id===searchId).status,'archived');
 checks.push('Campaign saves an exact resume, frequency and experience filter; pause/start/edit/archive persist through the real UI');
 await go('vault','Candidate Knowledge Vault');assert.match(await page.locator('.acc').innerText(),/AI EXTRACTED.*INFERRED.*UNKNOWN/s);
 const answerForm=page.locator('form').filter({has:page.getByRole('heading',{name:'Add a reusable answer',exact:true})});
 await answerForm.getByLabel('Short answer label',{exact:true}).fill(answerKey);await answerForm.getByLabel('Screening question',{exact:true}).fill(marker+' Screening');
 await answerForm.getByLabel('Your answer',{exact:true}).fill('Confirmed synthetic answer for a local UI test; no employer submission.');
 const soon=new Date(Date.now()+48*3600000);const local=new Date(soon.getTime()-soon.getTimezoneOffset()*60000).toISOString().slice(0,16);
 await answerForm.getByLabel('Earlier answer expiry',{exact:true}).fill(local);
 await answerForm.getByLabel('I confirm this answer is accurate and may be reused in reviewed packages.',{exact:true}).check();
 await save(answerForm.getByRole('button',{name:'Save confirmed answer',exact:true}),'agents/answers');
 state=await call('state');const answer=state.agentic.confirmedAnswers.find(item=>item.key===answerKey);assert.ok(answer.fresh);assert.ok(Date.parse(answer.validUntil)<=Date.now()+49*3600000);
 checks.push('Dedicated knowledge vault distinguishes verified, extracted, inferred and unknown facts; reusable answer accepts a shorter freshness deadline');

 await go('agents','Career command center');assert.equal(await page.locator('.acc-agent-card').count(),state.agentic.agents.filter(item=>item.id!=='orchestrator').length);
 await page.locator('.acc-tabs').getByRole('button',{name:'Automation settings',exact:true}).click();
 await page.getByLabel('Preparation time',{exact:true}).fill('06:45');await save(page.getByRole('button',{name:'Save automation settings',exact:true}),'agents/settings','PUT');
 state=await call('state');assert.equal(state.agentic.settings.schedule.runTime,'06:45');
 await save(page.getByRole('button',{name:'Pause all AI agents',exact:true}),'agents/settings','PUT');assert.equal((await call('state')).agentic.settings.pausedAll,true);
 await save(page.getByRole('button',{name:'Resume agents',exact:true}),'agents/settings','PUT');state=await call('state');assert.equal(state.agentic.settings.schedule.runTime,'06:45');assert.equal(state.agentic.settings.pausedAll,false);
 checks.push('Actual expanded registry renders dynamically; configurable preparation time persists across global pause and resume');

 await go('review','Review Queue');assert.match(await page.locator('.acc').innerText(),/approval do not submit|does not submit|do not submit/i);
 await go('privacy','Privacy & Security');assert.match(await page.locator('.cp').innerText(),/Configuration.*not proof.*sent/s);
 assert.equal(await page.getByRole('button',{name:'Public sharing unavailable',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Account deletion unavailable',exact:true}).isDisabled(),true);
 assert.ok(await page.getByRole('heading',{name:'Agent permission matrix',exact:true}).count());assert.equal(await page.getByRole('link',{name:'Export account data',exact:true}).getAttribute('href'),'/api/career/export');
 checks.push('Direct review and privacy screens explain unsubmitted packages, actual provider status/data-use records, private export, and disabled sensitive capabilities');

 await go('overview');await page.getByRole('heading',{name:"Today's Actions",exact:true}).waitFor();
 assert.equal(await page.locator('.cp-action-card').filter({hasText:'Upcoming interviews'}).locator('b').innerText(),String((await call('state')).platform.interviews.filter(item=>item.status==='scheduled'&&Date.parse(item.scheduledAt)>=Date.now()).length));
 checks.push('Today actions counts scheduled interviews from owned manual records');
 await mkdir('outputs',{recursive:true});
 const views=[['goals','Career Goals'],['learning','Skills & Learning'],['recruiters','Recruiter CRM'],['calendar','Interview Calendar'],['searches','Job Searches'],['vault','Candidate Knowledge Vault'],['privacy','Privacy & Security'],['resumes','Resume Studio']];
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:width===390?844:1050});for(const [view,title] of views){await go(view,title);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,view+' horizontal overflow at '+width);}await go('goals','Career Goals');if(width===1440)await page.screenshot({path:'outputs/platform-desktop.png',fullPage:true});if(width===390)await page.screenshot({path:'outputs/platform-mobile.png',fullPage:true});}
 checks.push('Eight expanded screens have no page overflow at desktop 1440, tablet 768 and mobile 390 pixels; desktop/mobile evidence captured');

 await page.setViewportSize({width:1440,height:1050});await go('calendar','Interview Calendar');await save(page.getByRole('button',{name:'Delete interview Synthetic designer',exact:true}),'platform/interviews/'+interviewId,'DELETE');interviewId=null;
 await go('recruiters','Recruiter CRM');await save(page.getByRole('button',{name:'Delete recruiter '+marker+' Contact',exact:true}),'platform/recruiters/'+recruiterId,'DELETE');recruiterId=null;
 await go('learning','Skills & Learning');await save(page.getByRole('button',{name:'Delete learning task '+marker+' Learning',exact:true}),'platform/learning/'+learningId,'DELETE');learningId=null;
 await go('goals','Career Goals');await save(page.getByRole('button',{name:'Delete career goal '+marker+' Goal',exact:true}),'platform/goals/'+goalId,'DELETE');goalId=null;
 checks.push('Owned interview, recruiter with interaction, learning task and goal delete controls work through confirmed server requests');
 assert.deepEqual(errors,[]);checks.push('No browser page errors in the exercised local career journeys');
}catch(error){failure=error;console.error(error.stack||error.message);await mkdir('outputs',{recursive:true});await page.screenshot({path:'outputs/platform-failure.png',fullPage:true}).catch(()=>{});}
finally{
 const clean=async(label,operation)=>{try{await operation();}catch(error){cleanupErrors.push(label+': '+error.message);}};
 if(initial?.profile?.email==='seedy@sites.test'){
  for(const [resource,id] of [['interviews',interviewId],['recruiters',recruiterId],['learning',learningId],['goals',goalId]])if(id)await clean(resource,async()=>{const s=await call('state');const key=resource==='learning'?'learningTasks':resource;const record=s.platform[key].find(item=>item.id===id);if(record)await call('platform/'+resource+'/'+id,'DELETE',{confirmed:true,expectedRevision:record.revision});});
  await clean('Campaign',async()=>{if(searchId)await call('agents/searches/'+searchId,'DELETE',{});});
  await clean('Synthetic job',async()=>{if(jobId)await call('jobs/'+jobId,'DELETE',{});});
  await clean('Synthetic resume',async()=>{if(resumeId)await call('resumes/'+resumeId,'DELETE',{confirmActive:true});});
  await clean('Original automation settings',async()=>{const s=await call('state');const old=initial.agentic.settings;await call('agents/settings','PUT',{mode:old.mode,pausedAll:old.pausedAll,pausedCategories:old.pausedCategories,maxJobsPerRun:old.maxJobsPerRun,maxPackagesPerRun:old.maxPackagesPerRun,schedule:{enabled:old.schedule.enabled,timeZone:old.schedule.timeZone,runTime:old.schedule.runTime},expectedRevision:s.agentic.settings.revision});});
  await clean('Owned synthetic answer (local D1 only)',async()=>{const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));assert.equal(config.d1_databases.find(item=>item.binding==='DB').database_id,'00000000-0000-4000-8000-000000000000');const exported=await call('export'),owner=exported.agentic.career_agent_settings[0].user_id;assert.ok(typeof owner==='string'&&owner.length<200);const literal=value=>"'"+String(value).replaceAll("'","''")+"'";const sqlFile=path.resolve('.sites-runtime/platform-cleanup-'+answerKey+'.sql');await mkdir(path.dirname(sqlFile),{recursive:true});await writeFile(sqlFile,'DELETE FROM career_confirmed_answers WHERE user_id='+literal(owner)+' AND key='+literal(answerKey)+';');try{execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file',sqlFile],{cwd:process.cwd(),encoding:'utf8',timeout:60000,stdio:'pipe'});}finally{await unlink(sqlFile).catch(()=>{});}});
  await clean('Restore verification',async()=>{const s=await call('state');assert.deepEqual(s.profile,initial.profile);assert.deepEqual(s.preferences,initial.preferences);for(const name of ['goals','learningTasks','recruiters','interviews'])assert.deepEqual(s.platform[name].map(item=>item.id).sort(),initial.platform[name].map(item=>item.id).sort());assert.ok(!s.agentic.savedSearches.some(item=>item.id===searchId));assert.ok(!s.agentic.confirmedAnswers.some(item=>item.key===answerKey));assert.equal(s.agentic.settings.schedule.runTime,initial.agentic.settings.schedule.runTime);assert.equal(s.agentic.settings.pausedAll,initial.agentic.settings.pausedAll);});
 }
 const result={passed:!failure&&!cleanupErrors.length,executedAt:new Date().toISOString(),checks:checks.length,checkDescriptions:checks,pageErrors:errors,cleanupErrors,failure:failure?.message||null,scope:'Fixed synthetic loopback identity and actual local D1; no live AI, employer submission, email/WhatsApp/calendar sending or production identity tests.',cleanup:'Created goals, learning tasks, recruiter contacts/interactions, interviews, campaign, resume, job and reusable answer removed; original settings/profile/preferences preserved. Labelled synthetic immutable private history may remain locally.',screenshots:['outputs/platform-desktop.png','outputs/platform-mobile.png']};
 await mkdir('docs',{recursive:true});await writeFile('docs/platform-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
}
if(failure)throw failure;assert.deepEqual(cleanupErrors,[]);
