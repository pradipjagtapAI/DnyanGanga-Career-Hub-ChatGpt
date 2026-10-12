# Agent command center: interface and verification

This update adds a private **AI Agent Command Center** to DnyanGanga Career Hub at `/dashboard?view=agents`. Its state comes from the signed-in account's server records. The public demonstration does not invent agent runs, activity, submissions, or success counts.

The implementation is in `app/ui/agent-command-center.tsx`; its scoped light-theme styles are appended beneath the `AGENTCOMMANDCENTER` comment in `app/globals.css`. The workspace owns sign-in, navigation, and the full-state update callback. The component receives `AgentCommandState` and posts through the existing owned `/api/career/agents/...` routes. It imports the server contract as a TypeScript type only.

## What the candidate can do

- See 17 registered specialists and a separate Career orchestrator. Cards show real status, current task, last activity, next recorded run, completed steps, pending steps, and failures. Missing dates or counts are explicitly shown as unavailable. Counts describe the recent bounded records returned by the server, not lifetime totals.
- Pause all work and resume it while preserving independent pauses for job discovery, notifications, document preparation, applications, and communications. The global pause notice also appears elsewhere in the account workspace.
- Create, edit, enable, delete, and run saved searches. Each search contains a name, goal, and inherited or custom preferences. The server rejects attempts to relax mandatory profile preferences. A genuine queued workflow has a **Continue workflow** control; it does not show fictitious completion when a category remains paused.
- Review VERIFIED, INFERRED, and UNKNOWN career facts, with actual field history. A verified value means the candidate explicitly confirmed it; it is not independent credential verification. Changing a fact requires a visible accuracy confirmation. A changed value resets that confirmation.
- Confirm reusable screening answers. Missing required answers remain visible in an application package. Neither the browser nor an agent invents an answer.
- Prepare an application package for an owned job. The review shows employer, source, original URL, recorded dates, exact resume version/content, cover-letter version/content, screening answers, and separate personal fields. The screen also explains that document text may contain additional personal information.
- Edit a cover-letter draft and selected personal fields before approval. Refresh a stale snapshot and review it again. Approve the exact server hash and revision only after explicit review and acknowledgement of optional uncertainties. Required unknowns and stale snapshots block the approval button; server checks remain authoritative.
- Download a private package and open its original listing. Approval, download, and opening a listing do not submit an application or mark it Applied. Automatic employer submission and employer communications remain unavailable.
- Record feedback against an owned job. This lowers that listing's preparation priority by 10 points while preserving its nine-factor evidence score and mandatory eligibility. General feedback is stored as career memory and explicitly does not change rankings.
- Inspect actual activity, limited dated market evidence, and unsent follow-up drafts. A limited job sample is not presented as a whole-market salary or employment trend.
- Choose Assist, Approval (the default), or Agentic mode. Agentic mode enables only permitted internal steps. It cannot bypass exact approval, provider access, consent, ownership, or server policy checks. Request daily preparation at 07:30 in a selected time zone, before the separate 08:00 alert schedule. Saving preferences does not deploy a scheduler; the interface shows setup required and no next run until server configuration supports unattended work.

The specialist registry is shared with the backend: profile, resume intelligence, job discovery, job verification, job matching, resume tailoring, cover letter, application preparation, application approval, application execution, application tracking, notification, interview preparation, career coach, market intelligence, follow-up, and security policy. The orchestrator is displayed separately and is not counted as an eighteenth specialist.

## Interface safeguards

The browser stores edits only in component memory while a form is open. It does not put private documents, answers, packages, or credentials in localStorage or IndexedDB. Saving creates owned server records. A refresh or closing an unsaved form can discard those local edits; this interface does not claim a durable offline draft.

Mutations use JSON, the existing same-origin action header, server revisions, and the existing private API. The browser never sends user IDs, roles, document ownership claims, trusted prices, or a fabricated package snapshot. Direct package preparation sends only `jobId`; the server selects the owned active resume and confirmed context. A double-click guard prevents concurrent component actions, while server idempotency and transactions provide the persistent controls.

Only HTTPS links without embedded credentials are rendered as external links. They use `noopener noreferrer`. All user text is rendered as ordinary React text; no imported HTML is inserted. A package may include untrusted document text for review, but that text cannot enable a tool or action.

The component polls every four seconds only when actual work is queued or running. It aborts requests and clears the timer on unmount, stops polling when all work is paused, and permits one pending poll at a time. Poll failures show the last confirmed state with a retry message. They do not advance a simulated progress bar.

Form controls have explicit label associations and separate hint descriptions, including controls inside React fragments. Checkboxes and radio choices are keyboard-operable. Existing visible-focus and reduced-motion rules apply. Scoped layouts change from three columns to one on small screens and wrap long content. This is a local visual and interaction check, not an exhaustive accessibility certification.

Private application packages and audit history can retain copies after a source resume or conversation is deleted. This limitation is visible in the vault and activity history. An actual retention/deletion policy and full cleanup controls remain release dependencies; the UI does not promise complete erasure from those records.

## Actual verification

The final local browser run completed at **2026-10-12T14:57:26.930Z** with **16 checks passed, zero browser page errors, and zero cleanup errors**. Exact evidence is in [`agent-browser-results.json`](agent-browser-results.json). The test used the fixed fictional `seedy@sites.test` development identity, a synthetic resume, a manually imported fictional job at `example.test`, and actual local D1 storage.

The checks covered the registry/default approval mode; saved-search creation/editing and mandatory preferences; real workflow run and Continue; global/category pause preservation; persisted mode and 07:30 preferences with honest undeployed status; required screening-answer prompts and blocked approval; explicitly confirmed answers and stale snapshots; vault confirmation/history and actual history values; owned-job feedback with unchanged evidence/eligibility; edited cover letter and exact approval hash/revision; private package download; fact-change approval invalidation and refreshed review reset; actual persisted activity; and responsive layout at 1440, 768, and 390 pixels.

Desktop and mobile screenshots are `outputs/agent-command-center-desktop.png` and `outputs/agent-command-center-mobile.png`. They show the synthetic account before cleanup. Earlier attempts found a form-label issue; the implementation was corrected and the complete suite rerun successfully. An earlier failure screenshot is diagnostic evidence, not a final product preview.

The test restored the original profile, preferences, settings, active resume, vault, reusable answers, and feedback; removed created jobs, saved searches, resume versions, and generated AI records; and verified cleanup. Owned synthetic run/activity/package history may remain locally, labelled with synthetic goals. Its cleanup helper is guarded to loopback, a placeholder local D1 database ID, and the owner taken from that fictional account's private export. It must not be adapted into a production cleanup procedure.

After the final UI edits, `tsc --noEmit` and focused ESLint for `app/ui/agent-command-center.tsx` both exited 0. The broader backend, AI, provider, agent-store, and orchestrator tests and release blockers are recorded in the separate handovers; this document does not claim those checks were run by the browser test.

### Repeat locally

Run from the site root after installing the documented dependencies, applying all local migrations, and starting the development server with the fixed synthetic identity:

```powershell
$env:CAREER_PLAYWRIGHT_MODULE = 'C:/Users/jagta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CAREER_BROWSER_CHANNEL = 'msedge'
& 'C:/Program Files/nodejs/node.exe' tests/agent-browser-smoke.mjs
& 'C:/Program Files/nodejs/node.exe' ./node_modules/typescript/bin/tsc --noEmit
& 'C:/Program Files/nodejs/node.exe' ./node_modules/eslint/bin/eslint.js app/ui/agent-command-center.tsx
```

On another machine, install Playwright and its supported browser and change the runtime/module/browser settings appropriately. Keep `CAREER_TEST_BASE_URL` on `http://127.0.0.1` or `http://localhost`. The test refuses other hosts and a real account identity. It requires exclusive use of the synthetic account while running.

## Remaining release limits

There were no live AI calls, real employer submissions, email/WhatsApp sends, production identity/session tests, two-account browser tests, scheduler deployment tests, or load measurements in this suite. The global pause, snapshot-bound approval, input validation, ownership isolation, scheduler leases, and race controls also need their independent server tests; button disabling is not their security boundary.

Use [`agentic-data.md`](agentic-data.md) for owned data, migrations, revision checks, leases, package history, and retention limits; [`agentic-workflows.md`](agentic-workflows.md) for bounded orchestration, source access, scheduling, and adapter status; and [`agentic-handover.md`](agentic-handover.md) for the consolidated release status. Existing [`ai-update.md`](ai-update.md), [`integrations-update.md`](integrations-update.md), and [`update-handover.md`](update-handover.md) describe the wider platform and external setup. Payments, administrator access, public sharing, and sensitive account deletion stay gated where the required trusted platform capabilities are absent. This update is not a broad public-launch recommendation or an ASVS certification.
