"use client";
import React, { useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  RefreshCw,
  ShieldCheck,
  Check,
  Send,
  Sparkles,
  BriefcaseBusiness,
  AlertCircle,
} from "lucide-react";
import type {AIResult} from "../../lib/career-ai";
import type {ViewState,CareerJob,PrivateSession,UploadedDocument,DocumentPreview,ResumeDraft,ApiResponse,VerificationResponse,QuestionList} from "./career-view-types";
function errorMessage(value:unknown){return value instanceof Error?value.message:"This action could not be completed.";}
type Props = {
  state: ViewState;
  demo: boolean;
  reload: () => Promise<void>;
  notify: (s: string) => void;
};
async function api<T=ApiResponse>(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/career/" + path, {
    method,
    cache: "no-store",
    headers:
      method === "GET"
        ? {}
        : { "Content-Type": "application/json", "X-Career-Action": "1" },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const data = await response.json() as ApiResponse;
  if (!response.ok)
    throw new Error(data.error || "This action could not be completed.");
  return data as T;
}
function Message({ text, error = false }: { text: string; error?: boolean }) {
  return text ? (
    <div
      className={"tool-message " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      {text}
    </div>
  ) : null;
}
export function SourceConnection({ state, demo, reload, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const status = state.integrations?.jobs;
  async function refresh() {
    if (demo) {
      notify("Live sources are separate from this fictional demonstration.");
      return;
    }
    setBusy(true);
    try {
      const response=await api<{refresh:{count:number;failedBoards:{board:string;code:string}[]}}>("jobs/refresh", "POST");
      const result=response.refresh;
      await reload();
      notify(
        `${result.count ?? 0} current jobs refreshed. ${result.failedBoards?.length ? "Some sources could not be reached." : ""}`,
      );
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="source-strip">
      <BriefcaseBusiness size={21} />
      <div>
        <b>
          {demo
            ? "Fictional demonstration jobs"
            : status?.status === "configured"
              ? "An approved employer feed is configured"
              : "Job source setup"}
        </b>
        <p>
          {demo
            ? "These opportunities are examples, with no real application destination."
            : status?.reason ||
              "Import a job description you are permitted to use, or connect an approved employer feed."}
        </p>
      </div>
      <button
        className="btn outline small"
        disabled={busy || demo}
        onClick={refresh}
      >
        <RefreshCw size={14} />
        {busy ? "Refreshing…" : "Refresh jobs"}
      </button>
    </div>
  );
}
export function MatchExplanation({ job }: {job:CareerJob}) {
  const relevance: Partial<NonNullable<CareerJob["relevance"]>> = job.relevance || {};
  const supported = job.matchedSkills || [];
  const related = job.relatedSkills || relevance.relatedSkills || [];
  const evidence = job.skillEvidence || [];
  return (
    <section className="match-explanation">
      <h3>Why it matches</h3>
      {job.verification?.duplicateOf ? <p className="tool-message">This listing shares an application destination with another saved listing and is excluded from duplicate preparation.</p> : null}
      {job.verification?.warnings.length ? <div className="tool-message" role="status"><b>Listing details to review</b><ul>{job.verification.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></div> : null}
      {job.memoryAdjustment?.points ? <p>{job.memoryAdjustment.reason}</p> : null}
      {job.whyMatches?.length ? <ul>{job.whyMatches.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
      <p>
        {relevance.explanation ||
          job.explanation ||
          (supported.length
            ? `Your confirmed resume supports ${supported.join(", ")}. ${job.location ? "The listed location is " + job.location + "." : ""}`
            : "Review the role against your confirmed resume and preferences.")}
      </p>
      <div className="explanation-grid">
        <div>
          <h4>Supported requirements</h4>
          <ul>
            {supported.length ? (
              supported.map((s: string) => <li key={s}>{s}</li>)
            ) : (
              <li>No exact skill evidence identified.</li>
            )}
          </ul>
        </div>
        <div>
          <h4>Possible gaps</h4>
          <ul>
            {(job.possibleGaps || job.missingSkills || []).length ? (
              (job.possibleGaps || job.missingSkills || []).map((s: string) => <li key={s}>{s}</li>)
            ) : (
              <li>Check responsibilities and essential requirements.</li>
            )}
          </ul>
        </div>
      </div>
      {related.length > 0 && (
        <p>
          <b>Related skills to check:</b>{" "}
          {related.join(", ")}
          . Related evidence does not prove the exact requirement.
        </p>
      )}
      {evidence.length > 0 && (
        <details>
          <summary>Inspect skill evidence</summary>
          <ul>
            {evidence.map((item, i: number) => (
              <li key={i}>
                <b>{item.requirement}</b> — {item.candidateSkill} ·{" "}
                {item.explanation}
              </li>
            ))}
          </ul>
        </details>
      )}
      {job.salaryComparison && (
        <p>
          <b>Salary comparison:</b> {job.salaryComparison.reason}
        </p>
      )}
      {job.reviewEvidence?.length? <><h4>Domain and essential requirements to review</h4><ul>{job.reviewEvidence.map((item,i)=><li key={i}><b>{item.category}: {item.requested}</b><br/>{Array.isArray(item.evidence)?item.evidence.join(" · "):item.evidence} · {item.status}</li>)}</ul><p>These requirements need your review and do not earn automatic score points.</p></>:null}<h4>Unknown information</h4>
      <ul>
        {(
          job.unknownInformation || job.uncertainties ||
          relevance.uncertainty ||
          relevance.uncertainties || [
            "Employer requirements and hiring decisions need independent review.",
          ]
        ).map((s: string) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <details>
        <summary>How the fit estimate is calculated</summary>
        <p>
          {relevance.method ||
            "The demonstration compares listed skills with the fictional profile."}
        </p>
        <p>
          Profile revision {relevance.profileRevision ?? "demonstration"} ·
          Resume version {relevance.resumeVersion ?? "none selected"}. This
          estimate describes profile fit; it is not a probability of being
          hired.
        </p>
        {job.factors?.length ? <><p>Evidence coverage: {job.coverage}% of the weighted factors could be assessed.</p><ul>{job.factors.map(factor => <li key={factor.name}><b>{factor.name}: {factor.points}/{factor.weight}</b> · {factor.status}<br/>{factor.evidence}</li>)}</ul></> : relevance.components && (
          <pre>{JSON.stringify(relevance.components, null, 2)}</pre>
        )}
      </details>
      <div className="source-facts">
        <span>
          <b>Source:</b>{" "}
          {job.source === "demonstration"
            ? "Fictional demonstration"
            : job.source || "Candidate import"}
        </span>
        <span>
          <b>Posted:</b>{" "}
          {job.postedAt
            ? new Date(job.postedAt).toLocaleDateString("en-IN")
            : "Not provided"}
        </span>
        <span>
          <b>Last refresh:</b>{" "}
          {job.lastCheckedAt
            ? new Date(job.lastCheckedAt).toLocaleString("en-IN")
            : "Not verified"}
        </span>
        <span>
          <b>Qualifications:</b>{" "}
          {job.qualifications?.join(", ") || "Not provided"}
        </span>
      </div>
    </section>
  );
}
export function AlertSettings(props:Props){return <AlertSettingsForm key={JSON.stringify(props.state.notifications)} {...props}/>;}
function AlertSettingsForm({ state, demo, reload, notify }: Props) {
  const [settings, setSettings] = useState(state.notifications),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [verification, setVerification] = useState<VerificationResponse&{channel:string}|null>(null),
    [addresses, setAddresses] = useState({
      email: state.profile.email || "",
      whatsapp: state.profile.whatsapp || "",
    }),
    [token, setToken] = useState("");
  async function run(action: () => Promise<void>) {
    if (demo) {
      notify(
        "Alert settings and delivery use your private account. The demonstration sends no messages.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function save(value = settings) {
    return run(async () => {
      const {emailEnabled,whatsappEnabled,emailConsent,whatsappConsent,timeZone,dispatchTime,paused,maxJobsPerDigest}=value;
      await api("notifications", "PUT", {emailEnabled,whatsappEnabled,emailConsent,whatsappConsent,timeZone,dispatchTime,paused,maxJobsPerDigest:maxJobsPerDigest??5});
      await reload();
      notify("Alert preferences saved.");
    });
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="notification-grid">
          {(["email", "whatsapp"] as const).map((channel) => {
            const integration = state.integrations?.[channel];
            const destination = (state.verifiedDestinations || []).find(
              (d) => d.channel === channel,
            );
            const verified =
              destination?.verified ?? settings[channel === "email" ? "emailVerified" : "whatsappVerified"];
            return (
              <section className="panel channel-card" key={channel}>
                <div className="panel-heading">
                  <span className="feature-icon">
                    <Send size={22} />
                  </span>
                  <span className="pill gray">
                    {integration?.status || "Awaiting setup"}
                  </span>
                </div>
                <h2>
                  {channel === "email" ? "Email digest" : "WhatsApp digest"}
                </h2>
                <p>
                  New suitable jobs, a brief match reason, and a link to your
                  workspace.
                </p>
                <p className="destination-state">
                  {verified
                    ? "Verified destination: " +
                      (destination?.address || "confirmed")
                    : "Please verify your destination before enabling alerts."}
                </p>
                <label>
                  {channel === "email"
                    ? "Email address"
                    : "WhatsApp number with country code"}
                  <input
                    type={channel === "email" ? "email" : "tel"}
                    value={addresses[channel]}
                    onChange={(e) =>
                      setAddresses({ ...addresses, [channel]: e.target.value })
                    }
                  />
                </label>
                <button
                  className="btn outline small"
                  type="button"
                  disabled={busy || demo}
                  onClick={() =>
                    run(async () => {
                      const response = await api<{verification:VerificationResponse}>(
                        "notifications/verify-request",
                        "POST",
                        { channel, address: addresses[channel] },
                      );
                      setVerification({ ...response.verification, channel });
                      setMessage(
                        "A verification code was accepted by the provider. Check your destination; acceptance does not confirm delivery.",
                      );
                    })
                  }
                >
                  Send verification code
                </button>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!settings[channel === "email" ? "emailConsent" : "whatsappConsent"]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [channel + "Consent"]: e.target.checked,
                        ...(!e.target.checked
                          ? { [channel + "Enabled"]: false }
                          : {}),
                      })
                    }
                  />
                  I consent to daily job digests on this channel.
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!!settings[channel === "email" ? "emailEnabled" : "whatsappEnabled"]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [channel + "Enabled"]: e.target.checked,
                      })
                    }
                  />
                  Enable {channel === "email" ? "email" : "WhatsApp"} alerts
                </label>
                <small>
                  Delivery requires verified contact details, consent, and a
                  configured service.
                </small>
              </section>
            );
          })}
        </div>
        <section className="panel schedule-panel">
          <h2>Your daily schedule</h2>
          <p>
            8:00 a.m. in India is the default. Choose a time that suits you.
          </p>
          <div className="form-grid">
            <label>
              Dispatch time
              <input
                type="time"
                value={settings.dispatchTime}
                onChange={(e) =>
                  setSettings({ ...settings, dispatchTime: e.target.value })
                }
              />
            </label>
            <label>
              Time zone
              <select
                value={settings.timeZone}
                onChange={(e) =>
                  setSettings({ ...settings, timeZone: e.target.value })
                }
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
            <label>
              Maximum jobs per digest
              <input
                type="number"
                min={1}
                max={10}
                value={settings.maxJobsPerDigest ?? 5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxJobsPerDigest: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.paused}
              onChange={(e) =>
                setSettings({ ...settings, paused: e.target.checked })
              }
            />
            Pause all alerts
          </label>
          <p>
            Next dispatch:{" "}
            {settings.nextAlert
              ? new Date(settings.nextAlert).toLocaleString("en-IN")
              : "None scheduled until alerts are enabled and the scheduler is connected."}
          </p>
          <div className="form-actions">
            <button className="btn primary" disabled={busy || demo}>
              <Check size={16} />
              {busy ? "Saving…" : "Save alert preferences"}
            </button>
            <button
              className="btn outline"
              type="button"
              disabled={busy || demo}
              onClick={() => {
                const value = {
                  ...settings,
                  emailConsent: false,
                  whatsappConsent: false,
                  emailEnabled: false,
                  whatsappEnabled: false,
                  paused: true,
                };
                setSettings(value);
                save(value);
              }}
            >
              Unsubscribe both channels
            </button>
          </div>
        </section>
      </form>
      {verification && (
        <form
          className="panel verification-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("notifications/verify", "POST", {
                id: verification.verificationId,
                token,
              });
              setVerification(null);
              setToken("");
              await reload();
              notify("Destination verified.");
            });
          }}
        >
          <h2>Confirm your {verification.channel} destination</h2>
          <label>
            Verification code
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="one-time-code"
              maxLength={100}
              required
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Verify destination
          </button>
        </form>
      )}
      <Message text={message} error />
      <section className="panel alert-history">
        <h2>Recent delivery history</h2>
        {state.notificationHistory?.length ? (
          <div className="activity-list">
            {state.notificationHistory.map((item) => (
              <div key={item.id}>
                <b>
                  {item.channel} · {String(item.status).replaceAll("_", " ")}
                </b>
                <p>
                  {item.sentAt || item.acceptedAt || item.createdAt
                    ? new Date(
                        item.sentAt || item.acceptedAt || item.createdAt,
                      ).toLocaleString("en-IN")
                    : "Time not recorded"}{" "}
                  · {item.jobCount!=null?`${item.jobCount} jobs`:item.jobIds?`${item.jobIds.length} jobs`:"Job count not recorded"}
                </p>
                <small>{item.reason || item.errorCode || ""}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <AlertCircle size={26} />
            <h3>No messages recorded</h3>
            <p>
              Provider acceptance and confirmed delivery are recorded
              separately. No sent status is invented.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export function DocumentManager({
  state,
  demo,
  reload,
  notify,
  onEdit,
}: Props & { onEdit: (r: ResumeDraft) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<(DocumentPreview&{document:UploadedDocument})|null>(null),
    [title, setTitle] = useState("Uploaded resume"),
    [targetRole, setTargetRole] = useState(""),
    [selectedFields, setSelectedFields] = useState<string[]>([]),
    [confirmContacts, setConfirmContacts] = useState(false);
  const integration = state.integrations?.documents;
  const configured = !!integration?.configured;
  async function upload(file?: File) {
    if (!file) return;
    if (demo) {
      notify("Use your private account to upload documents.");
      return;
    }
    if (!configured) {
      setError(
        "Secure document processing still needs setup. You can use the text editor now.",
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a PDF or DOCX file up to 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/career/documents/upload", {
        method: "POST",
        headers: {
          "Content-Type": /\.pdf$/i.test(file.name)
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "X-Career-Action": "1",
          "X-Career-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok)
        throw new Error(result.error || "The document could not be processed.");
      await reload();
      notify(
        "Upload processed. Review extracted information before saving a version.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function preview(document: UploadedDocument) {
    setBusy(true);
    setError("");
    try {
      const result = await api<DocumentPreview>("documents/" + document.id + "/preview");
      setReview({ ...result, document });
      setTitle(document.originalFilename.replace(/\.[^.]+$/, ""));
      setTargetRole(state.preferences.targetRoles[0] || "");
      setSelectedFields([]);
      setConfirmContacts(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if(!review)return;
    setBusy(true);
    setError("");
    try {
      const fields = review.extracted?.fields || {};
      const profileFields = Object.fromEntries(
        Object.entries(fields).filter(([key])=>selectedFields.includes(key)),
      );
      await api("documents/" + review.id + "/review", "POST", {
        title,
        targetRole,
        text: review.text,
        applyProfile: selectedFields.length > 0,
        profileFields,
        expectedRevision: state.revision,
        ...(confirmContacts
          ? {
              confirmContacts: true,
              contactFields: Object.fromEntries(
                Object.entries(review.extracted?.documentContacts || {}).filter(
                  ([k]) => ["phone", "whatsapp"].includes(k),
                ),
              ),
            }
          : {}),
      });
      setReview(null);
      await reload();
      notify(
        "Reviewed resume saved as a separate version. Select it as active when ready.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel documents-panel">
      <div className="panel-heading">
        <div>
          <h2>Original documents</h2>
          <p>PDF and DOCX · maximum 10 MB · private by default</p>
        </div>
        <span className="pill gray">
          {configured ? "Processing configured" : "Setup required"}
        </span>
      </div>
      <div
        className={"upload-zone " + (busy ? "busy" : "")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files[0]);
        }}
      >
        <Upload size={25} />
        <b>{busy ? "Processing your document…" : "Drop your resume here"}</b>
        <span>Originals stay separate from reviewed and edited versions.</span>
        <label className="btn outline small">
          Choose a file
          <input
            className="file-picker"
            type="file"
            accept=".pdf,.docx"
            disabled={busy || demo || !configured}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {!configured && (
        <p className="muted">
          {integration?.reason ||
            "Private scanning and isolated conversion must be configured before uploads can be accepted."}{" "}
          The text editor remains available.
        </p>
      )}
      <Message text={error} error />
      {state.documents?.length ? (
        <div className="activity-list">
          {state.documents.map((document) => (
            <div key={document.id} className="document-row">
              <FileText size={22} />
              <div>
                <b>{document.originalFilename}</b>
                <p>
                  {new Date(document.createdAt).toLocaleString("en-IN")} ·{" "}
                  {Math.round(document.byteSize / 1024)} KB ·{" "}
                  {document.status.replaceAll("_", " ")}
                </p>
                {document.errorCode && (
                  <small>
                    Processing could not finish. Use manual entry or try a
                    readable, unlocked document.
                  </small>
                )}
              </div>
              {["review_required", "confirmed"].includes(document.status) && (
                <>
                  <button
                    className="btn outline small"
                    disabled={busy}
                    onClick={() => preview(document)}
                  >
                    Preview & review
                  </button>
                  <a
                    className="icon-button"
                    aria-label={
                      "Download original " + document.originalFilename
                    }
                    href={"/api/career/documents/" + document.id + "/original"}
                  >
                    <Download size={17} />
                  </a>
                </>
              )}
              <button
                className="icon-button"
                disabled={busy}
                aria-label={"Delete original " + document.originalFilename}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Delete this original document? Saved text versions remain available.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api("documents/" + document.id, "DELETE");
                    await reload();
                    notify("Original document deleted.");
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No original documents uploaded.</p>
      )}
      {review && (
        <section className="document-review">
          <div className="panel-heading">
            <h2>Review before saving</h2>
            <button
              className="btn outline small"
              onClick={() => setReview(null)}
            >
              Close review
            </button>
          </div>
          <p>
            Check the extracted text. Correct uncertain details before using
            them in your profile.
          </p>
          <div className="form-grid">
            <label>
              Version name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
              />
            </label>
            <label>
              Target role <small>optional</small>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                maxLength={160}
              />
            </label>
          </div>
          <label>
            Extracted resume text
            <textarea
              rows={16}
              value={review.text}
              onChange={(e) => setReview({ ...review, text: e.target.value })}
              maxLength={50000}
            />
          </label>
          <h3>Optional profile updates</h3>
          {Object.entries(review.extracted?.fields || {})
            .filter(([k]) => !["email", "phone", "whatsapp"].includes(k))
            .map(([key, value]) => (
              <label className="checkbox-row" key={key}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(key)}
                  onChange={(e) =>
                    setSelectedFields(
                      e.target.checked
                        ? [...selectedFields, key]
                        : selectedFields.filter((k) => k !== key),
                    )
                  }
                />
                <span>
                  <b>{key}</b>:{" "}
                  {Array.isArray(value) ? value.join(", ") : String(value)}{" "}
                  {review.extracted?.uncertainFields?.includes(key) && (
                    <em>— needs checking</em>
                  )}
                </span>
              </label>
            ))}
          {review.extracted?.documentContacts && (
            <div className="notice">
              <ShieldCheck size={18} />
              <div>
                <b>Document contacts are separate from your account</b>
                <p>
                  {Object.entries(review.extracted.documentContacts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={confirmContacts}
                    onChange={(e) => setConfirmContacts(e.target.checked)}
                  />
                  Replace my saved phone / WhatsApp with these reviewed
                  contacts. Account email stays unchanged.
                </label>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button
              className="btn primary"
              disabled={busy || !review.text.trim()}
              onClick={confirm}
            >
              <Check size={15} />
              Save reviewed version
            </button>
            <button
              className="btn outline"
              onClick={() => onEdit({ title, targetRole, text: review.text })}
            >
              Continue in text editor
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
function ToolResult({ result }: {result:AIResult|null}) {
  if (!result) return null;
  return (
    <div className="assistant-result">
      <span className="tool-badge">
        {result.source === "ai"
          ? "External AI suggestion"
          : "Structured self-review · no external AI call"}
      </span>
      <p>{result.reply}</p>
      {result.suggestions?.length > 0 && (
        <>
          <h3>Suggestions to review</h3>
          <ul>
            {result.suggestions.map((s, i: number) => (
              <li key={i}>{s.text}</li>
            ))}
          </ul>
        </>
      )}
      {result.evidence?.map((e, i: number) => (
        <blockquote key={i}>
          {e.quote}
          <br />
          <small>Source evidence {e.factId}</small>
        </blockquote>
      ))}
      {result.documentText && (
        <>
          <h3>Draft using confirmed facts</h3>
          <pre>{result.documentText}</pre>
        </>
      )}
      {result.feedback && (
        <>
          <h3>Answer feedback</h3>
          {Object.entries(result.feedback).map(([key, value]) => (
            <p key={key}>
              <b>{key[0].toUpperCase() + key.slice(1)}:</b> {String(value)}
            </p>
          ))}
        </>
      )}
      {result.nextSteps?.length > 0 && (
        <>
          <h3>Practical next steps</h3>
          <ul>
            {result.nextSteps.map((text: string, i: number) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </>
      )}
      {result.warnings?.length > 0 && (
        <div className="notice">
          <AlertCircle size={18} />
          <div>
            {result.warnings.map((warning: string, i: number) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
        </div>
      )}
      <small>
        Profile revision {result.context?.profileRevision ?? "not recorded"} ·
        Resume version {result.context?.resumeVersion ?? "none selected"}.
        Review all facts before using a draft.
      </small>
    </div>
  );
}
export function AssistantTools({
  state,
  demo,
  reload,
  notify,
  interview = false,
}: Props & { interview?: boolean }) {
  const [mode, setMode] = useState(interview ? "interview_questions" : "coach"),
    [jobId, setJobId] = useState(""),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<AIResult|null>(null),
    [session, setSession] = useState<PrivateSession|null>(null),
    [answer, setAnswer] = useState(""),
    [question, setQuestion] = useState(""),
    [questionBank, setQuestionBank] = useState<QuestionList>([]);
  const history = (state.aiSessions || []).filter((s) =>
    interview
      ? String(s.mode || "").startsWith("interview")
      : !String(s.mode || "").startsWith("interview"),
  );
  function choose(item:PrivateSession) {
    const value=item.result;
    setSession(item);
    setResult(value);
    setMode(
      item.mode || value?.mode || (interview ? "interview_questions" : "coach"),
    );
    setJobId(value?.context?.jobId || "");
    setError("");
    if (value?.questions?.length) {
      setQuestionBank(value.questions);
      setQuestion(value.questions[0].question);
    } else setQuestionBank([]);
  }
  async function generate(nextMode = mode) {
    if (demo) {
      notify(
        "Open your private workspace to save assistant and interview sessions.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const value = await api("ai", "POST", {
        mode: nextMode,
        prompt,
        jobId: jobId || null,
        ...(session
          ? { sessionId: session.id, expectedRevision: session.revision }
          : {}),
        ...(nextMode === "interview_feedback" ? { question, answer } : {}),
      });
      const output=value.result;
      if(!output)throw new Error("The assistant returned an invalid result.");
      setResult(output);
      setSession(value.state?.aiSessions?.find((s)=>s.id===(value.sessionId||value.id))??null);
      setMode(nextMode);
      if (nextMode === "interview_questions" && output.questions?.[0]) {
        setQuestion(output.questions[0].question);
        setQuestionBank(output.questions);
      }
      await reload();
      notify("Private session saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="assistant-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {interview
                ? "Practice for your target role"
                : "A practical next step for your career"}
            </h2>
            <p>
              {interview
                ? "Questions, answers and feedback stay in your private workspace."
                : "Use your confirmed profile and selected resume to review a role or draft."}
            </p>
          </div>
          <Sparkles size={23} />
        </div>
        <span className="tool-badge">
          {state.integrations?.ai?.status === "configured"
            ? "AI configured · access checked on request"
            : "Self-review available · external AI needs setup"}
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate(interview ? "interview_questions" : mode);
          }}
        >
          {!interview && (
            <label>
              What would you like help with?
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setSession(null);
                  setResult(null);
                }}
              >
                <option value="coach">Career direction & skills plan</option>
                <option value="resume">Improve a separate resume draft</option>
                <option value="coverletter">Draft a cover letter</option>
              </select>
            </label>
          )}
          <label>
            Selected job <small>optional except for cover letters</small>
            <select
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                setSession(null);
              }}
            >
              <option value="">Use my career goals</option>
              {state.jobs
                .filter((j) => !j.closed)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.company}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {interview
              ? "Practice focus (optional)"
              : "Your question or preferred tone"}
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              placeholder={
                interview
                  ? "For example: automotive closure design reviews"
                  : "For example: Which confirmed skills transfer to my target role?"
              }
            />
          </label>
          <div className="form-actions">
            <button
              className="btn primary"
              disabled={busy || demo || (mode === "coverletter" && !jobId)}
            >
              <Sparkles size={16} />
              {busy
                ? "Preparing…"
                : interview
                  ? "Prepare practice questions"
                  : "Get suggestions"}
            </button>
            {session && (
              <button
                className="btn outline"
                type="button"
                onClick={() => {
                  setSession(null);
                  setResult(null);
                  setAnswer("");
                  setQuestion("");
                }}
              >
                New session
              </button>
            )}
          </div>
        </form>
        <Message text={error} error />
        {interview && questionBank.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generate("interview_feedback");
            }}
          >
            <label>
              Question
              <select
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              >
                {questionBank.map((q, i: number) => (
                  <option key={i} value={q.question}>
                    {q.question}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your answer
              <textarea
                rows={8}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={6000}
                required
              />
            </label>
            <button className="btn primary" disabled={busy || demo}>
              <Send size={16} />
              Save answer & review
            </button>
          </form>
        )}
        <ToolResult result={result} />
        {session && session.history.length > 0 && (
          <details>
            <summary>Review saved conversation and answers</summary>
            {session.history.map((turn, i: number) => (
              <div className="interview-answer" key={i}>
                <b>{turn.role === "user" ? "Your input" : "Assistant"}</b>
                <p>{turn.text}</p>
              </div>
            ))}
          </details>
        )}
        {result?.documentText && session?.id && (
          <div className="form-actions">
            <label className="checkbox-row">
              <input type="checkbox" id="reviewed-document" />I reviewed the
              draft and confirmed its facts.
            </label>
            <button
              className="btn primary"
              disabled={busy || demo}
              onClick={async () => {
                const input = document.getElementById(
                  "reviewed-document",
                ) as HTMLInputElement;
                if (!input?.checked) {
                  notify(
                    "Review and confirm the draft before saving a new version.",
                  );
                  return;
                }
                setBusy(true);
                try {
                  await api("ai-sessions/" + session.id + "/review", "POST", {
                    confirmed: true,
                    kind:
                      result.mode === "coverletter" ? "coverletter" : "resume",
                    title:
                      result.mode === "coverletter"
                        ? "Reviewed cover letter"
                        : "Reviewed tailored resume",
                  });
                  await reload();
                  notify("Reviewed document saved as a separate version.");
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={16} />
              Save separate version
            </button>
          </div>
        )}
      </section>
      <aside>
        <section className="panel context-preview">
          <h2>Your confirmed context</h2>
          <p>
            <b>Current role:</b> {state.profile.currentRole || "Not set"}
          </p>
          <p>
            <b>Target roles:</b>{" "}
            {state.preferences.targetRoles.join(", ") || "Not set"}
          </p>
          <p>
            <b>Skills:</b> {state.profile.skills.join(", ") || "Not set"}
          </p>
          <p>
            <b>Active resume:</b>{" "}
            {state.resumes.find((r) => r.active)?.title || "None selected"}
          </p>
          <a
            className="text-link"
            href={(demo ? "/demo" : "/dashboard") + "?view=profile"}
          >
            Review profile context
          </a>
          <div className="notice">
            <ShieldCheck size={18} />
            <p>
              Suggestions cannot submit applications, change your contacts, or
              authorize payments. No recording is made.
            </p>
          </div>
        </section>
        <section className="panel assistant-history">
          <h2>Private session history</h2>
          {history.length ? (
            history.map((item) => (
              <div key={item.id}>
                <button onClick={() => choose(item)}>
                  <b>
                    {item.title ||
                      String(
                        item.mode || "Career session",
                      ).replaceAll("_", " ")}
                  </b>
                  <p>
                    {item.updatedAt || item.createdAt
                      ? new Date(
                          item.updatedAt || item.createdAt,
                        ).toLocaleString("en-IN")
                      : "Saved session"}
                  </p>
                </button>
                <button
                  className="text-link"
                  disabled={busy || demo}
                  onClick={async () => {
                    if (!window.confirm("Delete this private session?")) return;
                    setBusy(true);
                    try {
                      await api("ai-sessions/" + item.id, "DELETE");
                      if (session?.id === item.id) {
                        setSession(null);
                        setResult(null);
                      }
                      await reload();
                      notify("Session deleted.");
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete session
                </button>
              </div>
            ))
          ) : (
            <p>No sessions saved yet.</p>
          )}
        </section>
        {!interview && (state.generatedDocuments?.length ?? 0) > 0 && (
          <section className="panel assistant-history">
            <h2>Reviewed cover letters</h2>
            {(state.generatedDocuments||[]).map((item) => (
              <details key={item.id}>
                <summary>
                  {item.title || "Cover letter"} · Version{" "}
                  {item.version ?? "saved"}
                </summary>
                <pre className="interview-answer">
                  {item.text || ""}
                </pre>
                <button
                  className="btn outline small"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([item.text || ""], {
                        type: "text/plain",
                      }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "cover-letter.txt";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download text
                </button>
                <button
                  className="text-link"
                  disabled={busy || demo}
                  onClick={async () => {
                    if (!window.confirm("Delete this reviewed cover letter?"))
                      return;
                    try {
                      await api("generated-documents/" + item.id, "DELETE");
                      await reload();
                      notify("Cover letter deleted.");
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  Delete
                </button>
              </details>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}
export function UpcomingInterviews({ state }: {state:ViewState}) {
  const interviews = state.applications
    .filter(
      (a) =>
        a.status === "Interview" &&
        a.reminderAt &&
        new Date(a.reminderAt!) > new Date(),
    )
    .sort((a, b) => a.reminderAt!.localeCompare(b.reminderAt!));
  return (
    <section className="panel upcoming-interviews">
      <h2>Upcoming interviews</h2>
      {interviews.length ? (
        interviews.map((a) => {
          const job = state.jobs.find((j) => j.id === a.jobId);
          return (
            <div key={a.id}>
              <p>
                <b>
                  {job?.title || "Saved opportunity"} ·{" "}
                  {job?.company || "Not provided"}
                </b>
                <br />
                {new Date(a.reminderAt!).toLocaleString("en-IN")} ·
                candidate-updated
              </p>
            </div>
          );
        })
      ) : (
        <p>
          No upcoming interview dates saved. Add a date in Application Tracker.
        </p>
      )}
    </section>
  );
}
