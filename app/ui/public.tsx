import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  FileText,
  BriefcaseBusiness,
  Sparkles,
  MessagesSquare,
  ShieldCheck,
  MapPin,
  ChevronRight,
  Compass,
  Bell,
  LayoutDashboard,
  Target,
  Bookmark,
} from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="DnyanGanga Career Hub home">
      <span className="brand-art">
        <img
          src="/dnyanganga-logo.png?v=3"
          alt="DnyanGanga Career Hub"
          width="1536"
          height="864"
          decoding="async"
        />
      </span>
      <span className="brand-tagline">
        Your AI-Powered Career Growth Platform
      </span>
    </a>
  );
}
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="/features">The platform</a>
        <a href="/how-it-works">How it works</a>
        <a href="/pricing">Plans</a>
        <a href="/faq">FAQs</a>
      </nav>
      <div className="header-actions">
        <a
          className="signin"
          href="/login"
          target="_top"
        >
          Sign in
        </a>
        <a className="btn primary small" href="/sign-up">
          Sign up <ArrowUpRight size={16} />
        </a>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <Brand />
      <p>Your AI-Powered Career Growth Platform</p>
      <nav>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/security">Security</a>
        <a href="/admin/login">Admin sign in</a>
      </nav>
      <span>
        © {new Date().getFullYear()} DnyanGanga Career Hub · Private review
        build
      </span>
    </footer>
  );
}
export function MiniPreview() {
  return (
    <a
      className="product-preview"
      href="/demo"
      aria-label="Explore the interactive demo"
    >
      <div className="preview-bar">
        <div className="preview-dots">
          <i />
          <i />
          <i />
        </div>
        <span>DnyanGanga / workspace</span>
        <span className="pill green">Demo preview</span>
      </div>
      <div className="preview-body">
        <aside>
          <span className="preview-mark">DG</span>
          {[
            LayoutDashboard,
            FileText,
            BriefcaseBusiness,
            MessagesSquare,
            Bell,
          ].map((Icon, i) => (
            <div className={i === 0 ? "selected" : ""} key={i}>
              <Icon size={17} />
            </div>
          ))}
        </aside>
        <div className="preview-content">
          <div className="preview-eyebrow">YOUR CAREER WORKSPACE</div>
          <h3>
            Good morning, Aarav <span>☀</span>
          </h3>
          <p>Let's turn your experience into your next opportunity.</p>
          <div className="preview-stats">
            <div>
              <span>Suitable matches</span>
              <b>
                6 <small>demo</small>
              </b>
            </div>
            <div>
              <span>Applications</span>
              <b>
                4 <small>demo</small>
              </b>
            </div>
            <div>
              <span>Next step</span>
              <b className="small-text">Polish your resume</b>
            </div>
          </div>
          <div className="preview-grid">
            <div className="preview-job">
              <div className="company-icon teal">N</div>
              <span className="pill green">Strong skill overlap</span>
              <h4>Product Design Engineer</h4>
              <p>Northstar Mobility · Fictional company</p>
              <div className="tiny-tags">
                <span>Pune</span>
                <span>Hybrid</span>
              </div>
              <hr />
              <span className="preview-reason">
                <Check size={13} /> CAD & product development
              </span>
            </div>
            <div className="preview-resume">
              <span className="resume-mini-label">
                <FileText size={15} /> YOUR ACTIVE RESUME
              </span>
              <div className="paper-mini">
                <b>AARAV MEHTA</b>
                <span>Product Design Engineer</span>
                <i />
                <i />
                <strong>EXPERIENCE</strong>
                <i />
                <i />
                <i />
                <strong>SKILLS</strong>
                <i />
              </div>
              <span className="preview-save">
                <CheckCheck size={12} /> Ready for your next move
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
const features = [
  {
    icon: FileText,
    title: "Your story, presented clearly",
    text: "Build, edit and compare your resumes in one place. Keep the right version ready for each opportunity.",
    tag: "RESUME STUDIO",
  },
  {
    icon: BriefcaseBusiness,
    title: "A search with direction",
    text: "Start with your roles, skills and preferred locations. Understand why an imported job is relevant to you.",
    tag: "JOB MATCHES",
  },
  {
    icon: MessagesSquare,
    title: "Preparation with purpose",
    text: "Practice role-specific questions, structure your answers and make your next interview a little less daunting.",
    tag: "INTERVIEW PRACTICE",
  },
];
export function Landing() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> A CLEARER PATH FORWARD
            </div>
            <h1>
              Your next chapter.
              <br />
              <em>With more direction.</em>
            </h1>
            <p className="hero-sub">
              Bring your profile, resumes and job search together in one
              thoughtful career workspace. Move forward with clarity, one step
              at a time.
            </p>
            <div className="hero-actions">
              <a className="btn primary" href="/sign-up">
                Start your career workspace <ArrowRight size={18} />
              </a>
              <a className="btn ghost" href="/demo">
                Explore the demo <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Check size={14} /> Private profile by default
              </span>
              <span>
                <Check size={14} /> Your applications, your control
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-caption">
              <Sparkles size={15} /> A little clarity. A lot of possibility.
            </div>
            <MiniPreview />
            <div className="floating-note">
              <span className="note-icon">
                <Target size={21} />
              </span>
              <div>
                <strong>A next step you can act on</strong>
                <span>Tailor your resume to your target role</span>
              </div>
              <Check size={17} />
            </div>
          </div>
        </section>
        <section className="audience-strip">
          <span>FOR EVERY CHAPTER OF YOUR CAREER</span>
          <div>
            Students & freshers
            <i />
            Experienced professionals
            <i />
            Career changers
            <i />
            Senior leaders
          </div>
        </section>
        <section className="section features">
          <div className="section-title">
            <div>
              <div className="eyebrow">LESS SCATTERED. MORE FOCUSED.</div>
              <h2>
                Everything you need.
                <br />
                One place to move forward.
              </h2>
            </div>
            <a className="text-link" href="/features">
              Explore the platform <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text, tag }) => (
              <article className="feature-card" key={tag}>
                <span className="feature-icon">
                  <Icon size={25} />
                </span>
                <small>{tag}</small>
                <h3>{title}</h3>
                <p>{text}</p>
                <a href="/demo">
                  Take a closer look <ArrowRight size={16} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className="journey-section">
          <div className="journey-intro">
            <div className="eyebrow">YOUR JOURNEY, MADE SIMPLE</div>
            <h2>
              Big ambitions.
              <br />
              Practical next steps.
            </h2>
            <p>Start with where you are. Build toward where you want to be.</p>
            <a className="btn white" href="/how-it-works">
              See how it works <ArrowRight size={17} />
            </a>
          </div>
          <ol className="journey-steps">
            {[
              [
                "01",
                "Build your foundation",
                "Confirm your profile, resume and career goals.",
              ],
              [
                "02",
                "Find your direction",
                "Review imported opportunities and understand the skill gaps.",
              ],
              [
                "03",
                "Make your next move",
                "Prepare your application, practice and track your progress.",
              ],
            ].map(([n, t, p]) => (
              <li key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
                <ArrowUpRight size={19} />
              </li>
            ))}
          </ol>
        </section>
        <section className="section trust-section">
          <ShieldCheck size={32} />
          <h2>
            Your career is personal.
            <br />
            Your workspace should respect that.
          </h2>
          <p>
            Your profile starts private. Sensitive services require verified
            setup before they can operate. No hidden applications. No invented
            achievements.
          </p>
          <a href="/security" className="text-link">
            Read our security approach <ArrowRight size={16} />
          </a>
        </section>
        <section className="cta-section">
          <div>
            <div className="eyebrow">A GOOD PLACE TO BEGIN</div>
            <h2>Give your next chapter a little clarity.</h2>
            <p>
              Explore the working demo, then create your own private workspace.
            </p>
          </div>
          <a className="btn primary" href="/sign-up">
            Let's get started <ArrowUpRight size={19} />
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
export const publicPages: Record<
  string,
  {
    label: string;
    title: string;
    intro: string;
    sections: { title: string; text: string }[];
  }
> = {
  login: {label:"YOUR PRIVATE WORKSPACE",title:"Welcome back.",intro:"Sign in to your candidate account to open your private career workspace.",sections:[{title:"Administrator sign in",text:"Candidate sign-in is separate from administrator access. Available account providers show their current setup status."}]},
  "sign-up": {label:"GET STARTED",title:"Your next career chapter starts here.",intro:"Create your private account with a verified email or an available sign-in provider, then confirm your profile and save your first resume.",sections:[{title:"An account you control",text:"Your profile, resumes and conversations stay private. The demonstration is separate from account records, and provider connections show their actual setup status."}]},
  features: {
    label: "THE PLATFORM",
    title: "A workspace that follows your ambition.",
    intro:
      "Build a professional foundation, keep your search organized and prepare for the conversations that matter.",
    sections: [
      {
        title: "AI Agent Command Center",
        text: "Coordinate saved searches, matching, document drafts and application reviews through a central career orchestrator and 21 specialist agents. Choose Assist, Approval or Agentic mode, inspect real activity, and pause all agents or individual workflows. Approval is the default. Unsupported application sites remain a manual handoff.",
      },
      {
        title: "Profile & career goals",
        text: "Keep confirmed experience, education, skills and career preferences together. Select multiple cities and decide which location and work arrangement preferences are mandatory.",
      },
      {
        title: "Resume Studio",
        text: "Keep your original PDF or DOCX separate from reviewed text and later revisions. Uploads require a configured private scanning and isolated extraction service. Use the working text editor, preview, version history and default-version control now.",
      },
      {
        title: "Job matching & applications",
        text: "Import a job description you are permitted to use. Mandatory filters apply before skill overlap ranking. Save opportunities and explicitly confirm when you have applied.",
      },
      {
        title: "Preparation & planning",
        text: "Practice structured questions and create career-plan tasks. Save practice sessions and use evidence-based resume and career suggestions. External AI requires an approved model and usage budget; when it is unavailable, the assistant clearly labels its structured self-review. Market research needs dated, attributable sources.",
      },
      {
        title: "Daily alerts",
        text: "Set a time zone, dispatch time and separate channel consent. Choose separate email and WhatsApp consent, a daily time and a digest limit. Verify destinations before enabling delivery. The queue records acceptance and delivery separately; scheduled operation requires provider and worker setup.",
      },
    ],
  },
  "ai-career-agents": {
    label: "AI CAREER AGENTS", title: "A coordinated search. Decisions you can inspect.",
    intro: "A central orchestrator plans and verifies the work of 21 specialists. Their status comes from recorded tasks, rather than simulated activity.",
    sections: [
      {title:"Start with your rules",text:"Separate searches can use different confirmed resume versions and target roles. Mandatory locations and work arrangements always apply before ranking. Approval mode is the default."},
      {title:"Review before a consequential action",text:"Application packages show the destination, documents, screening answers and personal information. Missing facts require your input. Material changes invalidate prior approval. Automatic submission remains unavailable without an officially supported connection."},
      {title:"Stop the workflow immediately",text:"Pause all agents or separately stop discovery, document generation, notifications, applications and employer communications. Permissions are rechecked on the server before external work."},
    ],
  },
  "resume-tools": {
    label:"RESUME STUDIO",title:"Keep your master. Prepare the right version.",intro:"Edit your story using facts you have confirmed, then compare a separate role-specific version with the original.",
    sections:[
      {title:"Versions with context",text:"Save a name, target role, linked job, date and parent version. Choose your default resume explicitly. Archive older versions while preserving private application history."},
      {title:"Review factual claims",text:"Local consistency checks highlight dates, numerical claims and repeated entries for review. Indicators are limited checks, not proof of an error. AI proposals stay separate from confirmed candidate information."},
      {title:"Readable documents",text:"Choose a simple template, section order and visibility. Export PDF, DOCX or plain text. PDF templates currently support Latin scripts; DOCX and text retain other scripts. Uploaded original files require the separate private scanning and extraction connection."},
    ],
  },
  "job-discovery": {
    label:"JOB DISCOVERY",title:"Search with evidence and clear boundaries.",intro:"Use authorized employer feeds or import a job description you are permitted to use. Connections show their actual setup status.",
    sections:[
      {title:"Independent campaigns",text:"Choose a role, locations, resume, experience range and daily, weekly or manual frequency for each saved search. Pause or archive a campaign without deleting its history."},
      {title:"Understand profile fit",text:"Review why a role matches, possible gaps and unknown information. The nine-factor estimate describes supported profile fit. Opportunity priority separately explains limited urgency and source freshness; neither predicts hiring."},
      {title:"Respect the original source",text:"Keep the employer link, source and retrieval time. Exact destinations are deduplicated and closed listings excluded. LinkedIn, Indeed and Naukri require confirmed permitted access; this build does not scrape or bypass their restrictions."},
    ],
  },
  "interview-preparation": {
    label:"INTERVIEW PREPARATION",title:"Practice with the role in front of you.",intro:"Bring a saved job and your confirmed resume into private interview preparation.",
    sections:[
      {title:"Questions with context",text:"Practice technical, behavioural, managerial and HR questions. Review your saved text answers and feedback. Self-review checklists are clearly distinguished from configured external AI."},
      {title:"A personal interview calendar",text:"Record the company, role, time zone, meeting link and resume used. These are candidate-entered records. External email and calendar access are not connected."},
      {title:"You control recording",text:"Voice recording and live interview assistance remain unavailable pending their permission, retention and provider setup. Practice does not infer personality, honesty or employability."},
    ],
  },
  "career-coaching": {
    label:"CAREER COACH",title:"Turn a career direction into practical actions.",intro:"Connect goals, actual job requirements and learning tasks in a private workspace.",
    sections:[
      {title:"A plan grounded in your profile",text:"Compare directions using confirmed experience and skills. Keep AI-extracted, inferred and unknown information visible in the Candidate Knowledge Vault until you confirm it."},
      {title:"Learn from real requirements",text:"Review missing skills across your saved listings and turn a gap into a task with a date, resource and supporting jobs. Completing a task does not automatically claim you gained a qualification."},
      {title:"Follow up thoughtfully",text:"Keep recruiter contacts, interaction notes and next actions. Prepare an unsent draft using known facts. No employer message is sent without supported access and the required authorization."},
    ],
  },
  about: {label:"ABOUT DNYANGANGA",title:"Your career, with more direction.",intro:"DnyanGanga Career Hub brings your profile, documents, searches and next actions into one workspace.",sections:[{title:"A practical career workspace",text:"Designed for students, early-career professionals, experienced specialists, career changers and senior professionals. The public demonstration uses labelled fictional examples; private accounts calculate counts from their own records."},{title:"Transparent by design",text:"The current private review build shows what works, which services are configured, and what needs external access. It makes no claims of hiring outcomes, security certification or customer totals."}]},
  "how-it-works": {
    label: "HOW IT WORKS",
    title: "Turn your ambition into a workable plan.",
    intro:
      "A clear journey from your professional story to your next application.",
    sections: [
      {
        title: "1. Sign in and complete your profile",
        text: "Create a candidate account using an available sign-in method. Review your details and choose your target roles, skills and preferred cities.",
      },
      {
        title: "2. Create and confirm your resume",
        text: "Start with the text editor and save a version. If secure document processing is configured, upload a PDF or DOCX and review the extracted details. Otherwise, use manual entry and the text editor.",
      },
      {
        title: "3. Review relevant opportunities",
        text: "Import an actual job description or explore fictional examples in the demo. Check the source, requirements, missing skills and any mandatory exclusions.",
      },
      {
        title: "4. Prepare, apply and keep track",
        text: "Select your active resume, practice your answers and move applications through Saved, Preparing, Applied, Interview and later outcomes. You confirm every application.",
      },
    ],
  },
  pricing: {
    label: "PLANS",
    title: "Thoughtful features. Transparent limits.",
    intro:
      "Billing is not enabled in this private review build. No payment details are requested and no paid access is granted.",
    sections: [
      {
        title: "Review workspace",
        text: "Explore the demo and review the private profile, resume editor, manual job imports, applications and task tools.",
      },
      {
        title: "Future plans",
        text: "Free and paid allowances will be configured after actual AI, storage, processing and messaging costs are measured. Prices have not been set.",
      },
      {
        title: "Payment protection",
        text: "Future billing requires an official hosted checkout, server-owned orders, signed callbacks, independent server payment verification and durable idempotency. Redirects and browser messages cannot unlock access.",
      },
    ],
  },
  faq: {
    label: "FREQUENTLY ASKED QUESTIONS",
    title: "A few things you might be wondering.",
    intro: "Straight answers about what works today and what needs setup.",
    sections: [
      {
        title: "Are the demo jobs real?",
        text: "No. The demo uses clearly marked fictional companies and example opportunities. Your account supports manual imports. Live feeds require approved source access.",
      },
      {
        title: "Does a match score guarantee an interview?",
        text: "No. The explained fit estimate weighs evidence from your selected resume, skills, role and experience. Mandatory preferences apply first. It cannot predict selection or every ATS system.",
      },
      {
        title: "Will this automatically apply for jobs?",
        text: "No. Application submissions stay under your control. Opening a job link does not change its application status.",
      },
      {
        title: "Can I upload a private resume?",
        text: "Resumes are private. PDF and DOCX processing works only with configured private storage, malware scanning and isolated extraction. Until that setup is complete, use the text editor. The interface shows the actual connection status.",
      },
      {
        title: "Can I receive daily WhatsApp alerts?",
        text: "The settings are ready for consent and schedule preferences, but dispatch remains disabled until your destination is verified, consent is confirmed and the official provider connection and approved template are configured.",
      },
      {
        title: "Is this ready for a broad launch?",
        text: "This is a private working review build. The handover documents record missing integrations, security verification and production release requirements. It is not certified or claimed to be fully secure.",
      },
    ],
  },
  contact: {
    label: "CONTACT & SUPPORT",
    title: "A little help for your next step.",
    intro:
      "Support channels are being configured for the private review build.",
    sections: [
      {
        title: "Product support",
        text: "Contact the Site owner through the existing project conversation. A monitored support address has not yet been configured; this page does not submit or send a message.",
      },
      {
        title: "Security contact",
        text: "Report security concerns privately to the Site owner. A monitored security mailbox and incident alerts must be established before public launch. Do not share passwords or private resume content in a report.",
      },
      {
        title: "Integration enquiries",
        text: "Job providers, document processors and notification services must have approved access and suitable data-processing terms before connection.",
      },
    ],
  },
  privacy: {
    label: "PRIVACY",
    title: "Your professional story belongs to you.",
    intro:
      "This is a build-specific privacy summary, not a completed legal policy. Launch-region obligations and provider contracts require review.",
    sections: [
      {
        title: "What the working build stores",
        text: "Your signed-in identity, confirmed profile, preferences, resume versions, job records, applications, private practice sessions and alert settings are stored in the Site database. Agent settings, confirmed and inferred facts, answers, saved searches, workflow history, application snapshots and protected action manifests are also private records. Configured uploads use private document storage. The public demo runs in memory and resets when you leave.",
      },
      {
        title: "Access and sharing",
        text: "Account operations check the current identity and record ownership on the server. Profile sharing and document public links are disabled. Contact information is not published.",
      },
      {
        title: "External processing",
        text: "External AI, document processing, employer feeds, email and WhatsApp operate only when explicitly configured. They receive only the information needed for the requested purpose. Deployment-specific provider disclosures, retention and contracts must be reviewed before sensitive data collection. Payments remain disabled.",
      },
      {
        title: "Your controls",
        text: "Use Settings to export your records. Online account deletion is disabled until recent sign-in can be verified. Proposed backup retention and deletion timelines must be configured and tested before launch; deletion from live tables does not promise immediate deletion from backups.",
      },
    ],
  },
  terms: {
    label: "TERMS",
    title: "Clear expectations for a career workspace.",
    intro:
      "These preliminary product terms need legal review before a commercial public launch.",
    sections: [
      {
        title: "Use responsibly",
        text: "Use your own information and job descriptions you are authorized to use. Review facts in every resume and application. Do not upload or import instructions intended to misuse the service.",
      },
      {
        title: "Career guidance",
        text: "Matching is an explained heuristic, not a guarantee of employment, ATS acceptance or interview selection. Practice tools do not infer personality, honesty or employability.",
      },
      {
        title: "Current scope",
        text: "This private build has no paid plans. Configurable services show their actual connection status. The demonstration is fictional, and self-review is distinguished from external AI.",
      },
    ],
  },
  security: {
    label: "SECURITY",
    title: "Protection built into the foundations.",
    intro:
      "Targeting applicable OWASP ASVS 5.0 Level 2 controls. Coverage is partial and requires further testing; this is not a certification.",
    sections: [
      {
        title: "Server-side boundaries",
        text: "Authenticated ownership is checked for data reads and writes. Mutations require same-origin checks, a custom action header, validated bodies and bounded request sizes. Private responses are not cached.",
      },
      {
        title: "Sensitive features fail closed",
        text: "Private document processing requires a trusted scanner and isolated worker. AI and notification actions require explicit configuration, authorization and usage controls. Sharing, payment access and administrative actions remain unavailable unless their additional security requirements are met.",
      },
      {
        title: "Hosting identity",
        text: "Candidate accounts use a separate sign-in system with verified email, private server-side sessions and ownership checks. Email verification and password recovery require a configured sender; social sign-in requires approved provider credentials. Administrator access retains its separate password and mandatory authenticator check.",
      },
      {
        title: "Ongoing verification",
        text: "The handover includes control mappings, threat analysis, actual test evidence, launch blockers and operational procedures. Independent review, restoration drills and provider end-to-end testing remain necessary.",
      },
    ],
  },
};
export function PublicPage({ slug }: { slug: string }) {
  const data = publicPages[slug];
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="public-content">
        <a className="text-link" href="/">
          ← Back to home
        </a>
        <div className="eyebrow">{data.label}</div>
        <h1>{data.title}</h1>
        <p className="public-intro">{data.intro}</p>
        <div className="content-sections">
          {data.sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </section>
          ))}
        </div>
        {slug==="features"&&<nav className="content-sections" aria-label="Explore career tools">{[["ai-career-agents","AI career agents"],["resume-tools","Resume tools"],["job-discovery","Job discovery"],["interview-preparation","Interview preparation"],["career-coaching","Career coaching"]].map(([path,label])=><a className="text-link" key={path} href={"/"+path}>{label}<ArrowUpRight size={16}/></a>)}</nav>}
        <a href={slug==="login"||slug==="sign-up"?"/login":"/demo"} target={slug==="login"||slug==="sign-up"?"_top":undefined} className="btn primary">
          {slug==="login"||slug==="sign-up"?"Candidate sign in":"Explore the workspace"} <ArrowRight size={17} />
        </a>
      </main>
      <Footer />
    </div>
  );
}
