import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const base=new URL(process.env.CAREER_TEST_BASE_URL||'http://127.0.0.1:5173');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname),'Fixed loopback synthetic identity only.');
const {chromium}=createRequire(import.meta.url)(process.env.CAREER_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.CAREER_BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce',acceptDownloads:true});
const checks=[],errors=[],cleanupErrors=[],marker='Synthetic Resume Toolkit QA '+Date.now().toString(36);
page.on('pageerror',error=>errors.push(error.message));
let initial,resumeId,variantId,failure;
async function call(resource,method='GET',body){return page.evaluate(async({resource,method,body})=>{const response=await fetch('/api/career/'+resource,{method,cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Career-Action':'1'},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});const result=await response.json();if(!response.ok)throw Error(resource+': '+response.status+' '+(result.error||result.code));return result;},{resource,method,body});}
async function clickResponse(button,path,method='GET'){const waiting=page.waitForResponse(response=>response.url().includes('/api/career/'+path)&&response.request().method()===method,{timeout:60000});await button.click();const response=await waiting;const result=await response.json();assert.ok(response.ok(),path+': '+response.status()+' '+(result.error||result.code));return result;}
try{
 await page.goto(base.origin+'/signin-with-chatgpt?return_to=%2Fdashboard%3Fview%3Dresumes',{waitUntil:'networkidle'});initial=await call('state');assert.equal(initial.profile.email,'seedy@sites.test');
 const original='FICTIONAL QA ONLY\nSUMMARY\nSynthetic local resume review fixture.\nWORK EXPERIENCE\nSynthetic Employer 2028-2020\nDesigned synthetic test documents.\nSKILLS\nPython\nEDUCATION\nSynthetic sample only.';
 const created=await call('resumes','POST',{title:marker,targetRole:'Synthetic designer',text:original,source:'manual'});resumeId=created.id;await call('resumes/'+resumeId+'/active','POST',{});
 await page.goto(base.origin+'/dashboard?view=resumes',{waitUntil:'networkidle'});
 const toolkit=page.locator('.resume-toolkit');await toolkit.getByRole('heading',{name:'Resume review & exports',exact:true}).waitFor();
 await toolkit.getByRole('combobox',{name:/^Resume version/}).selectOption(resumeId);
 const review=await clickResponse(toolkit.getByRole('button',{name:'Review selected version',exact:true}),'resumes/'+resumeId+'/analysis');
 assert.ok(review.factCheck.flags.some(flag=>flag.category==='dates'));assert.match((await toolkit.locator('.resume-fact-flag').allTextContents()).join(' '),/dates|date|2028|2020/i);
 checks.push('Owned selected resume review produces an actual reversed/future-date indicator with its limited-evidence explanation');
 const skill=review.sections.find(section=>/skills/i.test(section.heading)),education=review.sections.find(section=>/education/i.test(section.heading));assert.ok(skill&&education);
 assert.equal(await toolkit.getByRole('button',{name:'Save formatted separate version',exact:true}).isDisabled(),true);
 await toolkit.getByLabel(education.heading,{exact:true}).uncheck();await toolkit.getByRole('button',{name:'Move '+skill.heading+' up',exact:true}).click();
 await toolkit.getByRole('combobox',{name:/^Document template/}).selectOption('modern');await toolkit.getByLabel('New version name',{exact:true}).fill(marker+' Formatted');
 assert.equal(await toolkit.getByRole('button',{name:'Save formatted separate version',exact:true}).isDisabled(),true);
 await toolkit.getByLabel('I reviewed the content, visible sections and factual claims in this version.',{exact:true}).check();
 const saved=await clickResponse(toolkit.getByRole('button',{name:'Save formatted separate version',exact:true}),'resumes/'+resumeId+'/variant','POST');variantId=saved.id;
 let state=await call('state');assert.equal(state.activeResumeId,resumeId);assert.equal(state.resumes.find(item=>item.id===resumeId).text,original);let variant=state.resumes.find(item=>item.id===variantId);assert.ok(variant);assert.equal(variant.metadata.template,'modern');assert.ok(!variant.text.includes('Synthetic sample only.'));
 checks.push('Section hiding/reordering and template choice require explicit review, create a separate version, and preserve the original text and active selection');
 await toolkit.getByRole('combobox',{name:/^Original version to compare/}).selectOption(resumeId);
 const compared=await clickResponse(toolkit.getByRole('button',{name:'Review selected version',exact:true}),'resumes/'+variantId+'/analysis');
 assert.ok(compared.difference.lines.some(line=>line.kind==='removed'&&line.text.includes('Synthetic sample only.')));await toolkit.getByRole('heading',{name:'Original vs selected resume',exact:true}).waitFor();
 assert.ok(await toolkit.locator('.resume-diff-line.removed').count());
 checks.push('Original-versus-selected comparison displays actual removed education content');
 await mkdir('outputs',{recursive:true});
 for(const format of ['PDF','DOCX']){const waiting=page.waitForEvent('download',{timeout:60000});await toolkit.getByRole('button',{name:'Export '+format,exact:true}).click();const download=await waiting;assert.equal(await download.failure(),null);const file='outputs/resume-toolkit-synthetic.'+format.toLowerCase();await download.saveAs(file);const bytes=await readFile(file);assert.ok(bytes.length>100);if(format==='PDF')assert.equal(bytes.subarray(0,4).toString(),'%PDF');else assert.equal(bytes.subarray(0,2).toString(),'PK');}
 checks.push('Saved selected version produces actual PDF and DOCX browser downloads with valid container signatures');
 await clickResponse(toolkit.getByRole('button',{name:'Archive version',exact:true}),'resumes/'+variantId+'/archive','PATCH');
 assert.equal((await call('state')).resumes.find(item=>item.id===variantId).archived,true);
 await clickResponse(toolkit.getByRole('button',{name:'Restore from archive',exact:true}),'resumes/'+variantId+'/archive','PATCH');
 assert.equal((await call('state')).resumes.find(item=>item.id===variantId).archived,false);
 checks.push('Owned separate resume version archives and restores through the real interface');
 await toolkit.getByRole('button',{name:'Review selected version',exact:true}).click();await toolkit.getByRole('heading',{name:'Formatted preview',exact:true}).waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Resume screen page overflow '+width);await page.screenshot({path:'outputs/resume-toolkit-'+(width===390?'mobile':'desktop')+'.png',fullPage:true});}
 checks.push('Resume review, comparison and template panels fit desktop 1440 and mobile 390 pixels with screenshots');
 assert.deepEqual(errors,[]);checks.push('No browser page errors during the exercised resume studio flow');
}catch(error){failure=error;console.error(error.stack||error.message);await mkdir('outputs',{recursive:true});await page.screenshot({path:'outputs/resume-toolkit-failure.png',fullPage:true}).catch(()=>{});}
finally{
 const clean=async(label,operation)=>{try{await operation();}catch(error){cleanupErrors.push(label+': '+error.message);}};
 if(initial?.profile?.email==='seedy@sites.test'){
  await clean('Original active selection',async()=>{if(initial.activeResumeId)await call('resumes/'+initial.activeResumeId+'/active','POST',{});});
  await clean('Created versions',async()=>{const s=await call('state');for(const record of s.resumes.filter(item=>!initial.resumes.some(before=>before.id===item.id)&&item.title.startsWith(marker)))await call('resumes/'+record.id,'DELETE',{confirmActive:record.active});});
  await clean('Restore verification',async()=>{const s=await call('state');assert.equal(s.activeResumeId,initial.activeResumeId);assert.deepEqual(s.resumes.map(item=>item.id).sort(),initial.resumes.map(item=>item.id).sort());assert.deepEqual(s.profile,initial.profile);assert.deepEqual(s.preferences,initial.preferences);});
 }
 const result={passed:!failure&&!cleanupErrors.length,executedAt:new Date().toISOString(),checks:checks.length,checkDescriptions:checks,pageErrors:errors,cleanupErrors,failure:failure?.message||null,scope:'Fixed synthetic loopback identity with actual local D1, owned saved documents, real PDF/DOCX exports; no uploaded scanner, live AI or production identity test.',cleanup:'Created source and formatted resume versions removed; original active selection/profile/preferences preserved. Private immutable synthetic history may remain locally.',screenshots:['outputs/resume-toolkit-desktop.png','outputs/resume-toolkit-mobile.png'],exports:['outputs/resume-toolkit-synthetic.pdf','outputs/resume-toolkit-synthetic.docx']};await mkdir('docs',{recursive:true});await writeFile('docs/resume-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
}
if(failure)throw failure;assert.deepEqual(cleanupErrors,[]);
