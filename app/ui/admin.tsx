"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Brand } from "./public";
export function AdminPanel() {
  const [state, setState] = useState<Record<string,unknown>|null>(null),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/career/admin/status", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Record<string,unknown>;
        if (!response.ok)
          throw new Error(typeof body.error==='string'?body.error:"Administrator access is unavailable.");
        setState(body);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <Link className="btn outline" href="/dashboard">
          Back to workspace
        </Link>
      </header>
      <main className="public-content">
        <div className="eyebrow">RESTRICTED ADMINISTRATION</div>
        <h1>Service operations</h1>
        <p className="public-intro">
          Only authorised administrators with fresh multifactor verification can
          access operational configuration.
        </p>
        {loading ? (
          <p role="status">Checking administrator access…</p>
        ) : message ? (
          <section className="panel">
            <h2>Administrative access requires setup</h2>
            <p role="alert">{message}</p>
            <p>
              The current host does not supply a trusted fresh MFA attestation.
              User roles, provider credentials and sensitive configuration
              cannot be edited here until that boundary is implemented and
              tested.
            </p>
          </section>
        ) : (
          <div className="admin-status-grid">
            {Object.entries(state || {}).map(([key, value]) => (
              <section className="panel" key={key}>
                <h2>{key}</h2>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </section>
            ))}
          </div>
        )}
        <p>
          <Link className="text-link" href="/security">
            Security information
          </Link>
        </p>
      </main>
    </div>
  );
}
