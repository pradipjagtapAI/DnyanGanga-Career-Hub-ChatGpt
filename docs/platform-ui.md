# Career platform interface update

DnyanGanga Career Hub now presents private planning, learning, recruiter contacts, manual interviews, campaigns, screening-answer review and data-use controls as a consistent light interface. This update retains the existing architecture and does not introduce browser-side credentials, another identity system, or a second database.

## Account page map

Existing view addresses and navigation labels remain usable.

| View address | Page / purpose |
|---|---|
| /dashboard or ?view=overview | Dashboard and Today's Actions from owned records |
| ?view=agents | Command center, 21 registry-backed specialists and one orchestrator |
| ?view=profile | My Profile, optional professional fields, preferences and private preview |
| ?view=goals | Career Goals with create, edit, completion/archive and deletion |
| ?view=vault | Candidate Knowledge Vault, confirmation, field history and reusable answers |
| ?view=resumes | Resume Studio; existing My Resumes navigation remains |
| ?view=searches | Job Searches and campaigns |
| ?view=jobs | Job Matches, fixed fit evidence and separate Opportunity Priority |
| ?view=review | Review Queue for exact application packages |
| ?view=saved | Saved Jobs from actual application records |
| ?view=applications | Application Tracker, including input/ready/failure states |
| ?view=interview | Interview Practice and saved private practice history |
| ?view=calendar | Manually confirmed Interview Calendar |
| ?view=coach | Career Coach; existing AI Career Assistant navigation remains |
| ?view=learning | Skills & Learning and owned learning tasks |
| ?view=recruiters | Recruiter CRM, manual interactions and private unsent drafts |
| ?view=insights | Market Insights with limited dated evidence |
| ?view=privacy | Privacy & Security, recorded data use, export and permission matrix |
| ?view=notifications | Channel settings; existing Alerts navigation remains |
| ?view=settings | Account settings and unavailable sensitive capabilities |

The public home, features, how-it-works, FAQ, contact, pricing, privacy, terms and security pages retain their routes. Public sharing and paid checkout remain unavailable; a visible page is not an enabled integration.

## Implementation

The isolated components are in app/ui/career-platform-tools.tsx. workspace.tsx supplies owned state and existing navigation. career-view-types.ts uses the authoritative platform and Opportunity Priority types. agent-command-center.tsx also serves the direct vault, search and review pages; the registry controls the specialist count.

Components submit same-origin requests with the existing action header, display actual server results, and refresh from the returned workspace state. Platform edits/deletes use explicit candidate confirmation and current revisions. Ownership, revision, quota and permission checks remain enforced by stores and routes. See [platform-data.md](platform-data.md) for database/security evidence.

Private contents remain in component memory. These components do not write resumes, answers, contacts or account state to localStorage, sessionStorage or IndexedDB. Demonstration mode does not persist career records or invent agent outcomes. Forms use visible labels, explicit accessible names, focus styles and reduced-motion support. The extended sidebar scrolls on short screens.

## Candidate controls

- Goals are planning records. Saving them does not silently replace mandatory matching preferences.
- Learning tasks link owned goals/listings. Completing one does not add an unverified skill to the profile. Requirements are labelled as a limited saved-listing comparison.
- Recruiter contacts are supplied manually. Interaction dates derive from recorded interactions. Drafts remain private and unsent; copy requires a user action.
- Interviews link owned contacts, jobs and resume versions. Invitation wall time in the selected IANA zone converts to a UTC instant. Invalid, nonexistent and ambiguous daylight-saving times produce an error. The browser verified the India conversion; every time-zone transition has not been tested.
- Campaigns expose selected resume, active/paused/archived status, daily/weekly/manual frequency and optional mandatory experience range. They preserve global mandatory filters. Scheduler availability is separate from the saved preference.
- Answers show confirmation and freshness deadlines. Expired values remain visible privately but are excluded from usable package choices. Users can choose earlier deadlines within server limits.
- Packages include explicitly selected relevant fresh answers. Required employer questions block approval when unfilled. Employer-specific answer keys are scoped to the owned job; another employer's answer is not offered. Changing the preparation job clears selections. Editing invalidates earlier approval.
- Pause all is visible in the header. Pause/Resume preserves preparation time and category pauses. Unattended work requires the authenticated scheduler.
- Privacy distinguishes provider configuration, recorded attempts, responses, acceptance and confirmed delivery. Token totals can be partial; costs are not fabricated. Export and enabled source-deletion controls appear beside disabled sharing/account deletion and the permission matrix.
- Deleting a current source or planning record can leave copies in private packages, revision/audit records or backups. The interface discloses this limit.
- Deleted historical links are visible and removable before saving an edited learning/contact/interview record or campaign, rather than being silently replaced.

The separately supplied ResumeToolkit is mounted after the document manager with the same light styles. It exposes private review indicators, comparison, section order/visibility, separate formatted versions, archive controls and saved-version exports. A dedicated resume browser suite verified its review, section controls, separate versions, comparison, real downloads and archive flow.

## Actual verification

Observed on 2026-10-12 in the fixed synthetic loopback account with actual local D1:

| Check | Actual result |
|---|---|
| New platform browser suite | 12 passed; zero page/cleanup errors, 2026-10-12T15:44:47.930Z |
| Agent browser regression after screening repair | 16 passed; zero page/cleanup errors, 2026-10-12T15:54:59.190Z |
| Existing upgrade browser regression | 9 passed; zero page errors |
| Dedicated resume studio browser suite | 7 passed; zero page/cleanup errors, 2026-10-12T16:00:27.387Z |
| Full application TypeScript check | Exit 0 after current interface/contract updates |
| Focused lint on new interface modules | Exit 0, no errors or warnings |
| Responsive layout | New screens at 1440, 768 and 390 pixels; no page overflow |

Repeat from the site directory:

~~~powershell
$env:CAREER_PLAYWRIGHT_MODULE = 'C:/Users/jagta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CAREER_BROWSER_CHANNEL = 'msedge'
node tests/platform-browser-smoke.mjs
node tests/agent-browser-smoke.mjs
node tests/upgrade-browser-smoke.mjs
node tests/resume-browser-smoke.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js app/ui/career-platform-tools.tsx app/ui/agent-command-center.tsx app/ui/career-view-types.ts
~~~

The browser tests require the loopback preview, current migrations, fixed development identity and an exclusive synthetic account mutation window. Do not run against production. Machine-readable evidence is in [platform-browser-results.json](platform-browser-results.json), [agent-browser-results.json](agent-browser-results.json) and [upgrade-browser-results.json](upgrade-browser-results.json) and [resume-browser-results.json](resume-browser-results.json). Screenshots are in outputs/platform-desktop.png, outputs/platform-mobile.png and the existing agent screenshot files. Resume screenshots are outputs/resume-toolkit-desktop.png and outputs/resume-toolkit-mobile.png; its synthetic PDF/DOCX exports are in outputs/resume-toolkit-synthetic.pdf and outputs/resume-toolkit-synthetic.docx.

The new suite verifies confirmed CRUD, owned links, profile-skill isolation, UTC conversion, campaign persistence, answer freshness, provider/permission presentation, kill switch, dashboard counts and cleanup. The agent suite verifies required unknowns, explicit selected job-scoped answers, exact snapshot approval/download and invalidation. Its activity check compares new event IDs because the returned history window is bounded.

Testing found and repaired a required-answer auto-fill gap: a fresh library answer could satisfy a required question without selection. Required slots now remain UNKNOWN until explicitly selected, and the default question is job-scoped. Backend regressions and the final agent browser run cover the repair. Earlier test-only failures from old selectors, response assumptions and bounded-history assertions were corrected. A temporary local D1 cleanup lock was recovered from private before-history; cleanup now stops polling, retries temporary locks and retains a private restore snapshot until verification succeeds.

Created test goals, tasks, contacts/interactions, interviews, campaigns, jobs, resumes and answers were removed; profile/preferences/settings were preserved or restored. Labelled immutable synthetic private history can remain locally. Tests made no live AI call, employer submission, external calendar action, recruiter send or live notification.

## Remaining verification

See [ai-update.md](ai-update.md), [integrations-update.md](integrations-update.md), [platform-data.md](platform-data.md) and the root handover for provider setup, migrations and deployment. This UI evidence does not establish production two-account session isolation, D1 network concurrency, scanner deployment, live delivery, backup restoration, legal compliance, certification or broad-load performance. Full-repository lint, dependency findings and final build/deployment are reported separately.

Recommended rollout remains a private pilot with supported integrations deliberately enabled, independent security review, defined retention, restore exercises and measured response/scheduler capacity. Payments, employer submission, automated communications, public sharing, administrator access and account deletion retain their fail-closed prerequisites.
