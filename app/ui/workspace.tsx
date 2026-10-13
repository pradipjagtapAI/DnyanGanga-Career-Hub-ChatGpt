"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  UserRound,
  FileText,
  BriefcaseBusiness,
  Kanban,
  MessagesSquare,
  Sparkles,
  ChartNoAxesCombined,
  Bell,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  MapPin,
  Clock,
  Bookmark,
  Upload,
  Download,
  Target,
  ShieldCheck,
  Menu,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  RotateCcw,
  Copy,
  Send,
  AlertCircle,
  LogOut,
  CalendarDays,
  Filter,
  Compass,
  LockKeyhole,
  BookOpenCheck,
  ContactRound,
  FileCheck2,
} from "lucide-react";
import { Brand } from "./public";
import { AgentCommandCenter } from "./agent-command-center";
import { CareerGoals, SkillsLearning, RecruiterCRM, InterviewCalendar, PrivacySecurity, TodayActions } from "./career-platform-tools";
import { ResumeToolkit } from "./resume-toolkit";
import {
  SourceConnection,
  MatchExplanation,
  AlertSettings,
  DocumentManager,
  AssistantTools,
  UpcomingInterviews,
} from "./career-tools";
const navigation = [
  ["overview", "Dashboard", LayoutDashboard],
  ["agents", "AI Agent Command Center", Compass],
  ["profile", "My Profile", UserRound],
  ["goals", "Career Goals", Target],
  ["vault", "Candidate Knowledge Vault", ShieldCheck],
  ["resumes", "My Resumes", FileText],
  ["searches", "Job Searches", Search],
  ["jobs", "Job Matches", BriefcaseBusiness],
  ["review", "Review Queue", FileCheck2],
  ["saved", "Saved Jobs", Bookmark],
  ["applications", "Application Tracker", Kanban],
  ["interview", "Interview Practice", MessagesSquare],
  ["calendar", "Interview Calendar", CalendarDays],
  ["coach", "AI Career Assistant", Sparkles],
  ["learning", "Skills & Learning", BookOpenCheck],
  ["recruiters", "Recruiter CRM", ContactRound],
  ["privacy", "Privacy & Security", LockKeyhole],
  ["insights", "Market Insights", ChartNoAxesCombined],
  ["notifications", "Alerts", Bell],
  ["settings", "Settings", Settings],
] as const;
const statuses = [
  "Needs Input",
  "Ready",
  "Failed",
  "Saved",
  "Preparing",
  "Needs Review",
  "Needs Your Input",
  "Submission Unconfirmed",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Closed",
];
const emptyProfile = {
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  whatsapp: "",
  currentCity: "",
  state: "",
  country: "India",
  summary: "",
  workHistory: "",
  education: "",
  projects: "",
  certifications: "",
  skills: [],
  portfolio: "",
  currentRole: "",
  totalExperience: 0,
  relevantExperience: 0,
};
const emptyPreferences = {
  targetRoles: [],
  industries: [],
  preferredCities: [],
  relocate: false,
  workArrangements: [],
  employmentTypes: [],
  salaryAmount: null,
  expectedSalaryMin: null,
  expectedSalaryMax: null,
  mandatorySalary: false,
  salaryCurrency: "INR",
  salaryBasis: "annual",
  noticePeriod: "",
  excludeCompanies: [],
  excludeRoles: [],
  excludeLocations: [],
  mandatoryLocation: true,
  mandatoryWorkArrangement: true,
  mandatoryEmploymentType: false,
};
const initialState = {
  profile: emptyProfile,
  preferences: emptyPreferences,
  resumes: [],
  jobs: [],
  applications: [],
  tasks: [],
  notifications: {
    emailEnabled: false,
    whatsappEnabled: false,
    emailConsent: false,
    whatsappConsent: false,
    timeZone: "Asia/Kolkata",
    dispatchTime: "08:00",
    paused: true,
    emailVerified: false,
    whatsappVerified: false,
    nextAlert: null,
  },
  integrations: {},
  revision: 0,
  draft: null,
};
const demoResume =
  "AARAV MEHTA\nProduct Design Engineer\n\nSUMMARY\nProduct design engineer with 5 years of experience in mechanical design, CAD and product development.\n\nEXPERIENCE\nDesign Engineer · Example Engineering (fictional)\n2021 – Present\n• Developed CAD assemblies and engineering drawings.\n• Collaborated with manufacturing teams on design reviews.\n• Documented design decisions and validation findings.\n\nEDUCATION\nB.Tech, Mechanical Engineering · Example Institute (fictional)\n\nSKILLS\nCATIA · SolidWorks · GD&T · Product development · Design reviews";
function makeDemo() {
  return {
    ...initialState,
    profile: {
      ...emptyProfile,
      fullName: "Aarav Mehta",
      headline: "Product Design Engineer",
      email: "aarav@example.test",
      currentCity: "Pune",
      state: "Maharashtra",
      summary:
        "Mechanical design engineer interested in purposeful product development.",
      skills: [
        "CATIA",
        "SolidWorks",
        "GD&T",
        "Product development",
        "Design reviews",
      ],
      currentRole: "Design Engineer",
      totalExperience: 5,
      relevantExperience: 5,
      workHistory: "Design Engineer · Example Engineering (fictional)",
      education:
        "B.Tech, Mechanical Engineering · Example Institute (fictional)",
    },
    preferences: {
      ...emptyPreferences,
      targetRoles: ["Product Design Engineer", "Mechanical Design Engineer"],
      preferredCities: ["Pune", "Bengaluru"],
      workArrangements: ["Hybrid", "Remote"],
      employmentTypes: ["Full-time"],
    },
    resumes: [
      {
        id: "r1",
        version: 2,
        title: "Product Design · Primary",
        targetRole: "Product Design Engineer",
        text: demoResume,
        source: "manual",
        createdAt: "2026-10-10T11:00:00Z",
        active: true,
        profileRevision: 1,
      },
      {
        id: "r0",
        version: 1,
        title: "First draft",
        targetRole: "Mechanical Design Engineer",
        text: demoResume.replace("product development", "manufacturing"),
        source: "manual",
        createdAt: "2026-10-08T11:00:00Z",
        active: false,
        profileRevision: 1,
      },
    ],
    jobs: [
      [
        "j1",
        "Product Design Engineer",
        "Northstar Mobility",
        "Pune",
        "Hybrid",
        ["CATIA", "GD&T", "Product development", "Design reviews", "DFMEA"],
        "teal",
      ],
      [
        "j2",
        "Mechanical Design Engineer",
        "Forma Engineering",
        "Bengaluru",
        "Hybrid",
        ["SolidWorks", "GD&T", "Design reviews", "Simulation"],
        "purple",
      ],
      [
        "j3",
        "Senior CAD Engineer",
        "Arc Product Labs",
        "Pune",
        "Remote",
        [
          "CATIA",
          "SolidWorks",
          "GD&T",
          "Product development",
          "Design reviews",
          "Team leadership",
        ],
        "orange",
      ],
      [
        "j4",
        "Design Development Engineer",
        "Vista Manufacturing",
        "Pune",
        "Hybrid",
        ["CATIA", "GD&T", "Design reviews", "Manufacturing"],
        "blue",
      ],
      [
        "j5",
        "Mechanical Product Engineer",
        "Lumen Works",
        "Bengaluru",
        "Hybrid",
        ["SolidWorks", "Product development", "Testing"],
        "teal",
      ],
      [
        "j6",
        "Engineering Designer",
        "Orbit Industries",
        "Pune",
        "Remote",
        ["CATIA", "GD&T", "Product development"],
        "purple",
      ],
    ].map(
      ([
        id,
        title,
        company,
        location,
        workArrangement,
        requirements,
        color,
      ]) => ({
        id,
        title,
        company,
        location,
        workArrangement,
        requirements,
        color,
        minExperience: 3,
        maxExperience: 7,
        employmentType: "Full-time",
        source: "demonstration",
        description:
          "Fictional opportunity for exploring the product. No application destination exists.",
        url: null,
        lastCheckedAt: null,
      }),
    ),
    applications: [
      {
        id: "a1",
        jobId: "j1",
        status: "Saved",
        notes: "Review requirements",
        createdAt: "2026-10-09T10:00:00Z",
      },
      {
        id: "a2",
        jobId: "j2",
        status: "Preparing",
        notes: "Tailor the summary",
        createdAt: "2026-10-09T10:00:00Z",
      },
      {
        id: "a3",
        jobId: "j3",
        status: "Applied",
        notes: "Fictional confirmed application",
        createdAt: "2026-10-08T10:00:00Z",
      },
      {
        id: "a4",
        jobId: "j4",
        status: "Interview",
        notes: "Prepare a design review example",
        createdAt: "2026-10-08T10:00:00Z",
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Add one design-review example to your resume",
        completed: false,
      },
      {
        id: "t2",
        title: "Practice a concise interview introduction",
        completed: false,
      },
      {
        id: "t3",
        title: "Confirm preferred roles and locations",
        completed: true,
      },
    ],
    revision: 1,
  };
}
function skillInfo(job: any, profile: any) {
  if (Array.isArray(job.matchedSkills))
    return {
      matched: job.matchedSkills,
      missing: job.missingSkills || [],
      score:
        job.relevance?.score ??
        (job.requirements?.length
          ? Math.round(
              (job.matchedSkills.length / job.requirements.length) * 100,
            )
          : 0),
    };
  const known = (profile.skills || []).map((s: string) => s.toLowerCase());
  const matched = (job.requirements || []).filter((s: string) =>
    known.includes(s.toLowerCase()),
  );
  const missing = (job.requirements || []).filter(
    (s: string) => !known.includes(s.toLowerCase()),
  );
  return {
    matched,
    missing,
    score: job.requirements?.length
      ? Math.round((matched.length / job.requirements.length) * 100)
      : 0,
  };
}
function downloadText(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function dateLabel(s: string) {
  return new Date(s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
function Pill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
function Empty({
  icon: Icon = Compass,
  title,
  text,
  action,
}: {
  icon?: any;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export default function CareerWorkspace({
  demo = false,
  displayName = "",
}: {
  demo?: boolean;
  displayName?: string;
}) {
  const [state, setState] = useState<any>(() =>
      demo ? makeDemo() : initialState,
    ),
    [view, setView] = useState("overview"),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<any>(null),
    [search, setSearch] = useState(""),
    [appList, setAppList] = useState(false),
    [resumeText, setResumeText] = useState(""),
    [resumeTitle, setResumeTitle] = useState("My professional resume"),
    [resumeTarget, setResumeTarget] = useState(""),
    [editing, setEditing] = useState(false),
    [savedStatus, setSavedStatus] = useState(""),
    [profileTab, setProfileTab] = useState("Details");
  const draftRevision = useRef(0),
    draftPromise = useRef<Promise<void>>(Promise.resolve());
  const firstName = (state.profile.fullName || displayName || "there").split(
      /[ @]/,
    )[0],
    active = state.resumes.find((r: any) => r.active);
  const eligible = state.jobs
    .filter((j: any) => {
      if (!demo) return !j.relevance?.excludedReasons?.length;
      const p = state.preferences,
        cities = p.preferredCities.length
          ? p.preferredCities
          : [state.profile.currentCity].filter(Boolean);
      return !(
        (p.mandatoryLocation &&
          cities.length &&
          !cities.includes(j.location)) ||
        (p.mandatoryWorkArrangement &&
          p.workArrangements.length &&
          !p.workArrangements.includes(j.workArrangement)) ||
        (p.mandatoryEmploymentType &&
          p.employmentTypes.length &&
          !p.employmentTypes.includes(j.employmentType)) ||
        p.excludeCompanies.some((x: string) =>
          j.company.toLowerCase().includes(x.toLowerCase()),
        ) ||
        p.excludeRoles.some((x: string) =>
          j.title.toLowerCase().includes(x.toLowerCase()),
        ) ||
        p.excludeLocations.some((x: string) =>
          j.location.toLowerCase().includes(x.toLowerCase()),
        )
      );
    })
    .sort((a: any, b: any) =>
      demo
        ? skillInfo(b, state.profile).score - skillInfo(a, state.profile).score
        : (b.relevance?.score || 0) - (a.relevance?.score || 0),
    );
  const shownJobs = eligible.filter((j: any) =>
    `${j.title} ${j.company} ${j.location}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function load() {
    try {
      const r = await fetch("/api/career/state", { cache: "no-store" });
      const d: any = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Your workspace could not be loaded.");
      setState(d);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    function update() {
      const v = new URLSearchParams(location.search).get("view") || "overview";
      setView(navigation.some((n) => n[0] === v) ? v : "overview");
    }
    update();
    window.addEventListener("popstate", update);
    if (!demo) load();
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(async () => {
      if (demo) {
        setState((s: any) => ({
          ...s,
          draft: {
            text: resumeText,
            title: resumeTitle,
            targetRole: resumeTarget,
          },
        }));
        setSavedStatus("Draft saved for this visit");
        return;
      }
      draftPromise.current = draftPromise.current.then(async () => {
        try {
          const r = await fetch("/api/career/draft", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Career-Action": "1",
            },
            body: JSON.stringify({
              text: resumeText,
              title: resumeTitle,
              targetRole: resumeTarget,
              expectedRevision: draftRevision.current,
            }),
          });
          const data: any = await r.json();
          if (!r.ok) throw new Error();
          draftRevision.current =
            data.state?.draftRevision ?? draftRevision.current + 1;
          setSavedStatus("Draft saved securely");
        } catch {
          setSavedStatus("Autosave failed — keep this tab open");
        }
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [resumeText, resumeTitle, resumeTarget, editing]);
  function go(v: string) {
    setView(v);
    setMenu(false);
    setSearch("");
    history.pushState(
      null,
      "",
      `${demo ? "/demo" : "/dashboard"}${v === "overview" ? "" : "?view=" + v}`,
    );
  }
  async function mutate(endpoint: string, method: string, body: any = {}) {
    setBusy(true);
    try {
      if (demo) {
        setState((s: any) => {
          const n = structuredClone(s),
            id = crypto.randomUUID();
          if (endpoint === "profile") {
            n.profile = { ...body.profile, email: n.profile.email };
            n.preferences = body.preferences;
            n.revision++;
          } else if (endpoint === "resumes") {
            n.resumes.unshift({
              ...body,
              id,
              version: Math.max(0, ...n.resumes.map((r: any) => r.version)) + 1,
              active: false,
              createdAt: new Date().toISOString(),
              profileRevision: n.revision,
            });
            n.draft = null;
          } else if (endpoint.startsWith("resumes/")) {
            const rid = endpoint.split("/")[1],
              r = n.resumes.find((x: any) => x.id === rid);
            if (method === "DELETE") {
              if (r?.active && !body.confirmActive)
                throw new Error("Confirm deletion of the active resume first.");
              n.resumes = n.resumes.filter((x: any) => x.id !== rid);
            } else if (endpoint.endsWith("/active"))
              n.resumes = n.resumes.map((x: any) => ({
                ...x,
                active: x.id === rid,
              }));
            else if (r)
              n.resumes.unshift({
                ...r,
                id,
                version:
                  Math.max(0, ...n.resumes.map((x: any) => x.version)) + 1,
                active: false,
                createdAt: new Date().toISOString(),
                source: "restored",
              });
          } else if (endpoint === "jobs")
            n.jobs.unshift({ ...body, id, source: "demonstration" });
          else if (endpoint === "applications") {
            if (!n.applications.some((a: any) => a.jobId === body.jobId))
              n.applications.push({
                ...body,
                id,
                createdAt: new Date().toISOString(),
              });
          } else if (endpoint.startsWith("applications/")) {
            if (body.status === "Applied" && !body.confirmedApplied)
              throw new Error("Confirm submission before marking Applied.");
            Object.assign(
              n.applications.find(
                (a: any) => a.id === endpoint.split("/")[1],
              ) || {},
              body,
            );
          } else if (endpoint === "tasks")
            n.tasks.push({ id, title: body.title, completed: false });
          else if (endpoint.startsWith("tasks/"))
            Object.assign(
              n.tasks.find((t: any) => t.id === endpoint.split("/")[1]) || {},
              body,
            );
          else if (endpoint === "notifications")
            n.notifications = {
              ...n.notifications,
              ...body,
              emailEnabled: false,
              whatsappEnabled: false,
            };
          return n;
        });
      } else {
        const r = await fetch("/api/career/" + endpoint, {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-Career-Action": "1",
            },
            body: JSON.stringify(body),
          }),
          d: any = await r.json();
        if (!r.ok) throw new Error(d.error || "The change could not be saved.");
        await load();
      }
      return true;
    } catch (e: any) {
      setError(e.message);
      setToast(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openEditor(r?: any) {
    draftRevision.current = Math.max(
      draftRevision.current,
      state.draftRevision || 0,
    );
    setResumeText(r?.text || state.draft?.text || "");
    setResumeTitle(r?.title || state.draft?.title || "My professional resume");
    setResumeTarget(
      r?.targetRole ||
        state.draft?.targetRole ||
        state.preferences.targetRoles[0] ||
        "",
    );
    setEditing(true);
    go("resumes");
  }
  async function closeEditor() {
    const draft = {
      text: resumeText,
      title: resumeTitle,
      targetRole: resumeTarget,
    };
    setEditing(false);
    setState((s: any) => ({ ...s, draft }));
    if (demo) return;
    draftPromise.current = draftPromise.current.then(async () => {
      try {
        const r = await fetch("/api/career/draft", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Career-Action": "1",
          },
          body: JSON.stringify({
            ...draft,
            expectedRevision: draftRevision.current,
          }),
        });
        const d: any = await r.json();
        if (!r.ok) throw new Error();
        draftRevision.current = d.state.draftRevision;
        setState((s: any) => ({
          ...s,
          draftRevision: draftRevision.current,
          draft,
        }));
      } catch {
        setToast(
          "Draft save failed. Your latest text remains in this tab; reopen the editor before leaving.",
        );
      }
    });
    await draftPromise.current;
  }
  async function saveResume() {
    if (!resumeText.trim()) {
      setToast("Add resume content first.");
      return;
    }
    setEditing(false);
    await draftPromise.current;
    if (
      await mutate("resumes", "POST", {
        title: resumeTitle,
        targetRole: resumeTarget,
        text: resumeText,
        source: "manual",
      })
    ) {
      setEditing(false);
      setToast("Version saved. Choose it as active when ready.");
    } else setEditing(true);
  }
  async function saveJob(j: any) {
    if (
      await mutate("applications", "POST", {
        jobId: j.id,
        status: "Saved",
        notes: "",
      })
    )
      setToast("Job saved to your application board.");
  }
  const complete = Math.round(
      ([
        "fullName",
        "headline",
        "currentCity",
        "summary",
        "skills",
        "workHistory",
        "education",
      ].filter((k) =>
        Array.isArray(state.profile[k])
          ? state.profile[k].length
          : !!state.profile[k],
      ).length /
        7) *
        100,
    ),
    applied = demo
      ? state.applications.filter((a: any) =>
          ["Applied", "Interview", "Offer", "Rejected"].includes(a.status),
        ).length
      : state.metrics?.applicationsSubmitted || 0,
    interviews = state.applications.filter(
      (a: any) => a.status === "Interview",
    ).length;
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Brand />
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <div className="workspace-selector">
          <span className="selector-avatar">{firstName[0].toUpperCase()}</span>
          <div>
            <b>My career workspace</b>
            <small>{demo ? "Demo workspace" : "Private workspace"}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Workspace">
          {navigation
            .filter(
              (n) => !["notifications", "settings"].includes(n[0]),
            )
            .map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={"nav-item " + (view === v ? "active" : "")}
                aria-current={view === v ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {v === "jobs" && eligible.length > 0 && (
                  <span className="nav-count">{eligible.length}</span>
                )}
                {v === "coach" && <span className="nav-ai" aria-hidden="true">AI</span>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>
              <Sparkles size={16} /> A little progress, every day
            </span>
            <p>Your next chapter starts with one practical step.</p>
            <button onClick={() => go("coach")}>
              View your career plan <ArrowRight size={14} />
            </button>
          </div>
          {navigation
            .filter((n) => ["notifications", "settings"].includes(n[0]))
            .map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => go(v)}
                className={"nav-item " + (view === v ? "active" : "")}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          <div className="sidebar-user">
            <div className="avatar">{firstName[0].toUpperCase()}</div>
            <div>
              <b>{state.profile.fullName || displayName || "Your account"}</b>
              <small>
                {demo ? "Fictional demonstration" : "Private account"}
              </small>
            </div>
            <a
              href={demo ? "/" : "/logout"}
              target="_top"
              aria-label="Exit workspace"
            >
              <LogOut size={17} />
            </a>
          </div>
        </div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-header">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span>My workspace</span>
            <ChevronRight size={14} />
            <b>{navigation.find((n) => n[0] === view)?.[1]}</b>
          </div>
          <div className="workspace-header-right">
            <button className="career-kill-switch" disabled={demo || busy || !state.agentic?.settings || state.agentic?.settings.pausedAll} onClick={async () => { const s=state.agentic.settings; if(await mutate("agents/settings","PUT",{mode:s.mode,pausedAll:true,pausedCategories:s.pausedCategories,expectedRevision:s.revision,maxJobsPerRun:s.maxJobsPerRun,maxPackagesPerRun:s.maxPackagesPerRun,schedule:{enabled:s.schedule.enabled,timeZone:s.schedule.timeZone,runTime:s.schedule.runTime}}))setToast("All AI agents paused. Your records remain available for review."); }}><ShieldCheck size={13}/>{state.agentic?.settings.pausedAll?"AI agents paused":"Pause all AI agents"}</button>
            <span className="private-label">
              <LockKeyhole size={13} /> Private workspace
            </span>
            <button
              className="icon-button"
              onClick={() => go("notifications")}
              aria-label="Notifications"
            >
              <Bell size={19} />
            </button>
            <div className="avatar small-avatar">
              {firstName[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main">
          {!demo && state.agentic?.settings?.pausedAll && <div className="agent-pause-notice" role="status"><ShieldCheck size={18} /><span>All agents are paused. You can still review and update your own records.</span><button className="text-button" onClick={() => go("agents")}>Manage agents <ArrowRight size={14} /></button></div>}
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="status-dot" /> DEMO WORKSPACE{" "}
                <span className="banner-sep">/</span> Fictional profile & jobs.
                Changes last for this visit.
              </span>
              <a href="/dashboard">
                Create your workspace <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              {error}
              <button
                onClick={() => {
                  setError("");
                  load();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <Empty
              title="Loading your workspace"
              text="Getting your private career records ready…"
            />
          ) : (
            <>
              {view === "agents" && <AgentCommandCenter state={state.agentic} onState={setState} demo={demo} />}
              {["vault","searches","review"].includes(view) && <AgentCommandCenter key={view} initialTab={view === "vault" ? "vault" : view === "searches" ? "searches" : "review"} state={state.agentic} onState={setState} demo={demo} />}
              {view === "goals" && <CareerGoals state={state} demo={demo} onState={setState} onNavigate={go} />}
              {view === "learning" && <SkillsLearning state={state} demo={demo} onState={setState} onNavigate={go} />}
              {view === "recruiters" && <RecruiterCRM state={state} demo={demo} onState={setState} onNavigate={go} />}
              {view === "calendar" && <InterviewCalendar state={state} demo={demo} onState={setState} onNavigate={go} />}
              {view === "privacy" && <PrivacySecurity state={state} demo={demo} onState={setState} onNavigate={go} />}
              {view === "overview" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        LET'S MAKE YOUR NEXT MOVE COUNT
                      </div>
                      <h1>
                        Good morning, {firstName}{" "}
                        <span className="sun">☀</span>
                      </h1>
                      <p>
                        Your ambition has a home. Here's where you stand today.
                      </p>
                    </div>
                    <button
                      className="btn outline"
                      onClick={() => go("profile")}
                    >
                      <UserRound size={16} /> View my profile{" "}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <TodayActions state={state} demo={demo} onState={setState} onNavigate={go} />
                  <div className="overview-stats">
                    {[
                      [
                        BriefcaseBusiness,
                        eligible.length,
                        "Suitable job matches",
                        "From your current preferences",
                        "blue",
                      ],
                      [
                        Send,
                        applied,
                        "Applications submitted",
                        demo ? "Fictional demonstration" : "Confirmed by you",
                        "teal",
                      ],
                      [
                        MessagesSquare,
                        interviews,
                        "At interview stage",
                        "Your next conversation in sight",
                        "purple",
                      ],
                      [
                        FileText,
                        state.resumes.length,
                        "Resume versions",
                        active
                          ? "An active version is ready"
                          : "Choose your active resume",
                        "orange",
                      ],
                    ].map(([Icon, value, label, sub, color]: any) => (
                      <div className="stat-card" key={label}>
                        <div className={"stat-icon " + color}>
                          <Icon size={19} />
                        </div>
                        <span className="stat-number">{value}</span>
                        <h3>{label}</h3>
                        <p>{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overview-columns">
                    <div className="overview-primary">
                      <section className="next-move-card">
                        <div>
                          <Pill tone="white">
                            <Sparkles size={12} /> YOUR NEXT BEST STEP
                          </Pill>
                          <h2>
                            {complete < 100
                              ? "A stronger profile opens more doors."
                              : "Good experience deserves a clear story."}
                          </h2>
                          <p>
                            {complete < 100
                              ? "Add your skills and career goals to make your workspace more useful."
                              : "Add a specific example. Show what you did, how you did it and what you learned."}
                          </p>
                          <button
                            className="btn primary"
                            onClick={() =>
                              complete < 100
                                ? go("profile")
                                : openEditor(active)
                            }
                          >
                            {complete < 100
                              ? "Complete my profile"
                              : "Improve my resume"}{" "}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                        <div className="next-move-art">
                          <div className="art-paper">
                            <FileText size={25} />
                            <i />
                            <i />
                            <i />
                            <div>
                              <Check size={12} />
                              <Check size={12} />
                              <Check size={12} />
                            </div>
                          </div>
                          <span className="art-spark">
                            <Sparkles size={24} />
                          </span>
                        </div>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>
                              Opportunities worth a look{" "}
                              <span className="count-label">
                                {eligible.length}
                              </span>
                            </h2>
                            <p>
                              Matched to your skills and where you want to go.
                            </p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => go("jobs")}
                          >
                            View all matches <ArrowRight size={15} />
                          </button>
                        </div>
                        {eligible.length ? (
                          <div className="job-list">
                            {eligible.slice(0, 3).map((j: any) => (
                              <JobCard
                                key={j.id}
                                job={j}
                                profile={state.profile}
                                saved={state.applications.some(
                                  (a: any) => a.jobId === j.id,
                                )}
                                compact
                                onOpen={() => {
                                  setSelected(j);
                                  setModal("job");
                                }}
                                onSave={() => saveJob(j)}
                              />
                            ))}
                          </div>
                        ) : (
                          <Empty
                            title="Your next opportunity starts here"
                            text="Add preferences, then import a description you are allowed to use."
                            action={
                              <button
                                className="btn outline"
                                onClick={() => {
                                  go("jobs");
                                  setModal("import");
                                }}
                              >
                                <Plus size={15} /> Import a job
                              </button>
                            }
                          />
                        )}
                      </section>
                      <section className="panel activity-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Application progress</h2>
                            <p>
                              {state.applications.length} opportunities across
                              your journey
                            </p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => go("applications")}
                          >
                            Open tracker <ArrowUpRight size={15} />
                          </button>
                        </div>
                        <div className="progress-bars">
                          {statuses.slice(0, 5).map((s, i) => {
                            const count = state.applications.filter(
                              (a: any) => a.status === s,
                            ).length;
                            return (
                              <div key={s}>
                                <span className={"stage-dot stage-" + i} />
                                <span>{s}</span>
                                <div className="bar-track">
                                  <div
                                    className={"bar-fill stage-bg-" + i}
                                    style={{
                                      width: state.applications.length
                                        ? `${(count / state.applications.length) * 100}%`
                                        : "0%",
                                    }}
                                  />
                                </div>
                                <b>{count}</b>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                    <aside className="overview-secondary">
                      <section className="panel profile-progress">
                        <div className="panel-heading">
                          <h2>Your career foundation</h2>
                          <UserRound size={17} />
                        </div>
                        <div className="completion">
                          <svg
                            viewBox="0 0 100 100"
                            aria-label={`${complete}% profile completion`}
                          >
                            <circle
                              cx="50"
                              cy="50"
                              r="42"
                              stroke="#edf1f6"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="42"
                              stroke="#2563eb"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${complete * 2.64} 264`}
                              transform="rotate(-90 50 50)"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div>
                            <b>{complete}%</b>
                            <span>PROFILE COMPLETE</span>
                          </div>
                        </div>
                        <p>Make the most of your experience.</p>
                        {[
                          ["Profile details", !!state.profile.fullName],
                          [
                            "Skills & experience",
                            !!state.profile.skills.length,
                          ],
                          [
                            "Career preferences",
                            !!state.preferences.targetRoles.length,
                          ],
                          ["Active resume", !!active],
                        ].map(([label, done]) => (
                          <div className="check-row" key={String(label)}>
                            {done ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Circle size={16} />
                            )}
                            <span>{label}</span>
                            {!done && (
                              <button
                                onClick={() =>
                                  go(
                                    label === "Active resume"
                                      ? "resumes"
                                      : "profile",
                                  )
                                }
                                aria-label={"Add " + label}
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          className="btn outline full"
                          onClick={() => go("profile")}
                        >
                          Update profile <ArrowRight size={15} />
                        </button>
                      </section>
                      <section className="panel active-resume">
                        <div className="panel-heading">
                          <h2>Active resume</h2>
                          <FileText size={16} />
                        </div>
                        {active ? (
                          <>
                            <div className="resume-file">
                              <span>
                                <FileText size={25} />
                              </span>
                              <div>
                                <b>{active.title}</b>
                                <small>
                                  Version {active.version} ·{" "}
                                  {dateLabel(active.createdAt)}
                                </small>
                              </div>
                              <Pill tone="green">Active</Pill>
                            </div>
                            <button
                              className="text-link"
                              onClick={() => openEditor(active)}
                            >
                              Open in Resume Studio <ArrowUpRight size={14} />
                            </button>
                          </>
                        ) : (
                          <p>
                            No active resume yet. Save a version and choose it
                            for matching.
                          </p>
                        )}
                      </section>
                      <section className="panel goals-card">
                        <div className="panel-heading">
                          <h2>Your direction</h2>
                          <Compass size={17} />
                        </div>
                        <small>TARGET ROLES</small>
                        <div className="direction-tags">
                          {state.preferences.targetRoles.length ? (
                            state.preferences.targetRoles.map((r: string) => (
                              <span key={r}>{r}</span>
                            ))
                          ) : (
                            <p>Choose your target roles</p>
                          )}
                        </div>
                        <small>PREFERRED LOCATIONS</small>
                        <p className="location-line">
                          <MapPin size={14} />
                          {state.preferences.preferredCities.join(" · ") ||
                            state.profile.currentCity ||
                            "Not set"}
                        </p>
                        <button
                          className="text-link"
                          onClick={() => {
                            setProfileTab("Preferences");
                            go("profile");
                          }}
                        >
                          Edit preferences <ArrowRight size={14} />
                        </button>
                      </section>
                      <section className="digest-card">
                        <div>
                          <span className="digest-icon">
                            <Bell size={18} />
                          </span>
                          <Pill tone="white">
                            {state.notifications.paused
                              ? "Paused"
                              : state.notifications.emailEnabled ||
                                  state.notifications.whatsappEnabled
                                ? "Enabled"
                                : "Setup required"}
                          </Pill>
                        </div>
                        <h3>Your morning opportunity digest</h3>
                        <p>
                          {state.notifications.dispatchTime} ·{" "}
                          {state.notifications.timeZone}
                        </p>
                        <small>
                          {state.notificationHistory?.[0]
                            ? "Recent status: " +
                              state.notificationHistory[0].status
                            : "No messages recorded. Verify your channels to begin."}
                        </small>
                        <p>
                          {state.notifications.nextAlert
                            ? "Next: " +
                              new Date(
                                state.notifications.nextAlert,
                              ).toLocaleString("en-IN")
                            : "No dispatch scheduled"}
                        </p>
                        <button onClick={() => go("notifications")}>
                          Manage alerts <ArrowRight size={15} />
                        </button>
                      </section>
                    </aside>
                  </div>
                  <UpcomingInterviews state={state} />
                </>
              )}
              {view === "profile" && (
                <>
                  <PageHeading
                    eyebrow="YOUR PROFESSIONAL FOUNDATION"
                    title="My Profile"
                    text="Your confirmed story, your goals and your privacy choices."
                  />
                  <div className="tabs">
                    {["Details", "Preferences", "Preview & sharing"].map(
                      (t) => (
                        <button
                          key={t}
                          className={profileTab === t ? "selected" : ""}
                          onClick={() => setProfileTab(t)}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                  {profileTab === "Preview & sharing" ? (
                    <div className="profile-layout">
                      <section className="panel profile-preview">
                        <Pill tone="green">
                          <LockKeyhole size={12} /> Private preview
                        </Pill>
                        <div className="large-avatar">
                          {firstName[0].toUpperCase()}
                        </div>
                        <h2>{state.profile.fullName || "Your name"}</h2>
                        <p>
                          {state.profile.headline || "Professional headline"}
                        </p>
                        <span>
                          <MapPin size={15} />
                          {state.profile.currentCity || "Your city"}
                        </span>
                        <hr />
                        <h3>About</h3>
                        <p>
                          {state.profile.summary || "Add a career summary."}
                        </p>
                        <h3>Skills</h3>
                        <div className="direction-tags">
                          {state.profile.skills.map((s: string) => (
                            <span key={s}>{s}</span>
                          ))}
                        </div>
                      </section>
                      <section className="panel">
                        <h2>Visibility controls</h2>
                        <p>
                          Contact details are hidden. This preview is visible
                          only to you.
                        </p>
                        <div className="notice">
                          <ShieldCheck size={20} />
                          <div>
                            <b>Profile sharing is disabled</b>
                            <p>
                              Field permissions, expiring links and revocation
                              must be verified before sharing. Resume downloads
                              need separate permission.
                            </p>
                          </div>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <ProfileForm
                      profile={state.profile}
                      preferences={state.preferences}
                      tab={profileTab}
                      busy={busy}
                      save={async (p: any, pref: any) => {
                        if (
                          await mutate("profile", "PUT", {
                            profile: p,
                            preferences: pref,
                            expectedRevision: state.revision,
                          })
                        )
                          setToast("Profile and preferences saved.");
                      }}
                    />
                  )}
                </>
              )}
              {view === "resumes" && (
                <>
                  <PageHeading
                    eyebrow="PRESENT YOUR EXPERIENCE WITH CLARITY"
                    title="Resume Studio"
                    text="Give every opportunity the right version of your story."
                    action={
                      <button
                        className="btn primary"
                        onClick={() => openEditor()}
                      >
                        <Plus size={16} /> Create a resume
                      </button>
                    }
                  />
                  <DocumentManager
                    state={state}
                    demo={demo}
                    reload={load}
                    notify={setToast}
                    onEdit={openEditor}
                  />
                  {!editing && <ResumeToolkit state={state} demo={demo} onState={setState} onEdit={openEditor} />}
                  {editing ? (
                    <>
                      <div className="editor-toolbar">
                        <div>
                          <FileText size={18} />
                          <b>Professional · text template</b>
                          <span className="save-status">
                            {savedStatus || "Editing"}
                          </span>
                        </div>
                        <div>
                          <button
                            className="btn outline small"
                            onClick={() =>
                              downloadText(resumeText, "resume.txt")
                            }
                          >
                            <Download size={14} /> TXT
                          </button>
                          <button
                            className="btn primary small"
                            disabled={busy}
                            onClick={saveResume}
                          >
                            <Check size={15} /> Save version
                          </button>
                          <button
                            className="icon-button"
                            onClick={closeEditor}
                            aria-label="Close editor"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="editor-grid">
                        <section className="panel resume-editor">
                          <label>
                            Version label
                            <input
                              value={resumeTitle}
                              onChange={(e) => setResumeTitle(e.target.value)}
                              maxLength={160}
                            />
                          </label>
                          <label>
                            Target role
                            <input
                              value={resumeTarget}
                              onChange={(e) => setResumeTarget(e.target.value)}
                              maxLength={160}
                            />
                          </label>
                          <label>
                            Resume content
                            <textarea
                              className="resume-textarea"
                              value={resumeText}
                              onChange={(e) => {
                                setResumeText(e.target.value);
                                setSavedStatus("Unsaved changes");
                              }}
                              maxLength={50000}
                              placeholder={
                                "YOUR NAME\nProfessional headline\n\nSUMMARY\nYour confirmed experience.\n\nEXPERIENCE\nEmployer · Role · Dates\n\nEDUCATION\n\nSKILLS"
                              }
                            />
                          </label>
                          <small>
                            Use confirmed facts, employers, dates and results.
                          </small>
                        </section>
                        <section className="preview-panel">
                          <div className="preview-label">
                            LIVE PREVIEW <span>Simple, selectable text</span>
                          </div>
                          <div className="resume-paper">
                            <pre>
                              {resumeText ||
                                "Your resume preview will appear here."}
                            </pre>
                          </div>
                        </section>
                      </div>
                      <div className="notice">
                        <Sparkles size={19} />
                        <div>
                          <b>Writing check</b>
                          <p>
                            {resumeText.length} characters ·{" "}
                            {resumeText.trim()
                              ? resumeText.trim().split(/\s+/).length
                              : 0}{" "}
                            words. Use clear headings and specific, confirmed
                            examples. This is not a universal ATS score. Explore
                            suggestions in your AI Career Assistant. Review
                            every change before saving.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {state.draft && (
                        <div className="notice">
                          <RotateCcw size={18} />
                          <div>
                            <b>Recover your saved draft</b>
                            <p>A draft is available for continued editing.</p>
                          </div>
                          <button
                            className="btn outline small"
                            onClick={() => openEditor()}
                          >
                            Continue draft
                          </button>
                        </div>
                      )}
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>
                            Version history{" "}
                            <span className="count-label">
                              {state.resumes.length}
                            </span>
                          </h2>
                          <Pill tone="gray">Choose an active version</Pill>
                        </div>
                        {state.resumes.length ? (
                          <div className="version-list">
                            {state.resumes.map((r: any) => (
                              <div className="version-row" key={r.id}>
                                <span className="version-icon">
                                  <FileText size={24} />
                                </span>
                                <div>
                                  <b>{r.title}</b>
                                  <p>
                                    Version {r.version} ·{" "}
                                    {dateLabel(r.createdAt)} · {r.source} ·
                                    Profile revision {r.profileRevision}
                                  </p>
                                  <small>
                                    {r.targetRole || "General resume"}
                                  </small>
                                </div>
                                {r.active ? (
                                  <Pill tone="green">Active</Pill>
                                ) : (
                                  <button
                                    className="btn outline small"
                                    onClick={() =>
                                      mutate(
                                        "resumes/" + r.id + "/active",
                                        "POST",
                                      )
                                    }
                                  >
                                    Set active
                                  </button>
                                )}
                                <button
                                  className="icon-button"
                                  aria-label="Edit resume"
                                  onClick={() => openEditor(r)}
                                >
                                  <FileText size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Download resume"
                                  onClick={() =>
                                    downloadText(
                                      r.text,
                                      "resume-v" + r.version + ".txt",
                                    )
                                  }
                                >
                                  <Download size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Compare versions"
                                  onClick={() => {
                                    setSelected(r);
                                    setModal("compare");
                                  }}
                                >
                                  <Copy size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Restore version"
                                  onClick={() =>
                                    mutate(
                                      "resumes/" + r.id + "/restore",
                                      "POST",
                                    )
                                  }
                                >
                                  <RotateCcw size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Delete version"
                                  onClick={() => {
                                    setSelected(r);
                                    setModal("delete-resume");
                                  }}
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            icon={FileText}
                            title="Your story starts with a first draft"
                            text="Every saved revision is traceable. You choose the version used for matching."
                            action={
                              <button
                                className="btn primary"
                                onClick={() => openEditor()}
                              >
                                <Plus size={15} /> Create my first resume
                              </button>
                            }
                          />
                        )}
                      </section>
                    </>
                  )}
                </>
              )}
              {view === "jobs" && (
                <>
                  <PageHeading
                    eyebrow="OPPORTUNITIES WITH A REASON"
                    title="Job Matches"
                    text="A focused search starts with your skills, goals and boundaries."
                    action={
                      <button
                        className="btn primary"
                        onClick={() => setModal("import")}
                      >
                        <Plus size={16} /> Import a job
                      </button>
                    }
                  />
                  <SourceConnection
                    state={state}
                    demo={demo}
                    reload={load}
                    notify={setToast}
                  />
                  <div className="jobs-toolbar">
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search title, company or city"
                        aria-label="Search matches"
                      />
                    </label>
                    <button
                      className="btn outline"
                      onClick={() => {
                        setProfileTab("Preferences");
                        go("profile");
                      }}
                    >
                      <Filter size={15} /> Preferences
                    </button>
                  </div>
                  <div className="results-heading">
                    <span>
                      {shownJobs.length} relevant opportunities{" "}
                      <small>· mandatory preferences applied first</small>
                    </span>
                    <span>Sorted by estimated profile fit</span>
                  </div>
                  {shownJobs.length ? (
                    <div className="jobs-grid">
                      {shownJobs.map((j: any) => (
                        <JobCard
                          key={j.id}
                          job={j}
                          profile={state.profile}
                          saved={state.applications.some(
                            (a: any) => a.jobId === j.id,
                          )}
                          onOpen={() => {
                            setSelected(j);
                            setModal("job");
                          }}
                          onSave={() => saveJob(j)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={BriefcaseBusiness}
                      title={
                        state.jobs.length
                          ? "No jobs meet your boundaries"
                          : "Start with a real opportunity"
                      }
                      text="Paste a permitted job description. Mandatory filters remain unchanged when no jobs match."
                      action={
                        <button
                          className="btn primary"
                          onClick={() => setModal("import")}
                        >
                          <Plus size={15} /> Import a job
                        </button>
                      }
                    />
                  )}
                  <div className="score-note">
                    <AlertCircle size={15} />
                    <p>
                      {demo
                        ? "The demonstration compares fictional skills."
                        : "The fit estimate combines documented skills, role and experience. Open a match to see evidence, factors and uncertainties."}{" "}
                      No score predicts selection.
                    </p>
                  </div>
                </>
              )}
              {view === "saved" && (
                <>
                  <PageHeading
                    eyebrow="OPPORTUNITIES YOU WANT TO KEEP"
                    title="Saved Jobs"
                    text="Review saved roles before deciding on your next application."
                  />
                  {state.applications.filter((a: any) => a.status === "Saved")
                    .length ? (
                    <div className="jobs-grid">
                      {state.applications
                        .filter((a: any) => a.status === "Saved")
                        .map((a: any) => {
                          const j = state.jobs.find(
                            (j: any) => j.id === a.jobId,
                          );
                          return j ? (
                            <JobCard
                              key={a.id}
                              job={j}
                              profile={state.profile}
                              saved
                              onOpen={() => {
                                setSelected(j);
                                setModal("job");
                              }}
                              onSave={() => {
                                setSelected({ ...a, job: j });
                                setModal("application");
                              }}
                            />
                          ) : null;
                        })}
                    </div>
                  ) : (
                    <Empty
                      icon={Bookmark}
                      title="Your saved opportunities will appear here"
                      text="Save an imported role or approved feed result to revisit it."
                      action={
                        <button
                          className="btn primary"
                          onClick={() => go("jobs")}
                        >
                          Find a match <ArrowRight size={15} />
                        </button>
                      }
                    />
                  )}
                </>
              )}
              {view === "applications" && (
                <>
                  <PageHeading
                    eyebrow="YOUR SEARCH, WITH STRUCTURE"
                    title="Application Tracker"
                    text="Keep every opportunity and next step in sight."
                    action={
                      <button
                        className="btn outline"
                        onClick={() => setAppList(!appList)}
                      >
                        <Kanban size={16} />
                        {appList ? "Board view" : "List view"}
                      </button>
                    }
                  />
                  <div className="tracker-summary">
                    {state.applications.length} tracked opportunities{" "}
                    <span>· Applications change only when you confirm.</span>
                  </div>
                  {!state.applications.length ? (
                    <Empty
                      icon={Kanban}
                      title="Give your job search a home"
                      text="Save a match to start. Opening an external page never marks it as applied."
                      action={
                        <button
                          className="btn primary"
                          onClick={() => go("jobs")}
                        >
                          Explore matches <ArrowRight size={15} />
                        </button>
                      }
                    />
                  ) : appList ? (
                    <section className="panel application-table">
                      <div className="table-header">
                        <span>Opportunity</span>
                        <span>Status</span>
                        <span>Next step</span>
                      </div>
                      {state.applications.map((a: any) => {
                        const j = state.jobs.find((j: any) => j.id === a.jobId);
                        return (
                          <button
                            className="table-row"
                            key={a.id}
                            onClick={() => {
                              setSelected({ ...a, job: j });
                              setModal("application");
                            }}
                          >
                            <span>
                              <b>{j?.title}</b>
                              <small>{j?.company}</small>
                            </span>
                            <Pill tone="gray">{a.status}</Pill>
                            <span>
                              {a.notes || "Add a note"}{" "}
                              <ArrowUpRight size={14} />
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  ) : (
                    <div className="kanban-board">
                      {statuses.map((s, i) => (
                        <section className="kanban-column" key={s}>
                          <div className="kanban-title">
                            <span className={"stage-dot stage-" + (i % 5)} />
                            <h2>{s}</h2>
                            <span>
                              {
                                state.applications.filter(
                                  (a: any) => a.status === s,
                                ).length
                              }
                            </span>
                          </div>
                          {state.applications
                            .filter((a: any) => a.status === s)
                            .map((a: any) => {
                              const j = state.jobs.find(
                                (j: any) => j.id === a.jobId,
                              );
                              return (
                                <button
                                  className="application-card"
                                  key={a.id}
                                  onClick={() => {
                                    setSelected({ ...a, job: j });
                                    setModal("application");
                                  }}
                                >
                                  <span
                                    className={
                                      "company-icon " + (j?.color || "blue")
                                    }
                                  >
                                    {j?.company?.[0] || "J"}
                                  </span>
                                  <h3>{j?.title}</h3>
                                  <p>
                                    {j?.company}
                                    {demo ? " · Demo" : ""}
                                  </p>
                                  <small>
                                    <MapPin size={12} />
                                    {j?.location}
                                  </small>
                                  {a.notes && (
                                    <div className="app-note">{a.notes}</div>
                                  )}
                                  <span className="app-date">
                                    <Clock size={12} />
                                    {dateLabel(a.createdAt)}
                                    <ArrowUpRight size={14} />
                                  </span>
                                </button>
                              );
                            })}
                          {!state.applications.some(
                            (a: any) => a.status === s,
                          ) && (
                            <div className="kanban-empty">
                              No opportunities yet
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
              {view === "interview" && (
                <>
                  <PageHeading
                    eyebrow="A LITTLE PRACTICE. MORE CONFIDENCE."
                    title="Interview Practice"
                    text="Build clear answers around your actual experience."
                  />
                  <AssistantTools
                    state={state}
                    demo={demo}
                    reload={load}
                    notify={setToast}
                    interview
                  />
                </>
              )}
              {view === "coach" && (
                <>
                  <PageHeading
                    eyebrow="SMALL ACTIONS. MEANINGFUL DIRECTION."
                    title="Career Coach"
                    text="Make a practical plan for the professional you want to become."
                  />
                  <AssistantTools
                    state={state}
                    demo={demo}
                    reload={load}
                    notify={setToast}
                  />
                  <div className="career-plan">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Your career action plan</h2>
                          <p>
                            {state.tasks.filter((t: any) => t.completed).length}{" "}
                            of {state.tasks.length} complete
                          </p>
                        </div>
                        <Target size={20} />
                      </div>
                      {state.tasks.length ? (
                        state.tasks.map((t: any) => (
                          <label
                            className={
                              "task-row " + (t.completed ? "done" : "")
                            }
                            key={t.id}
                          >
                            <input
                              type="checkbox"
                              checked={t.completed}
                              onChange={(e) =>
                                mutate("tasks/" + t.id, "PATCH", {
                                  completed: e.target.checked,
                                })
                              }
                            />
                            <span>{t.title}</span>
                          </label>
                        ))
                      ) : (
                        <p>Break your goal into one achievable next step.</p>
                      )}
                      <form
                        className="task-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.currentTarget,
                            data = new FormData(form);
                          if (
                            await mutate("tasks", "POST", {
                              title: data.get("title"),
                            })
                          )
                            form.reset();
                        }}
                      >
                        <input
                          name="title"
                          aria-label="New career-plan action"
                          placeholder="Add a practical next step…"
                          required
                          maxLength={300}
                        />
                        <button className="btn primary small">
                          <Plus size={16} /> Add
                        </button>
                      </form>
                      <div className="notice">
                        <Target size={19} />
                        <div>
                          <b>Skills to explore</b>
                          <p>
                            {Array.from(
                              new Set(
                                eligible.flatMap(
                                  (j: any) =>
                                    skillInfo(j, state.profile).missing,
                                ),
                              ),
                            )
                              .slice(0, 6)
                              .join(" · ") ||
                              "Import target jobs to identify explicit requirements."}
                          </p>
                          <small>
                            From listed requirements; not a market-wide
                            assessment.
                          </small>
                        </div>
                      </div>
                    </section>
                  </div>
                </>
              )}
              {view === "insights" && (
                <>
                  <PageHeading
                    eyebrow="EVIDENCE BEFORE ASSUMPTIONS"
                    title="Market Insights"
                    text="Career decisions deserve dated sources and clear context."
                  />
                  <Empty
                    icon={ChartNoAxesCombined}
                    title="Research awaits a connected source"
                    text="No salary estimates or market trends are fabricated. Current, attributable research and permitted data feeds need setup before this panel can show evidence."
                    action={
                      <button
                        className="btn outline"
                        onClick={() => go("jobs")}
                      >
                        Review imported jobs <ArrowRight size={15} />
                      </button>
                    }
                  />
                  <div className="feature-grid">
                    {[
                      [
                        "Role requirements",
                        "Compare explicit skills in actual job descriptions.",
                      ],
                      [
                        "Salary context",
                        "Show currency, period, location, sample size and date.",
                      ],
                      [
                        "Industry direction",
                        "Check source coverage before wider conclusions.",
                      ],
                    ].map(([title, text]) => (
                      <section className="panel" key={title}>
                        <span className="feature-icon">
                          <ChartNoAxesCombined size={23} />
                        </span>
                        <h3>{title}</h3>
                        <p>{text}</p>
                        <Pill tone="gray">Awaiting current evidence</Pill>
                      </section>
                    ))}
                  </div>
                </>
              )}
              {view === "notifications" && (
                <>
                  <PageHeading
                    eyebrow="OPPORTUNITIES, ON YOUR TERMS"
                    title="Alerts"
                    text="Choose your channels, verify your contacts, and control your daily digest."
                  />
                  <AlertSettings
                    state={state}
                    demo={demo}
                    reload={load}
                    notify={setToast}
                  />
                </>
              )}
              {view === "settings" && (
                <>
                  <PageHeading
                    eyebrow="YOUR DATA. YOUR CHOICES."
                    title="Settings"
                    text="Control your privacy, account and connected services."
                  />
                  <div className="settings-grid">
                    <section className="panel">
                      <h2>Privacy & account</h2>
                      <div className="settings-row">
                        <div>
                          <b>Export your data</b>
                          <p>
                            Download your profile, preferences, resumes and
                            activity.
                          </p>
                        </div>
                        <button
                          className="btn outline small"
                          onClick={async () => {
                            if (demo)
                              downloadText(
                                JSON.stringify(state, null, 2),
                                "demo-career-export.json",
                                "application/json",
                              );
                            else {
                              const r = await fetch("/api/career/export", {
                                cache: "no-store",
                              });
                              if (r.ok)
                                downloadText(
                                  await r.text(),
                                  "career-export.json",
                                  "application/json",
                                );
                              else setToast("Export failed. Try again.");
                            }
                          }}
                        >
                          <Download size={15} /> Export
                        </button>
                      </div>
                      <div className="settings-row">
                        <div>
                          <b>Sharing & contact visibility</b>
                          <p>Private by default. Shared links are disabled.</p>
                        </div>
                        <button
                          className="text-link"
                          onClick={() => {
                            setProfileTab("Preview & sharing");
                            go("profile");
                          }}
                        >
                          Preview <ArrowRight size={14} />
                        </button>
                      </div>
                      <div className="settings-row">
                        <div>
                          <b>Sign-in & recovery</b>
                          <p>
                            Candidate sign-in is separate from administrator access. Use the
                            account recovery page for a candidate password reset.
                          </p>
                        </div>
                        <a className="text-link" href="/forgot-password">Candidate recovery</a>
                      </div>
                      <div className="settings-row danger-row">
                        <div>
                          <b>Account deletion</b>
                          <p>
                            Disabled until recent authentication can be securely
                            verified. Backup deletion also needs setup.
                          </p>
                        </div>
                        <button
                          className="btn outline small"
                          onClick={() =>
                            setToast(
                              "Account deletion is disabled pending verified recent authentication and operational deletion setup.",
                            )
                          }
                        >
                          <LockKeyhole size={15} /> Disabled
                        </button>
                      </div>
                    </section>
                    <section className="panel">
                      <h2>Connection status</h2>
                      <p>
                        These services need verified setup before they can
                        operate.
                      </p>
                      {[
                        "jobs",
                        "ai",
                        "documents",
                        "email",
                        "whatsapp",
                        "billing",
                        "admin",
                        "sharing",
                      ].map((name) => (
                        <div className="integration-row" key={name}>
                          <span className="integration-dot" />
                          <div>
                            <b>
                              {name === "ai"
                                ? "AI provider"
                                : name[0].toUpperCase() + name.slice(1)}
                            </b>
                            <p>
                              {name === "jobs"
                                ? "Approved job feeds can supply current listings."
                                : name === "ai"
                                  ? "External AI suggestions need a connected service."
                                  : name === "documents"
                                    ? "Uploads need secure document processing."
                                    : name === "email" || name === "whatsapp"
                                      ? "Verify your destination and enable alerts after service setup."
                                      : "This sensitive feature requires further setup."}
                            </p>
                          </div>
                          <Pill tone="gray">
                            {state.integrations[name]?.status ||
                              "Awaiting setup"}
                          </Pill>
                        </div>
                      ))}
                    </section>
                  </div>
                  <div className="notice">
                    <ShieldCheck size={20} />
                    <div>
                      <b>Production release requires further verification</b>
                      <p>
                        The service is in private review. Some connections and
                        safeguards require further verification. Billing is
                        disabled.
                      </p>
                    </div>
                    <a className="text-link" href="/security">
                      Security approach <ArrowUpRight size={15} />
                    </a>
                  </div>
                </>
              )}
            </>
          )}
          <div className="workspace-footer">
            <span>One thoughtful step at a time.</span>
            <div>
              <span>
                <ShieldCheck size={12} /> Private by default
              </span>
              <a href="/contact">
                Help & support <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              job: "Opportunity details",
              import: "Import a job description",
              application: "Update application",
              compare: "Compare resume content",
              "delete-resume": "Delete this resume version?",
            }[modal] || "Details"
          }
          close={() => setModal(null)}
        >
          {modal === "job" && selected && (
            <>
              <div className="job-detail-heading">
                <span className={"company-icon " + (selected.color || "blue")}>
                  {selected.company[0]}
                </span>
                <div>
                  <h3>{selected.title}</h3>
                  <p>
                    {selected.company}
                    {demo ? " · Fictional demo company" : ""}
                  </p>
                </div>
              </div>
              <div className="job-meta">
                <span>
                  <MapPin size={14} />
                  {selected.location || "Not provided"} ·{" "}
                  {selected.workArrangement || "Not provided"}
                </span>
                <span>
                  {selected.maxExperience === null ||
                  selected.maxExperience === undefined
                    ? "No maximum provided"
                    : selected.minExperience +
                      "–" +
                      selected.maxExperience +
                      " years"}
                </span>
                <span>{selected.salary || "Salary not provided"}</span>
              </div>
              <hr />
              <MatchExplanation job={selected} />
              <p>{selected.description}</p>
              <div className="form-actions">
                <button
                  className="btn primary"
                  onClick={() => saveJob(selected)}
                >
                  <Bookmark size={16} /> Save opportunity
                </button>
                {selected.url && (
                  <a
                    className="btn outline"
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open original <ArrowUpRight size={15} />
                  </a>
                )}
                <button
                  className="btn outline"
                  onClick={() => {
                    setToast(
                      "Update your explicit preferences to refine matches.",
                    );
                    setModal(null);
                    setProfileTab("Preferences");
                    go("profile");
                  }}
                >
                  Not relevant
                </button>
              </div>
              <small>
                Opening a source never marks an application as submitted.
              </small>
            </>
          )}
          {modal === "import" && (
            <JobImport
              busy={busy}
              save={async (body: any) => {
                if (await mutate("jobs", "POST", body)) {
                  setModal(null);
                  setToast(
                    "Description imported. Unknown details remain unverified.",
                  );
                }
              }}
            />
          )}
          {modal === "application" && selected && (
            <form
              className="stacked-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                if (
                  d.get("status") === "Applied" &&
                  d.get("confirmedApplied") !== "on"
                ) {
                  setToast("Confirm that you submitted the application first.");
                  return;
                }
                if (
                  await mutate("applications/" + selected.id, "PATCH", {
                    status: d.get("status"),
                    notes: d.get("notes"),
                    confirmedApplied: d.get("confirmedApplied") === "on",
                    reminderAt: d.get("reminderAt")
                      ? new Date(String(d.get("reminderAt"))).toISOString()
                      : null,
                    resumeId: d.get("resumeId") || null,
                  })
                ) {
                  setModal(null);
                  setToast("Application updated.");
                }
              }}
            >
              <h3>{selected.job?.title}</h3>
              <label>
                Status
                <select name="status" defaultValue={selected.status}>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="confirmedApplied" /> I confirm I
                submitted this application (required for Applied).
              </label>
              <label>
                Notes & next step
                <textarea
                  name="notes"
                  rows={5}
                  maxLength={3000}
                  defaultValue={selected.notes}
                />
              </label>
              <label>
                Interview / reminder date <small>optional</small>
                <input
                  type="datetime-local"
                  name="reminderAt"
                  defaultValue={
                    selected.reminderAt
                      ? new Date(
                          new Date(selected.reminderAt).getTime() -
                            new Date(selected.reminderAt).getTimezoneOffset() *
                              60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
              <label>
                Resume used <small>optional</small>
                <select name="resumeId" defaultValue={selected.resumeId || ""}>
                  <option value="">No version selected</option>
                  {state.resumes.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      Version {r.version} · {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Status and dates are candidate-updated. A reminder date does not
                send a message.
              </p>
              <button className="btn primary" disabled={busy}>
                Save changes <Check size={16} />
              </button>
            </form>
          )}
          {modal === "compare" && selected && (
            <>
              <p>
                Version {selected.version} compared with{" "}
                {active
                  ? "active version " + active.version
                  : "no active version"}
                .
              </p>
              <div className="compare-grid">
                <div>
                  <h3>Selected content</h3>
                  <pre>{selected.text}</pre>
                </div>
                <div>
                  <h3>Active content</h3>
                  <pre>{active?.text || "No active resume."}</pre>
                </div>
              </div>
            </>
          )}
          {modal === "delete-resume" && (
            <>
              <p>
                Version {selected?.version} will be deleted from your live
                workspace. {selected?.active?"This is your active resume. Matching will use your confirmed profile until you select another version.":"Other versions remain available."}
              </p>
              <div className="form-actions">
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={async () => {
                    if (await mutate("resumes/" + selected.id, "DELETE", {confirmActive:!!selected.active})) {
                      setModal(null);
                      setToast("Version deleted.");
                    }
                  }}
                >
                  Delete version
                </button>
                <button className="btn outline" onClick={() => setModal(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function JobCard({
  job: j,
  profile,
  saved,
  onOpen,
  onSave,
  compact = false,
}: any) {
  const info = skillInfo(j, profile);
  return (
    <article className={"job-card " + (compact ? "compact" : "")}>
      <div className="job-card-top">
        <span className={"company-icon " + (j.color || "blue")}>
          {j.company[0]}
        </span>
        <div className="job-card-title">
          <button onClick={onOpen}>{j.title}</button>
          <p>
            {j.company}
            {j.source === "demonstration" ? " · Demo" : ""}
          </p>
        </div>
        <button
          className={"icon-button save-job " + (saved ? "saved" : "")}
          onClick={onSave}
          aria-label={saved ? "Saved job" : "Save job"}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="job-card-info">
        <span>
          <MapPin size={13} />
          {j.location || "Not provided"}
        </span>
        <span>{j.workArrangement || "Not provided"}</span>
        <span>
          {j.minExperience == null && j.maxExperience == null
            ? "Experience not provided"
            : j.maxExperience == null
              ? j.minExperience + "+ years"
              : j.minExperience == null
                ? "Up to " + j.maxExperience + " years"
                : j.minExperience + "–" + j.maxExperience + " years"}
        </span>
      </div>
      <div className="job-card-bottom">
        <Pill tone={info.score >= 60 ? "green" : "blue"}>
          <span className="status-dot" />
          {j.relevance
            ? j.relevance.label
            : info.score >= 60
              ? "Strong skill overlap"
              : "Partial skill overlap"}{" "}
          · {info.score}%
        </Pill>
        <button className="text-link" onClick={onOpen}>
          View match <ArrowUpRight size={14} />
        </button>
      </div>
      {!compact && (
        <div className="match-reasons">
          <p>
            <Check size={13} />
            {info.matched.slice(0, 3).join(" · ") ||
              "No listed skill overlap yet"}
          </p>
          <small>
            {info.missing.length
              ? info.missing.length + " listed skills to review"
              : "Review context & experience"}
          </small>
          <span>
            Source:{" "}
            {j.source === "demonstration"
              ? "Fictional demo"
              : j.source === "greenhouse"
                ? "Employer feed"
                : "Candidate import"}{" "}
            ·{" "}
            {j.lastCheckedAt
              ? "Checked " + dateLabel(j.lastCheckedAt)
              : "Not live-checked"}
          </span>
        </div>
      )}
    </article>
  );
}
function ProfileForm({ profile, preferences, tab, busy, save }: any) {
  const [p, setP] = useState(profile),
    [pref, setPref] = useState(preferences);
  useEffect(() => {
    setP(profile);
    setPref(preferences);
  }, [profile, preferences]);
  function field(k: string, label: string, type = "text") {
    return (
      <label key={k}>
        {label}
        {k !== "fullName" && <span className="optional">optional</span>}
        <input
          type={type}
          value={p[k] ?? ""}
          onChange={(e) =>
            setP({
              ...p,
              [k]: type === "number" ? Number(e.target.value) : e.target.value,
            })
          }
          min={type === "number" ? 0 : undefined}
          max={type === "number" ? 60 : undefined}
          maxLength={type === "number" ? undefined : 500}
          required={k === "fullName"}
        />
      </label>
    );
  }
  function list(k: string, label: string, isProfile = false) {
    const obj = isProfile ? p : pref;
    return (
      <label key={k}>
        {label}
        <input
          value={(obj[k] || []).join(", ")}
          onChange={(e) => {
            const v = e.target.value.split(",").map((s) => s.trimStart());
            isProfile ? setP({ ...p, [k]: v }) : setPref({ ...pref, [k]: v });
          }}
          placeholder="Separate entries with commas"
          maxLength={2000}
        />
      </label>
    );
  }
  return (
    <form
      className="panel profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = (obj: any) =>
          Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [
              k,
              Array.isArray(v)
                ? v.map((x) => String(x).trim()).filter(Boolean)
                : v,
            ]),
          );
        save(clean(p), clean(pref));
      }}
    >
      {tab === "Details" ? (
        <>
          <div className="form-section-title">
            <UserRound size={20} />
            <div>
              <h2>Personal & professional details</h2>
              <p>Keep account contacts separate from resume content.</p>
            </div>
            <Pill tone="green">Private</Pill>
          </div>
          <div className="form-grid">
            {field("fullName", "Full name")}
            {field("headline", "Professional headline")}
            <label>
              Account email
              <input value={p.email} readOnly />
              <small>Managed by your sign-in provider</small>
            </label>
            {field("phone", "Phone with country code", "tel")}
            {field("whatsapp", "WhatsApp number", "tel")}
            {field("currentCity", "Current city")}
            {field("state", "State")}
            {field("country", "Country")}
            {field("currentRole", "Current / most recent role")}
            {field("currentCompany", "Current company")}
            {field("totalExperience", "Total experience (years)", "number")}
            {field(
              "relevantExperience",
              "Relevant experience (years)",
              "number",
            )}
            {field("portfolio", "LinkedIn / portfolio URL", "url")}
            {field("linkedin", "LinkedIn URL", "url")}
          </div>
          <label>
            Career summary
            <textarea
              rows={4}
              value={p.summary}
              maxLength={5000}
              onChange={(e) => setP({ ...p, summary: e.target.value })}
            />
          </label>
          {list("skills", "Confirmed skills", true)}
          {list("languages", "Languages", true)}
          {[
            ["workHistory", "Work history"],
            ["education", "Education"],
            ["projects", "Projects"],
            ["certifications", "Certifications"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <textarea
                rows={3}
                value={p[k]}
                maxLength={10000}
                onChange={(e) => setP({ ...p, [k]: e.target.value })}
              />
            </label>
          ))}
        </>
      ) : (
        <>
          <div className="form-section-title">
            <Compass size={21} />
            <div>
              <h2>Where do you want to go?</h2>
              <p>
                Mandatory preferences stay boundaries when there are no matches.
              </p>
            </div>
          </div>
          <div className="form-grid">
            {list("targetRoles", "Target roles")}
            {list("industries", "Target industries")}
            {list("preferredCities", "Preferred cities")}
            {list("preferredCountries", "Preferred countries")}
            {list(
              "employmentTypes",
              "Employment types (Full-time, Contract, etc.)",
            )}
            {list(
              "workArrangements",
              "Work arrangements (On-site, Hybrid, Remote)",
            )}
            <label>
              Expected salary minimum <small>optional</small>
              <input
                type="number"
                min={0}
                value={pref.expectedSalaryMin ?? pref.salaryAmount ?? ""}
                onChange={(e) =>
                  setPref({
                    ...pref,
                    expectedSalaryMin: e.target.value
                      ? Number(e.target.value)
                      : null,
                    salaryAmount: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Expected salary maximum <small>optional</small>
              <input
                type="number"
                min={0}
                value={pref.expectedSalaryMax ?? ""}
                onChange={(e) =>
                  setPref({
                    ...pref,
                    expectedSalaryMax: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Currency
              <select
                value={pref.salaryCurrency}
                onChange={(e) =>
                  setPref({ ...pref, salaryCurrency: e.target.value })
                }
              >
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </label>
            <label>
              Salary basis
              <select
                value={pref.salaryBasis}
                onChange={(e) =>
                  setPref({ ...pref, salaryBasis: e.target.value })
                }
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label>
              Notice period / availability
              <input
                value={pref.noticePeriod}
                maxLength={200}
                onChange={(e) =>
                  setPref({ ...pref, noticePeriod: e.target.value })
                }
              />
            </label>
            {list("excludeCompanies", "Companies to exclude")}
            {list("excludeRoles", "Roles to exclude")}
            {list("excludeLocations", "Locations to exclude")}
            {list("excludeIndustries", "Industries to exclude")}
            <label>Joining availability<input value={pref.joiningAvailability ?? ""} maxLength={200} onChange={e=>setPref({...pref,joiningAvailability:e.target.value})}/></label>
            <label>Travel preference<select value={pref.travelPreference ?? "unspecified"} onChange={e=>setPref({...pref,travelPreference:e.target.value})}><option value="unspecified">Flexible / not specified</option><option value="none">No travel</option><option value="occasional">Occasional travel</option><option value="frequent">Frequent travel</option></select></label>
          </div>
          <div className="preference-controls">
            {[
              ["relocate", "I am willing to relocate"],
              ["mandatoryLocation", "Preferred location is mandatory"],
              ["mandatoryWorkArrangement", "Work arrangement is mandatory"],
              ["mandatoryEmploymentType", "Employment type is mandatory"],
              ["mandatoryCountry", "Preferred country is mandatory"],
              ["mandatoryRole", "Target role is mandatory"],
              ["mandatoryIndustry", "Target industry is mandatory"],
              ["mandatorySkills", "Required skills must be confirmed"],
              ["mandatoryExperience", "Required experience is mandatory"],
              ["mandatoryQualifications", "Required qualifications must be confirmed"],
              [
                "mandatorySalary",
                "Salary minimum is mandatory (missing salary requires checking)",
              ],
            ].map(([k, l]) => (
              <label className="checkbox-row" key={k}>
                <input
                  type="checkbox"
                  checked={pref[k]}
                  onChange={(e) => setPref({ ...pref, [k]: e.target.checked })}
                />
                {l}
              </label>
            ))}
          </div>
          <div className="notice">
            <MapPin size={19} />
            <p>
              If preferred cities are empty, your current city is used.
              Mandatory filters are never expanded silently.
            </p>
          </div>
        </>
      )}
      <div className="form-actions">
        <button className="btn primary" disabled={busy}>
          <Check size={16} />
          {busy ? "Saving…" : "Save profile & preferences"}
        </button>
        <span className="muted">Only confirmed information is used.</span>
      </div>
    </form>
  );
}
function NotificationForm({ value, busy, save }: any) {
  const [n, setN] = useState(value);
  useEffect(() => setN(value), [value]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          emailEnabled: false,
          whatsappEnabled: false,
          emailConsent: n.emailConsent,
          whatsappConsent: n.whatsappConsent,
          timeZone: n.timeZone,
          dispatchTime: n.dispatchTime,
          paused: n.paused,
        });
      }}
    >
      <div className="notification-grid">
        {[
          [
            "email",
            "Email digest",
            "New opportunities, match reasons and a dashboard link.",
          ],
          [
            "whatsapp",
            "WhatsApp digest",
            "A concise update through an approved business provider.",
          ],
        ].map(([k, title, text]) => (
          <section className="panel channel-card" key={k}>
            <div className="panel-heading">
              <span className="feature-icon">
                {k === "email" ? (
                  <Send size={23} />
                ) : (
                  <MessagesSquare size={23} />
                )}
              </span>
              <Pill tone="gray">Not connected</Pill>
            </div>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className="destination-state">
              <AlertCircle size={15} /> Destination is not verified
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={n[k + "Consent"]}
                onChange={(e) =>
                  setN({ ...n, [k + "Consent"]: e.target.checked })
                }
              />{" "}
              I consent to this channel's future job digest.
            </label>
            <small>
              No messages are sent until destination verification and provider
              setup are complete.
            </small>
          </section>
        ))}
      </div>
      <section className="panel schedule-panel">
        <div className="panel-heading">
          <div>
            <h2>Your daily schedule</h2>
            <p>Dispatch time and confirmed delivery time are different.</p>
          </div>
          <CalendarDays size={20} />
        </div>
        <div className="form-grid">
          <label>
            Dispatch time
            <input
              type="time"
              value={n.dispatchTime}
              onChange={(e) => setN({ ...n, dispatchTime: e.target.value })}
            />
          </label>
          <label>
            Time zone
            <select
              value={n.timeZone}
              onChange={(e) => setN({ ...n, timeZone: e.target.value })}
            >
              {[
                "Asia/Kolkata",
                "Asia/Dubai",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "Asia/Singapore",
                "Australia/Sydney",
                "UTC",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={n.paused}
            onChange={(e) => setN({ ...n, paused: e.target.checked })}
          />{" "}
          Pause all future alerts
        </label>
        <div className="notice">
          <Bell size={18} />
          <p>
            Next scheduled alert: none. Durable scheduling, duplicate
            prevention, consent rechecks and callbacks are required before
            dispatch.
          </p>
        </div>
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>
            <Check size={16} /> Save preferences
          </button>
          <button
            className="btn outline"
            type="button"
            onClick={() => {
              const next = {
                ...n,
                emailConsent: false,
                whatsappConsent: false,
                paused: true,
                emailEnabled: false,
                whatsappEnabled: false,
              };
              setN(next);
              save({
                emailEnabled: false,
                whatsappEnabled: false,
                emailConsent: false,
                whatsappConsent: false,
                timeZone: n.timeZone,
                dispatchTime: n.dispatchTime,
                paused: true,
              });
            }}
          >
            Unsubscribe both channels
          </button>
        </div>
      </section>
    </form>
  );
}
function JobImport({ busy, save }: any) {
  return (
    <form
      className="stacked-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        save({
          title: d.get("title"),
          company: d.get("company"),
          location: d.get("location"),
          workArrangement: d.get("workArrangement"),
          employmentType: d.get("employmentType"),
          minExperience: String(d.get("minExperience")||"").trim()?Number(d.get("minExperience")):null,
          maxExperience: String(d.get("maxExperience") || "").trim()
            ? Number(d.get("maxExperience"))
            : null,
          requirements: String(d.get("requirements"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: d.get("description"),
          url: d.get("url") || null,
          salary: d.get("salary") || null,
          salaryMin:String(d.get("salaryMin")||"").trim()?Number(d.get("salaryMin")):null,
          salaryMax:String(d.get("salaryMax")||"").trim()?Number(d.get("salaryMax")):null,
          salaryCurrency:d.get("salaryCurrency")||null, salaryBasis:d.get("salaryBasis")||null,
          industry:d.get("industry")||null, seniority:d.get("seniority")||null, responsibilities:String(d.get("responsibilities")||"").split(",").map(x=>x.trim()).filter(Boolean),
        });
      }}
    >
      <div className="notice">
        <FileText size={19} />
        <p>
          Use a description you are permitted to use. The server does not fetch
          the link.
        </p>
      </div>
      <div className="form-grid">
        {[
          ["title", "Job title"],
          ["company", "Company"],
          ["location", "City"],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input name={k} required={k!=="location"} maxLength={200} placeholder={k==="location"?"Not provided":undefined} />
          </label>
        ))}
        <label>
          Work arrangement
          <select name="workArrangement"><option value="">Not provided</option>
            <option>On-site</option>
            <option>Hybrid</option>
            <option>Remote</option>
          </select>
        </label>
        <label>
          Employment type
          <select name="employmentType"><option value="">Not provided</option>
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </label>
        <label>
          Minimum experience (years)
          <input
            type="number"
            name="minExperience"
            min={0}
            max={60}
            placeholder="Not provided"
          />
        </label>
        <label>
          Maximum experience (years)
          <input
            type="number"
            name="maxExperience"
            min={0}
            max={60}
            placeholder="Not provided"
          />
        </label>
        <label>
          Salary as shown (optional)
          <input
            name="salary"
            maxLength={200}
            placeholder="Not provided"
          />
        </label>
      </div>
      <div className="form-grid"><label>Salary minimum (numeric, optional)<input name="salaryMin" type="number" min={0}/></label><label>Salary maximum (numeric, optional)<input name="salaryMax" type="number" min={0}/></label><label>Salary currency<select name="salaryCurrency"><option value="">Not provided</option><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><label>Salary period<select name="salaryBasis"><option value="">Not provided</option><option value="annual">Annual</option><option value="monthly">Monthly</option></select></label><label>Industry (optional)<input name="industry" maxLength={160}/></label><label>Seniority as listed (optional)<input name="seniority" maxLength={160}/></label></div><label>Responsibilities as listed (optional)<textarea name="responsibilities" rows={3} maxLength={5000} placeholder="Separate responsibilities with commas"/></label><label>
        Main requirements (comma separated)
        <input
          name="requirements"
          maxLength={2000}
          placeholder="CATIA, GD&T, design reviews"
        />
      </label>
      <label>
        Actual job description
        <textarea name="description" rows={5} required maxLength={30000} />
      </label>
      <label>
        Original public link (optional)
        <input
          type="url"
          name="url"
          placeholder="https://company.example/careers/role"
          maxLength={2048}
        />
      </label>
      <button className="btn primary" disabled={busy}>
        Import description <ArrowRight size={16} />
      </button>
    </form>
  );
}
function Practice({ roles }: any) {
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [review, setReview] = useState(false);
  const questions = [
    `Tell me about yourself and your interest in ${roles[0] || "your target role"}.`,
    "Describe a challenging project, your responsibility and how you verified the outcome.",
    "Walk through a decision where requirements conflicted. How did you evaluate the trade-off?",
    "Describe a mistake, its root cause and what you changed afterward.",
    "Which skill would you develop next for this role, and why?",
  ];
  return (
    <div className="practice-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Text practice</h2>
          <Pill tone="green">
            Question {index + 1} of {questions.length}
          </Pill>
        </div>
        <div className="question-box">
          <MessagesSquare size={24} />
          <h2>{questions[index]}</h2>
        </div>
        <label>
          Your answer
          <textarea
            rows={8}
            value={answer}
            maxLength={12000}
            onChange={(e) => {
              setAnswer(e.target.value);
              setReview(false);
            }}
            placeholder="Context, responsibility, action and a confirmed result…"
          />
        </label>
        <div className="form-actions">
          <button
            className="btn primary"
            disabled={!answer.trim()}
            onClick={() => setReview(true)}
          >
            Review structure <ArrowRight size={15} />
          </button>
          <button
            className="btn outline"
            onClick={() => {
              setIndex((index + 1) % questions.length);
              setAnswer("");
              setReview(false);
            }}
          >
            Next question
          </button>
        </div>
        {review && (
          <div className="practice-feedback">
            <b>Self-review guide · no AI analysis</b>
            <p>
              {answer.trim().split(/\s+/).length} words. Check the situation,
              your action and a result you can support. Assess relevance,
              clarity and technical assumptions.
            </p>
            <small>
              Answers stay in tab memory. Session history and adaptive feedback
              await the AI connection.
            </small>
          </div>
        )}
      </section>
      <aside>
        <section className="panel">
          <span className="feature-icon">
            <Target size={24} />
          </span>
          <h3>A useful answer has a shape</h3>
          {[
            ["S", "Situation", "Set the context briefly."],
            ["T", "Task", "Explain your responsibility."],
            ["A", "Action", "Describe what you actually did."],
            ["R", "Result", "A verified outcome or lesson."],
          ].map(([l, t, p]) => (
            <div className="star-step" key={l}>
              <span>{l}</span>
              <div>
                <b>{t}</b>
                <p>{p}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="notice">
          <LockKeyhole size={20} />
          <div>
            <b>Voice & camera disabled</b>
            <p>
              Recording requires permission, retention controls and a provider.
              No recording occurs here.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && ref.current) {
        const nodes = Array.from(
            ref.current.querySelectorAll<HTMLElement>(
              "button,a,input,textarea,select",
            ),
          ).filter((n) => !n.hasAttribute("disabled")),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
