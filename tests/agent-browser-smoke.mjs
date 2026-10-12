import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const base = new URL(process.env.CAREER_TEST_BASE_URL || 'http://127.0.0.1:5173');
assert.ok(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname), 'Only the fixed loopback development identity may be tested.');
const { chromium } = createRequire(import.meta.url)(process.env.CAREER_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.CAREER_BROWSER_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const errors = []; const checks = []; const cleanupErrors = [];
page.on('pageerror', error => errors.push(error.message));
const nonce = Date.now().toString(36);
const marker = 'Synthetic Agent Browser QA ' + nonce;
const factKey = 'qa_agent_fact_' + nonce;
const answerKey = 'job_specific_screening';
let initial; let initialExport; let jobId; let resumeId; let createdSearchId; let packageId;
let testFailure;
async function call(resource, method = 'GET', body) {
  return page.evaluate(async ({ resource, method, body }) => {
    const response = await fetch('/api/career/' + resource, { method, cache: 'no-store', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Career-Action': '1' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(`${resource}: ${response.status} ${data.error || data.code}`);
    return data;
  }, { resource, method, body });
}
function responseFor(fragment, method) { return page.waitForResponse(response => response.url().includes('/api/career/' + fragment) && response.request().method() === method, { timeout: 60000 }); }
async function clickAndWait(locator, fragment, method) {
  const waiting = responseFor(fragment, method);
  await locator.click();
  const response = await waiting;
  const body = await response.json();
  assert.ok(response.status() >= 200 && response.status() < 300, `${fragment}: ${response.status()} ${body.error || body.code || 'unexpected status'}`);
  await page.locator('.acc').getByRole('status').first().waitFor({ state: 'visible' });
  return { response, body };
}
async function section(title) { await page.locator('.acc-tabs').getByRole('button', { name: title === 'Review pending actions' ? /^Review pending actions/ : title, exact: title !== 'Review pending actions' }).click(); }
async function openAgents() { await page.goto(base.origin + '/dashboard?view=agents', { waitUntil: 'networkidle' }); await page.getByRole('heading', { name: 'Career command center', exact: true }).waitFor(); }
function packageCard() { return page.locator('[data-package-id="' + packageId + '"]'); }
try {
  await page.goto(base.origin + '/signin-with-chatgpt?return_to=%2Fdashboard%3Fview%3Dagents', { waitUntil: 'networkidle' });
  initial = await call('state');
  assert.equal(initial.profile.email, 'seedy@sites.test', 'Refusing to mutate a real identity.');
  initialExport = await call('export'); assert.equal(initial.agentic.agents.length, 18);
  assert.equal(initial.agentic.settings.mode, 'approval', 'This test begins with the actual default approval mode.');
  await call('profile', 'PUT', { profile: { ...initial.profile, fullName: marker, headline: marker + ' Role', currentRole: marker + ' Role', currentCity: 'Pune', skills: ['Python'], summary: 'Confirmed fictional experience for local browser testing.', workHistory: 'Reviewed synthetic Python examples.', totalExperience: 3, relevantExperience: 3 }, preferences: { ...initial.preferences, targetRoles: [marker + ' Role'], preferredCities: ['Pune'], workArrangements: ['Hybrid'], employmentTypes: [], mandatoryLocation: true, mandatoryWorkArrangement: true, mandatoryEmploymentType: false }, expectedRevision: initial.revision });
  const resume = await call('resumes', 'POST', { title: marker + ' Resume', targetRole: marker + ' Role', text: 'SYNTHETIC TEST ONLY\nSUMMARY\nConfirmed fictional experience for local browser testing.\nSKILLS\nPython', source: 'manual' });
  resumeId = resume.id; await call('resumes/' + resumeId + '/active', 'POST', {});
  const job = await call('jobs', 'POST', { title: marker + ' Role', company: marker + ' Employer', location: 'Pune', workArrangement: 'Hybrid', employmentType: null, minExperience: 2, maxExperience: 5, requirements: ['Python'], description: 'Synthetic authorized local fixture. Python skills requested. No live vacancy or external submission.', url: 'https://example.test/synthetic-agent-' + nonce });
  jobId = job.id;
  await openAgents();
  assert.equal(await page.locator('.acc-agent-card').count(), 17);
  assert.match(await page.locator('.acc-orchestrator').innerText(), /orchestrator/i);
  checks.push('Actual registry contains 17 specialists plus one orchestrator; default approval mode, no simulated activity');

  await section('Saved searches');
  await page.getByRole('button', { name: 'New saved search', exact: true }).click();
  await page.getByLabel('Search name', { exact: true }).fill(marker);
  await page.getByLabel('Career goal', { exact: true }).fill('Explore a synthetic Python career direction.');
  await clickAndWait(page.getByRole('button', { name: 'Save search', exact: true }), 'agents/searches', 'POST');
  let state = await call('state');
  let saved = state.agentic.savedSearches.find(search => search.label === marker);
  assert.ok(saved); createdSearchId = saved.id;
  const searchCard = page.locator('.acc-search-grid article').filter({ has: page.getByRole('heading', { name: marker, exact: true }) });
  await searchCard.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Career goal', { exact: true }).fill('Edited synthetic goal; preserve mandatory Pune and Hybrid preferences.');
  await clickAndWait(page.getByRole('button', { name: 'Save search', exact: true }), 'agents/searches/' + createdSearchId, 'PATCH');
  state = await call('state'); saved = state.agentic.savedSearches.find(search => search.id === createdSearchId);
  assert.match(saved.goal, /Edited synthetic/); assert.equal(saved.preferences.mandatoryLocation, true);
  checks.push('Saved search created and edited through real UI/API; mandatory profile preferences retained');

  await section('Automation settings');
  await page.getByLabel('Pause document preparation', { exact: true }).check();
  await clickAndWait(page.getByRole('button', { name: 'Save automation settings', exact: true }), 'agents/settings', 'PUT');
  state = await call('state'); assert.ok(state.agentic.settings.pausedCategories.includes('documents'));
  await section('Saved searches');
  await clickAndWait(searchCard.getByRole('button', { name: 'Run search', exact: true }), 'agents/runs', 'POST');
  state = await call('state'); const queued = state.agentic.runs.find(run => run.searchId === createdSearchId && run.status === 'queued');
  assert.ok(queued, 'Paused document category should leave genuine durable work queued.');
  await section('Your agents');
  const runStrip = page.locator('.acc-run-strip').filter({ has: page.getByRole('button', { name: 'Continue workflow', exact: true }) }).first();
  await clickAndWait(runStrip.getByRole('button', { name: 'Continue workflow', exact: true }), 'agents/runs/' + queued.id + '/continue', 'POST');
  state = await call('state'); assert.equal(state.agentic.runs.find(run => run.id === queued.id).status, 'queued');
  checks.push('Saved search starts actual bounded workflow; Continue calls real queued work without falsely claiming completion while document category paused');

  await clickAndWait(page.getByRole('button', { name: 'Pause all', exact: true }), 'agents/settings', 'PUT');
  await page.locator('.agent-pause-notice').waitFor();
  state = await call('state'); assert.equal(state.agentic.settings.pausedAll, true); assert.ok(state.agentic.settings.pausedCategories.includes('documents'));
  await clickAndWait(page.getByRole('button', { name: 'Resume agents', exact: true }), 'agents/settings', 'PUT');
  state = await call('state'); assert.equal(state.agentic.settings.pausedAll, false); assert.ok(state.agentic.settings.pausedCategories.includes('documents'));
  checks.push('Pause all and Resume persist; category-specific pause survives both and global notice is visible');

  await section('Automation settings');
  await page.getByLabel('Pause document preparation', { exact: true }).uncheck();
  await page.getByLabel('Pause communications', { exact: true }).check();
  await page.getByRole('radio', { name: /Agentic/ }).check();
  await page.getByLabel('Request daily career workflows', { exact: true }).check();
  await page.getByLabel('Time zone', { exact: true }).fill('Asia/Kolkata');
  await clickAndWait(page.getByRole('button', { name: 'Save automation settings', exact: true }), 'agents/settings', 'PUT');
  await page.reload({ waitUntil: 'networkidle' });
  await section('Automation settings');
  assert.equal(await page.getByRole('radio', { name: /Agentic/ }).isChecked(), true);
  assert.equal(await page.getByLabel('Pause communications', { exact: true }).isChecked(), true);
  state = await call('state'); assert.equal(state.agentic.settings.schedule.runTime, '07:30'); assert.equal(state.agentic.settings.schedule.configured, false); assert.equal(state.agentic.settings.schedule.nextRunAt, null);
  assert.match(await page.locator('.acc-settings').innerText(), /setup|required|deploy/i);
  checks.push('Mode, independent communications pause and 07:30 schedule preference persist; undeployed unattended setup remains honest');

  await section('Review pending actions');
  await page.getByLabel('Job for this application package', { exact: true }).selectOption(jobId);
  const prepared = await clickAndWait(page.getByRole('button', { name: 'Prepare package', exact: true }), 'agents/packages', 'POST');
  packageId = prepared.body.package.id;
  let pack = prepared.body.package;
  assert.equal(pack.jobId, jobId);
  assert.ok(pack.unknowns.some(item => item.required && item.key === 'answer.job_specific_screening'));
  const card = packageCard();
  await card.waitFor();
  assert.match(await card.innerText(), /Needs your input before approval/);
  assert.equal(await card.getByRole('button', { name: 'Approve reviewed package', exact: true }).isDisabled(), true);
  assert.match(await card.innerText(), new RegExp(marker + ' Employer'));
  assert.equal(pack.snapshot.resume.id, resumeId);
  assert.equal(pack.snapshot.job.url, 'https://example.test/synthetic-agent-' + nonce);
  checks.push('Direct package uses exact owned job and active resume; required unknown screening question is visible and approval blocked');

  await card.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Screening answers$/ }) }).locator('summary').click();
  const requiredAnswerForm = card.locator('form').filter({ has: page.getByRole('heading', { name: /Which screening questions does this employer actually require/ }) });
  await requiredAnswerForm.getByLabel('Your answer', { exact: true }).fill('SYNTHETIC EMPLOYER FIXTURE ONLY: the fictional employer asks whether all examples are test data. Answer: yes; no real application or screening answers are being sent.');
  await requiredAnswerForm.getByLabel('I confirm this answer is accurate and may be reused in reviewed packages.', { exact: true }).check();
  await clickAndWait(requiredAnswerForm.getByRole('button', { name: 'Save confirmed answer', exact: true }), 'agents/answers', 'POST');
  state = await call('state');
  assert.equal(state.agentic.confirmedAnswers.find(answer => answer.key === answerKey).classification, 'VERIFIED');
  assert.equal(state.agentic.packages.find(item => item.id === packageId).status, 'stale');
  checks.push('Missing screening answer supplied in package UI with explicit confirmation; prior snapshot becomes stale');

  await call('agents/vault/confirm', 'POST', { key: factKey, label: marker + ' fact', value: 'Synthetic confirmed initial fact.', confirmed: true });
  await openAgents(); await section('Career facts & answers');
  const factForm = page.locator('.acc-vault-grid form').filter({ has: page.getByRole('heading', { name: marker + ' fact', exact: true }) });
  await factForm.getByLabel('Value for ' + marker + ' fact', { exact: true }).fill('Synthetic fact reviewed through the visible confirmation control.');
  assert.equal(await factForm.getByRole('button', { name: 'Verify fact', exact: true }).isDisabled(), true);
  await factForm.getByLabel('I have checked this information and confirm it is accurate.', { exact: true }).check();
  await clickAndWait(factForm.getByRole('button', { name: 'Verify fact', exact: true }), 'agents/vault/confirm', 'POST');
  state = await call('state');
  assert.equal(state.agentic.vault.find(fact => fact.key === factKey).classification, 'VERIFIED');
  assert.ok(state.agentic.vaultHistory.some(entry => entry.key === factKey));
  checks.push('Vault edits require an explicit accurate-fact confirmation and create actual owned field history');
  await factForm.locator('details').locator('summary').click();
  assert.match(await factForm.locator('details').innerText(), /Synthetic fact reviewed through the visible confirmation control/);
  checks.push('Vault field history shows actual confirmed value and classification from persisted change records');
  const jobBeforeFeedback = state.jobs.find(item => item.id === jobId);
  await page.getByLabel('Job for this feedback', { exact:true }).selectOption(jobId);
  await page.getByLabel('Feedback reason', {exact:true}).selectOption('Wrong job type');
  await page.getByLabel('Details or job types to avoid', {exact:true}).fill(marker + ' feedback; this is a synthetic local listing.');
  const feedbackResult = await clickAndWait(page.locator('.acc-feedback').getByRole('button', {name:'Save feedback',exact:true}), 'agents/feedback', 'POST');
  assert.equal(feedbackResult.response.request().postDataJSON().jobId, jobId);
  state = await call('state');
  assert.ok(state.agentic.feedback.some(item => item.jobId === jobId && item.reason === 'Wrong job type'));
  const jobAfterFeedback = state.jobs.find(item => item.id === jobId);
  assert.equal(jobAfterFeedback.memoryAdjustment.points, -10);
  assert.equal(jobAfterFeedback.relevance.score, jobBeforeFeedback.relevance.score);
  assert.equal(jobAfterFeedback.relevance.eligible, jobBeforeFeedback.relevance.eligible);
  assert.match(await page.locator('.acc-feedback').innerText(), /General feedback is recorded as memory/);
  checks.push('Job-specific feedback is owner-linked and lowers queue priority by 10; evidence score and mandatory eligibility stay unchanged');

  await section('Review pending actions');
  await clickAndWait(packageCard().getByRole('button', { name: 'Refresh package snapshot', exact: true }), 'agents/packages/' + packageId, 'PATCH');
  state = await call('state'); pack = state.agentic.packages.find(item => item.id === packageId);
  assert.equal(pack.unknowns.filter(item => item.required).length, 0);
  const coverDetails = packageCard().locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Exact cover letter$/ }) });
  await coverDetails.locator('summary').click();
  await coverDetails.getByRole('button', { name: 'Edit cover letter and disclosure', exact: true }).click();
  await packageCard().getByLabel('Cover letter text', { exact: true }).fill('SYNTHETIC TEST ONLY. This draft uses the reviewed fictional Python skills in the selected local resume. No employers, results or qualifications are invented.');
  await packageCard().getByLabel('I checked this draft and the information included in it.', { exact: true }).check();
  await clickAndWait(packageCard().getByRole('button', { name: 'Save package changes', exact: true }), 'agents/packages/' + packageId, 'PATCH');
  state = await call('state'); pack = state.agentic.packages.find(item => item.id === packageId);
  assert.match(pack.snapshot.coverLetter.text, /^SYNTHETIC TEST ONLY/);
  assert.ok(pack.snapshot.coverLetter.version);
  await packageCard().getByLabel('I reviewed this exact job, document versions, answers and personal information. I understand approval alone does not submit anything.', { exact: true }).check();
  if (pack.unknowns.some(item => !item.required)) await packageCard().getByLabel('I reviewed the optional uncertainties listed above.', { exact: true }).check();
  const approved = await clickAndWait(packageCard().getByRole('button', { name: 'Approve reviewed package', exact: true }), 'agents/packages/' + packageId + '/approve', 'POST');
  const submittedReview = approved.response.request().postDataJSON();
  assert.equal(submittedReview.reviewedHash, pack.snapshotHash);
  assert.equal(submittedReview.expectedRevision, pack.revision);
  assert.equal(approved.body.package.approval.status, 'approved');
  state = await call('state');
  assert.equal(state.applications.filter(item => item.status === 'Applied').length, initial.applications.filter(item => item.status === 'Applied').length);
  assert.equal(await packageCard().getByRole('button', { name: /^Apply$/ }).count(), 0);
  checks.push('Cover draft edited and reviewed; approval submits exact hash/version and never submits a job application or changes Applied count');

  const downloaded = await page.evaluate(async id => { const response = await fetch('/api/career/agents/packages/' + id + '/download'); return {status: response.status, cache: response.headers.get('cache-control'), contentDisposition: response.headers.get('content-disposition'), data: await response.json()}; }, packageId);
  assert.equal(downloaded.status, 200); assert.match(downloaded.cache, /no-store/); assert.match(downloaded.contentDisposition, /attachment/);
  assert.match(JSON.stringify(downloaded.data), /SYNTHETIC TEST ONLY/);
  checks.push('Package download is an authenticated private attachment containing the reviewed snapshot');

  await section('Career facts & answers');
  await factForm.getByLabel('Value for ' + marker + ' fact', { exact: true }).fill('Synthetic fact changed after approval to test invalidation.');
  await factForm.getByLabel('I have checked this information and confirm it is accurate.', { exact: true }).check();
  await clickAndWait(factForm.getByRole('button', { name: 'Verify fact', exact: true }), 'agents/vault/confirm', 'POST');
  await section('Review pending actions');
  state = await call('state'); pack = state.agentic.packages.find(item => item.id === packageId);
  assert.equal(pack.status, 'stale'); assert.equal(pack.approval.status, 'invalidated');
  assert.match(await packageCard().innerText(), /out of date|stale/i);
  assert.equal(await packageCard().getByRole('button', { name: 'Approve reviewed package', exact: true }).isDisabled(), true);
  await clickAndWait(packageCard().getByRole('button', { name: 'Refresh package snapshot', exact: true }), 'agents/packages/' + packageId, 'PATCH');
  assert.equal(await packageCard().getByLabel('I reviewed this exact job, document versions, answers and personal information. I understand approval alone does not submit anything.', { exact: true }).isChecked(), false);
  checks.push('Changing a confirmed fact invalidates server approval; stale package cannot approve and refresh resets the explicit review checkbox');

  await section('Activity history');
  assert.ok((await call('state')).agentic.activity.length > initial.agentic.activity.length);
  assert.match(await page.locator('.acc').innerText(), /Synthetic|workflow|confirmed|review/i);
  checks.push('Activity history displays actual persisted workflow and review events');
  await mkdir('outputs', { recursive: true });
  await section('Your agents');
  const widths = [1440, 768, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1050 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow at width ' + width);
    if (width === 1440) await page.screenshot({ path: 'outputs/agent-command-center-desktop.png', fullPage: true });
    if (width === 390) await page.screenshot({ path: 'outputs/agent-command-center-mobile.png', fullPage: true });
  }
  checks.push('Command center has no horizontal overflow at 1440, 768 and 390 pixels; real desktop/mobile screenshots saved');
  assert.deepEqual(errors, []);
  checks.push('No browser page errors during the exercised local workflows');
} catch (error) {
  testFailure = error;
  console.error(error.stack || error.message);
  await mkdir('outputs', { recursive: true });
  await page.screenshot({ path: 'outputs/agent-command-center-failure.png', fullPage: true }).catch(() => {});
} finally {
  if (initial?.profile?.email === 'seedy@sites.test') {
    const clean = async (label, action) => { try { await action(); } catch (error) { cleanupErrors.push(label + ': ' + error.message); } };
    await clean('Original profile', async () => { const current = await call('state'); await call('profile', 'PUT', {profile:initial.profile,preferences:initial.preferences,expectedRevision:current.revision}); });
    await clean('Original settings', async () => { const current = await call('state'); const original = initial.agentic.settings; await call('agents/settings', 'PUT', {mode:original.mode,pausedAll:original.pausedAll,pausedCategories:original.pausedCategories,maxJobsPerRun:original.maxJobsPerRun,maxPackagesPerRun:original.maxPackagesPerRun,schedule:{enabled:original.schedule.enabled,timeZone:original.schedule.timeZone,runTime:'07:30'},expectedRevision:current.agentic.settings.revision}); });
    await clean('Created AI history', async () => { const current = await call('state'); for (const session of current.aiSessions.filter(item => !initial.aiSessions.some(prior => prior.id === item.id))) await call('ai-sessions/' + session.id, 'DELETE', {}); for (const document of current.generatedDocuments.filter(item => !initial.generatedDocuments.some(prior => prior.id === item.id))) await call('generated-documents/' + document.id, 'DELETE', {}); });
    await clean('Created saved search', async () => { if (createdSearchId) await call('agents/searches/' + createdSearchId, 'DELETE', {}); });
    await clean('Created job', async () => { if (jobId) await call('jobs/' + jobId, 'DELETE', {}); });
    await clean('Original active resume', async () => { if (initial.activeResumeId) await call('resumes/' + initial.activeResumeId + '/active', 'POST', {}); });
    await clean('Created resume versions', async () => { const current = await call('state'); for (const resume of current.resumes.filter(item => !initial.resumes.some(prior => prior.id === item.id))) await call('resumes/' + resume.id, 'DELETE', {confirmActive:true}); });
    await clean('Original vault and reusable answers (owned local D1 only)', async () => {
      const config = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'));
      assert.equal(config.d1_databases.find(item => item.binding === 'DB').database_id, '00000000-0000-4000-8000-000000000000');
      const original = initialExport.agentic;
      const owner = original.career_agent_settings[0].user_id;
      assert.ok(typeof owner === 'string' && owner.length < 200);
      const literal = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
      const tables = ['career_vault_facts', 'career_confirmed_answers', 'career_agent_feedback'];
      const statements = [];
      for (const table of tables) {
        statements.push(`DELETE FROM ${table} WHERE user_id=${literal(owner)};`);
        for (const row of original[table]) {
          assert.equal(row.user_id, owner);
          const columns = Object.keys(row); assert.ok(columns.every(column => /^[a-z_]+$/.test(column)));
          statements.push(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(column => literal(row[column])).join(',')});`);
        }
      }
      const sqlFile = path.resolve('.sites-runtime/agent-test-cleanup-' + nonce + '.sql');
      await mkdir(path.dirname(sqlFile), {recursive:true}); await writeFile(sqlFile, statements.join('\n'));
      try { execFileSync(process.execPath, ['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file',sqlFile], {cwd:process.cwd(),encoding:'utf8',timeout:60000,stdio:'pipe'}); } finally { await unlink(sqlFile).catch(() => {}); }
    });
    await clean('Restoration verification', async () => { const current = await call('state'); assert.deepEqual(current.profile, initial.profile); assert.deepEqual(current.preferences, initial.preferences); assert.equal(current.agentic.settings.mode, initial.agentic.settings.mode); assert.equal(current.agentic.settings.pausedAll, initial.agentic.settings.pausedAll); assert.deepEqual(current.agentic.settings.pausedCategories, initial.agentic.settings.pausedCategories); assert.ok(!current.jobs.some(item => item.id === jobId)); assert.ok(!current.resumes.some(item => item.id === resumeId)); assert.ok(!current.agentic.savedSearches.some(item => item.id === createdSearchId)); assert.ok(!current.agentic.vault.some(item => item.key === factKey)); assert.deepEqual(current.agentic.confirmedAnswers.map(({key,question,value}) => ({key,question,value})), initial.agentic.confirmedAnswers.map(({key,question,value}) => ({key,question,value}))); });
  }
  await mkdir('docs', { recursive:true });
  const result = {passed:!testFailure && !cleanupErrors.length,executedAt:new Date().toISOString(),checks:checks.length,checkDescriptions:checks,pageErrors:errors,cleanupErrors,failure:testFailure?.message || null,scope:'Fixed synthetic loopback identity, actual local D1 and browser; no live AI, employer submission, messaging or production identity tests.',cleanup:'Original profile, preferences, settings, active resume, vault, answers and feedback restored; created searches/jobs/resumes/AI sessions removed. Labelled synthetic agent run/activity/package history may remain locally.',screenshots:['outputs/agent-command-center-desktop.png','outputs/agent-command-center-mobile.png']};
  await writeFile('docs/agent-browser-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); await browser.close();
}
if (testFailure) throw testFailure;
assert.deepEqual(cleanupErrors, []);
